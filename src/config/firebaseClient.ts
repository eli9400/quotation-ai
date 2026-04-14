import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { env } from './env'

const firebaseApp = initializeApp({
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
})

export const firebaseAuth = getAuth(firebaseApp)
