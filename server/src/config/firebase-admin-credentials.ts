import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.js'

type ServiceAccountLike = { project_id?: string; client_email?: string; private_key?: string }

export type FirebaseCredentialMode = 'service_account_file' | 'environment' | 'application_default'
export type FirebaseCredentialSource = {
  mode: FirebaseCredentialMode
  projectId: string
  clientEmail: string
  privateKey: string
  storageBucket: string
}
export type FirebaseConfigStatus = {
  enabled: boolean
  mode: FirebaseCredentialMode | null
  missingKeys: string[]
  message: string | null
}

export class FirebaseConfigError extends Error {
  readonly missingKeys: string[]

  constructor(message: string, missingKeys: string[] = []) {
    super(message)
    this.name = 'FirebaseConfigError'
    this.missingKeys = missingKeys
  }
}

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_ROOT = path.resolve(SERVER_ROOT, '..')

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

function resolvePathCandidates(rawPath: string): string[] {
  const trimmed = rawPath.trim()
  if (!trimmed) return []
  if (path.isAbsolute(trimmed)) return [trimmed]
  return Array.from(
    new Set([
      path.resolve(process.cwd(), trimmed),
      path.resolve(SERVER_ROOT, trimmed),
      path.resolve(REPO_ROOT, trimmed),
    ]),
  )
}

function requireStorageBucket(missingKeys: string[]): void {
  if (!env.firebaseStorageBucket) missingKeys.push('FIREBASE_STORAGE_BUCKET')
}

function fromServiceAccountFile(): FirebaseCredentialSource | null {
  if (!env.firebaseServiceAccountPath.trim()) return null
  const candidates = resolvePathCandidates(env.firebaseServiceAccountPath)
  const existing = candidates.find((candidate) => existsSync(candidate))
  if (!existing) {
    throw new FirebaseConfigError(
      `FIREBASE_SERVICE_ACCOUNT_PATH is set but file was not found. Checked: ${candidates.join(' | ')}`,
      ['FIREBASE_SERVICE_ACCOUNT_PATH'],
    )
  }

  let parsed: ServiceAccountLike
  try {
    parsed = JSON.parse(readFileSync(existing, 'utf8')) as ServiceAccountLike
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    throw new FirebaseConfigError(
      `Failed to parse Firebase service account JSON at ${existing}: ${details}`,
      ['FIREBASE_SERVICE_ACCOUNT_PATH'],
    )
  }

  const projectId = (parsed.project_id ?? '').trim()
  const clientEmail = (parsed.client_email ?? '').trim()
  const privateKey = normalizePrivateKey((parsed.private_key ?? '').trim())
  const missingKeys = [
    ...(projectId ? [] : ['service_account.project_id']),
    ...(clientEmail ? [] : ['service_account.client_email']),
    ...(privateKey ? [] : ['service_account.private_key']),
  ]
  requireStorageBucket(missingKeys)
  if (missingKeys.length > 0) {
    throw new FirebaseConfigError(
      `Firebase service account JSON is incomplete (${missingKeys.join(', ')}).`,
      missingKeys,
    )
  }

  return { mode: 'service_account_file', projectId, clientEmail, privateKey, storageBucket: env.firebaseStorageBucket }
}

function fromEnvironmentVariables(): FirebaseCredentialSource | null {
  const projectId = env.firebaseProjectId.trim()
  const clientEmail = env.firebaseClientEmail.trim()
  const privateKey = normalizePrivateKey(env.firebasePrivateKey.trim())
  const values = [projectId, clientEmail, privateKey]
  const hasAny = values.some((value) => value.length > 0)
  const hasAll = values.every((value) => value.length > 0)
  if (!hasAny) return null
  if (!hasAll) {
    const missingKeys = [
      ...(projectId ? [] : ['FIREBASE_PROJECT_ID']),
      ...(clientEmail ? [] : ['FIREBASE_CLIENT_EMAIL']),
      ...(privateKey ? [] : ['FIREBASE_PRIVATE_KEY']),
    ]
    requireStorageBucket(missingKeys)
    throw new FirebaseConfigError(
      `Firebase Admin environment variables are incomplete (${missingKeys.join(', ')}).`,
      missingKeys,
    )
  }

  const missingKeys: string[] = []
  requireStorageBucket(missingKeys)
  if (missingKeys.length > 0) throw new FirebaseConfigError('Missing FIREBASE_STORAGE_BUCKET.', missingKeys)
  return { mode: 'environment', projectId, clientEmail, privateKey, storageBucket: env.firebaseStorageBucket }
}

function fromAdcIfEnabled(): FirebaseCredentialSource | null {
  const isCloudRunRuntime = typeof process.env.K_SERVICE === 'string' && process.env.K_SERVICE.length > 0
  if (!env.firebaseUseAdc && !isCloudRunRuntime) return null
  const projectId = (env.firebaseProjectId || process.env.GOOGLE_CLOUD_PROJECT || '').trim()
  const missingKeys = [...(projectId ? [] : ['FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT'])]
  requireStorageBucket(missingKeys)
  if (missingKeys.length > 0) {
    throw new FirebaseConfigError(
      `Firebase ADC initialization is missing required values (${missingKeys.join(', ')}).`,
      missingKeys,
    )
  }

  return { mode: 'application_default', projectId, clientEmail: '', privateKey: '', storageBucket: env.firebaseStorageBucket }
}

function missingConfigurationError(): FirebaseConfigError {
  const missingKeys: string[] = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
  requireStorageBucket(missingKeys)
  return new FirebaseConfigError(
    [
      'Firebase Admin is not configured.',
      'Provide one of the following:',
      '1) FIREBASE_SERVICE_ACCOUNT_PATH (service account JSON).',
      '2) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
      'Cloud Run compatibility: FIREBASE_USE_ADC=true.',
    ].join(' '),
    missingKeys,
  )
}

export function resolveFirebaseCredentialSource(): FirebaseCredentialSource {
  return fromServiceAccountFile() ?? fromEnvironmentVariables() ?? fromAdcIfEnabled() ?? (() => { throw missingConfigurationError() })()
}

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  try {
    const source = resolveFirebaseCredentialSource()
    return { enabled: true, mode: source.mode, missingKeys: [], message: null }
  } catch (error) {
    if (error instanceof FirebaseConfigError) {
      return { enabled: false, mode: null, missingKeys: error.missingKeys, message: error.message }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { enabled: false, mode: null, missingKeys: [], message }
  }
}
