const DEFAULT_API_BASE_URL = 'http://localhost:4000/api'

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  firebaseMessagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  firebaseAppId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}
