import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { getFirebaseConfigStatus, initializeFirebaseIfConfigured } from './config/firebase.js'
import { startModelRetrainingScheduler } from './services/model-retraining-scheduler.service.js'

app.listen(env.port, () => {
  try {
    initializeFirebaseIfConfigured()
    console.log('[server] Firebase Admin initialized')
  } catch (error) {
    const status = getFirebaseConfigStatus()
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[server] Firebase initialization failed: ${message}`)
    if (status.missingKeys.length > 0) {
      console.error(`[server] Missing Firebase config keys: ${status.missingKeys.join(', ')}`)
    }
    process.exit(1)
    return
  }
  startModelRetrainingScheduler()
  console.log(`[server] listening on http://localhost:${env.port}`)
})
