import { getFirestoreDb } from '../config/firebase.js'
import type {
  CustomFeatureValue,
  CustomFeatureValueType,
  ServiceProviderCustomFeature,
} from '../types/custom-feature.js'

export const SERVICE_PROVIDER_FEATURES_COLLECTION = 'service_provider_feature_fields'

type UpsertFeatureInput = {
  key: string
  label: string
  valueType: CustomFeatureValueType
  defaultValue: CustomFeatureValue
  showInQuoteDetails: boolean
}

type DynamicFeaturePayload = {
  values: Record<string, CustomFeatureValue>
  visibility: Record<string, boolean>
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeDefaultValue(
  valueType: CustomFeatureValueType,
  value: CustomFeatureValue,
): CustomFeatureValue {
  if (value === null || value === undefined) {
    return null
  }
  if (valueType === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (valueType === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return null
  }
  return String(value)
}

function buildFeatureId(serviceProviderUid: string, key: string): string {
  return `${serviceProviderUid}_${normalizeKey(key)}`
}

export async function listServiceProviderFeatures(
  serviceProviderUid: string,
): Promise<ServiceProviderCustomFeature[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(SERVICE_PROVIDER_FEATURES_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  return snapshot.docs
    .map((doc) => doc.data() as ServiceProviderCustomFeature)
    .sort((a, b) => a.key.localeCompare(b.key))
}

export async function upsertServiceProviderFeature(
  serviceProviderUid: string,
  input: UpsertFeatureInput,
): Promise<ServiceProviderCustomFeature> {
  const key = normalizeKey(input.key)
  const timestamp = nowIso()
  const id = buildFeatureId(serviceProviderUid, key)
  const db = getFirestoreDb()
  const ref = db.collection(SERVICE_PROVIDER_FEATURES_COLLECTION).doc(id)
  const existingSnapshot = await ref.get()
  const existing = existingSnapshot.exists
    ? (existingSnapshot.data() as ServiceProviderCustomFeature)
    : null

  const next: ServiceProviderCustomFeature = {
    id,
    serviceProviderUid,
    key,
    label: input.label.trim() || key,
    valueType: input.valueType,
    defaultValue: normalizeDefaultValue(input.valueType, input.defaultValue),
    showInQuoteDetails: input.showInQuoteDetails,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  await ref.set(next, { merge: true })
  return next
}

export async function deleteServiceProviderFeature(
  serviceProviderUid: string,
  featureId: string,
): Promise<boolean> {
  const id = featureId.trim()
  if (!id) {
    return false
  }

  const db = getFirestoreDb()
  const ref = db.collection(SERVICE_PROVIDER_FEATURES_COLLECTION).doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    return false
  }

  const feature = snapshot.data() as ServiceProviderCustomFeature
  if (feature.serviceProviderUid !== serviceProviderUid) {
    return false
  }

  await ref.delete()
  return true
}

export function buildDynamicFeaturePayload(
  features: ServiceProviderCustomFeature[],
): DynamicFeaturePayload {
  const values: Record<string, CustomFeatureValue> = {}
  const visibility: Record<string, boolean> = {}

  features.forEach((feature) => {
    values[feature.key] = normalizeDefaultValue(feature.valueType, feature.defaultValue)
    visibility[feature.key] = feature.showInQuoteDetails
  })

  return { values, visibility }
}
