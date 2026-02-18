import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { env } from './env.js'

type ServiceAccountLike = {
  project_id?: string
  client_email?: string
  private_key?: string
}

type FirebaseConfigStatus = {
  enabled: boolean
  missingKeys: string[]
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

function resolveServiceAccountPath(rawPath: string): string {
  if (!rawPath) {
    return ''
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath)
}

function readServiceAccountFromFile(): ServiceAccountLike | null {
  const resolvedPath = resolveServiceAccountPath(env.firebaseServiceAccountPath)
  if (!resolvedPath || !existsSync(resolvedPath)) {
    return null
  }

  try {
    const raw = readFileSync(resolvedPath, 'utf8')
    return JSON.parse(raw) as ServiceAccountLike
  } catch {
    return null
  }
}

function getCredentialsFromSource() {
  const fileCredentials = readServiceAccountFromFile()
  const projectId = fileCredentials?.project_id ?? env.firebaseProjectId
  const clientEmail = fileCredentials?.client_email ?? env.firebaseClientEmail
  const privateKey = fileCredentials?.private_key ?? env.firebasePrivateKey
  const storageBucket = env.firebaseStorageBucket

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
    storageBucket,
  }
}

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const credentials = getCredentialsFromSource()
  const missingKeys: string[] = []

  if (!credentials.projectId) missingKeys.push('FIREBASE_PROJECT_ID')
  if (!credentials.clientEmail) missingKeys.push('FIREBASE_CLIENT_EMAIL')
  if (!credentials.privateKey) missingKeys.push('FIREBASE_PRIVATE_KEY')
  if (!credentials.storageBucket) missingKeys.push('FIREBASE_STORAGE_BUCKET')

  return { enabled: missingKeys.length === 0, missingKeys }
}

export function initializeFirebaseIfConfigured(): boolean {
  const status = getFirebaseConfigStatus()
  if (!status.enabled) {
    return false
  }

  const credentials = getCredentialsFromSource()
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
      storageBucket: credentials.storageBucket,
    })
  }

  return true
}

export function getFirestoreDb() {
  return getFirestore()
}

export function getStorageBucket() {
  return getStorage().bucket()
}

export function getFirebaseAuth() {
  return getAuth()
}
