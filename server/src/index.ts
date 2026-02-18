import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { getFirebaseConfigStatus, initializeFirebaseIfConfigured } from './config/firebase.js'

app.listen(env.port, () => {
  const firebaseEnabled = initializeFirebaseIfConfigured()
  if (firebaseEnabled) {
    console.log('[server] Firebase Admin initialized')
  } else {
    const status = getFirebaseConfigStatus()
    console.log(
      `[server] Firebase not configured yet (missing: ${status.missingKeys.join(', ')})`,
    )
  }
  console.log(`[server] listening on http://localhost:${env.port}`)
})
