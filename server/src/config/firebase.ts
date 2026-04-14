import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getFirebaseConfigStatus, resolveFirebaseCredentialSource } from './firebase-admin-credentials.js'

export { getFirebaseConfigStatus }

export function initializeFirebaseIfConfigured(options: { throwOnError?: boolean } = {}): boolean {
  const throwOnError = options.throwOnError ?? true
  try {
    const source = resolveFirebaseCredentialSource()
    if (getApps().length === 0) {
      if (source.mode === 'application_default') {
        initializeApp({
          credential: applicationDefault(),
          projectId: source.projectId,
          storageBucket: source.storageBucket,
        })
      } else {
        initializeApp({
          credential: cert({
            projectId: source.projectId,
            clientEmail: source.clientEmail,
            privateKey: source.privateKey,
          }),
          storageBucket: source.storageBucket,
        })
      }
    }
    return true
  } catch (error) {
    if (throwOnError) throw error
    return false
  }
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
