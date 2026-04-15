import type { DecodedIdToken } from 'firebase-admin/auth'
import { getFirestoreDb } from '../config/firebase.js'
import {
  getServiceProviderIndustryMeta,
  normalizeServiceProviderIndustry,
} from './service-provider-industries.service.js'
import type {
  ServiceProviderProfile,
  ServiceProviderPublicProfile,
} from '../types/service-provider.js'

const SERVICE_PROVIDERS_COLLECTION = 'service_providers'
const LEGACY_CONTRACTORS_COLLECTION = 'contractors'
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 7
const MAX_CODE_ATTEMPTS = 25

type RawServiceProviderProfile = Partial<ServiceProviderProfile> & {
  contractorCode?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeDisplayName(
  user: DecodedIdToken,
  fallbackDisplayName?: string,
): string {
  if (typeof user.name === 'string' && user.name.trim().length > 0) {
    return user.name.trim()
  }
  if (typeof fallbackDisplayName === 'string' && fallbackDisplayName.trim().length > 0) {
    return fallbackDisplayName.trim()
  }
  if (typeof user.email === 'string' && user.email.trim().length > 0) {
    return user.email.trim().split('@')[0]
  }
  return 'Service provider'
}

function getExistingCode(profile: RawServiceProviderProfile): string | null {
  if (
    typeof profile.serviceProviderCode === 'string' &&
    profile.serviceProviderCode.trim().length > 0
  ) {
    return profile.serviceProviderCode.trim().toUpperCase()
  }
  if (typeof profile.contractorCode === 'string' && profile.contractorCode.trim().length > 0) {
    return profile.contractorCode.trim().toUpperCase()
  }
  return null
}

function generateCodeCandidate(): string {
  let result = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length)
    result += CODE_ALPHABET[index]
  }
  return result
}

async function codeExistsInCollection(
  collectionName: string,
  fieldName: string,
  code: string,
): Promise<boolean> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(collectionName)
    .where(fieldName, '==', code)
    .limit(1)
    .get()
  return !snapshot.empty
}

async function generateUniqueServiceProviderCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate = generateCodeCandidate()
    const [inNewCollection, inLegacyCollection] = await Promise.all([
      codeExistsInCollection(SERVICE_PROVIDERS_COLLECTION, 'serviceProviderCode', candidate),
      codeExistsInCollection(LEGACY_CONTRACTORS_COLLECTION, 'contractorCode', candidate),
    ])

    if (!inNewCollection && !inLegacyCollection) {
      return candidate
    }
  }

  throw new Error('Failed to generate a unique service provider code.')
}

function toProfile(
  uid: string,
  authUser: DecodedIdToken,
  current: RawServiceProviderProfile | null,
  now: string,
  code: string,
): ServiceProviderProfile {
  const industryMeta = getServiceProviderIndustryMeta(current?.industry)
  return {
    uid,
    serviceProviderCode: code,
    email: authUser.email ?? current?.email ?? '',
    displayName: normalizeDisplayName(authUser, current?.displayName),
    industry: industryMeta.value,
    industryLabel: industryMeta.label,
    industryCategoryId: industryMeta.categoryId,
    industryCategoryLabel: industryMeta.categoryLabel,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  }
}

export async function ensureServiceProviderProfile(
  authUser: DecodedIdToken,
): Promise<ServiceProviderProfile> {
  const db = getFirestoreDb()
  const now = nowIso()
  const serviceProviderRef = db.collection(SERVICE_PROVIDERS_COLLECTION).doc(authUser.uid)
  const serviceProviderSnapshot = await serviceProviderRef.get()

  if (serviceProviderSnapshot.exists) {
    const current = serviceProviderSnapshot.data() as RawServiceProviderProfile
    const code = getExistingCode(current) ?? (await generateUniqueServiceProviderCode())
    const updated = toProfile(authUser.uid, authUser, current, now, code)
    await serviceProviderRef.set(updated, { merge: true })
    return updated
  }

  const legacyRef = db.collection(LEGACY_CONTRACTORS_COLLECTION).doc(authUser.uid)
  const legacySnapshot = await legacyRef.get()
  const legacyData = legacySnapshot.exists
    ? (legacySnapshot.data() as RawServiceProviderProfile)
    : null

  const migratedCode = getExistingCode(legacyData ?? {}) ?? (await generateUniqueServiceProviderCode())
  const created = toProfile(authUser.uid, authUser, legacyData, now, migratedCode)
  await serviceProviderRef.set(created, { merge: true })
  return created
}

function toPublicProfile(
  docId: string,
  raw: RawServiceProviderProfile,
): ServiceProviderPublicProfile | null {
  const code = getExistingCode(raw)
  if (!code) {
    return null
  }
  const industryMeta = getServiceProviderIndustryMeta(raw.industry)

  return {
    uid: raw.uid ?? docId,
    serviceProviderCode: code,
    displayName:
      typeof raw.displayName === 'string' && raw.displayName.trim().length > 0
        ? raw.displayName.trim()
        : 'Service provider',
    industry: industryMeta.value,
    industryLabel: industryMeta.label,
    industryCategoryId: industryMeta.categoryId,
    industryCategoryLabel: industryMeta.categoryLabel,
  }
}

function toFullProfile(docId: string, raw: RawServiceProviderProfile): ServiceProviderProfile | null {
  const code = getExistingCode(raw)
  if (!code) {
    return null
  }
  const now = nowIso()
  const industryMeta = getServiceProviderIndustryMeta(raw.industry)
  return {
    uid: raw.uid ?? docId,
    serviceProviderCode: code,
    email: typeof raw.email === 'string' ? raw.email : '',
    displayName:
      typeof raw.displayName === 'string' && raw.displayName.trim().length > 0
        ? raw.displayName.trim()
        : 'Service provider',
    industry: industryMeta.value,
    industryLabel: industryMeta.label,
    industryCategoryId: industryMeta.categoryId,
    industryCategoryLabel: industryMeta.categoryLabel,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    lastLoginAt: typeof raw.lastLoginAt === 'string' ? raw.lastLoginAt : now,
  }
}

async function getByCodeFromCollection(
  collectionName: string,
  fieldName: string,
  code: string,
): Promise<ServiceProviderPublicProfile | null> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(collectionName).where(fieldName, '==', code).limit(1).get()
  if (snapshot.empty) {
    return null
  }

  return toPublicProfile(snapshot.docs[0].id, snapshot.docs[0].data() as RawServiceProviderProfile)
}

export async function getServiceProviderByCode(
  serviceProviderCode: string,
): Promise<ServiceProviderPublicProfile | null> {
  return (
    (await getByCodeFromCollection(
      SERVICE_PROVIDERS_COLLECTION,
      'serviceProviderCode',
      serviceProviderCode,
    )) ??
    (await getByCodeFromCollection(
      SERVICE_PROVIDERS_COLLECTION,
      'contractorCode',
      serviceProviderCode,
    )) ??
    (await getByCodeFromCollection(
      LEGACY_CONTRACTORS_COLLECTION,
      'contractorCode',
      serviceProviderCode,
    ))
  )
}

export async function getServiceProviderByUid(uid: string): Promise<ServiceProviderProfile | null> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(SERVICE_PROVIDERS_COLLECTION).doc(uid).get()
  if (!snapshot.exists) {
    return null
  }
  return toFullProfile(snapshot.id, snapshot.data() as RawServiceProviderProfile)
}

export async function setServiceProviderIndustry(
  uid: string,
  industry: ServiceProviderProfile['industry'],
): Promise<ServiceProviderProfile | null> {
  const existing = await getServiceProviderByUid(uid)
  if (!existing) {
    return null
  }
  const normalizedIndustry = normalizeServiceProviderIndustry(industry)
  const industryMeta = getServiceProviderIndustryMeta(normalizedIndustry)
  const nextProfile: ServiceProviderProfile = {
    ...existing,
    industry: industryMeta.value,
    industryLabel: industryMeta.label,
    industryCategoryId: industryMeta.categoryId,
    industryCategoryLabel: industryMeta.categoryLabel,
    updatedAt: nowIso(),
  }
  const db = getFirestoreDb()
  await db.collection(SERVICE_PROVIDERS_COLLECTION).doc(uid).set(nextProfile, { merge: true })
  return nextProfile
}

export async function listServiceProviderUids(): Promise<string[]> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(SERVICE_PROVIDERS_COLLECTION).get()
  return snapshot.docs.map((doc) => doc.id).filter((id) => id.trim().length > 0)
}
