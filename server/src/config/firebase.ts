import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
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

type FirebaseCredentialSource = {
  projectId: string
  clientEmail: string
  privateKey: string
  storageBucket: string
  useApplicationDefault: boolean
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

function getCredentialsFromSource(): FirebaseCredentialSource {
  const fileCredentials = readServiceAccountFromFile()
  const projectId = fileCredentials?.project_id ?? env.firebaseProjectId
  const clientEmail = fileCredentials?.client_email ?? env.firebaseClientEmail
  const privateKey = fileCredentials?.private_key ?? env.firebasePrivateKey
  const storageBucket = env.firebaseStorageBucket
  const isCloudRunRuntime = typeof process.env.K_SERVICE === 'string' && process.env.K_SERVICE.length > 0
  const useApplicationDefault = env.firebaseUseAdc || isCloudRunRuntime

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
    storageBucket,
    useApplicationDefault,
  }
}

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const credentials = getCredentialsFromSource()
  const hasServiceAccountCredentials = Boolean(
    credentials.projectId && credentials.clientEmail && credentials.privateKey,
  )
  const missingKeys: string[] = []

  if (!credentials.storageBucket) missingKeys.push('FIREBASE_STORAGE_BUCKET')
  if (!hasServiceAccountCredentials && !credentials.useApplicationDefault) {
    missingKeys.push('FIREBASE_PROJECT_ID')
    missingKeys.push('FIREBASE_CLIENT_EMAIL')
    missingKeys.push('FIREBASE_PRIVATE_KEY')
  }

  return { enabled: missingKeys.length === 0, missingKeys }
}

export function initializeFirebaseIfConfigured(): boolean {
  const status = getFirebaseConfigStatus()
  if (!status.enabled) {
    return false
  }

  const credentials = getCredentialsFromSource()
  if (getApps().length === 0) {
    const hasServiceAccountCredentials = Boolean(
      credentials.projectId && credentials.clientEmail && credentials.privateKey,
    )
    if (hasServiceAccountCredentials) {
      initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
        storageBucket: credentials.storageBucket,
      })
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: credentials.projectId || process.env.GOOGLE_CLOUD_PROJECT,
        storageBucket: credentials.storageBucket,
      })
    }
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
