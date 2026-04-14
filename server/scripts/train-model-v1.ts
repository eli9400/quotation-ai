import 'dotenv/config'
import { initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import { trainAndPersistModelV1 } from '../src/services/model-v1-training.service.js'

function parseUidArg(): string {
  const uidArg = process.argv.find((arg) => arg.startsWith('--uid='))
  const uid = uidArg?.split('=')[1]?.trim() ?? ''
  if (!uid) {
    throw new Error('Missing --uid=<serviceProviderUid>')
  }
  return uid
}

async function run(): Promise<void> {
  const uid = parseUidArg()
  if (!initializeFirebaseIfConfigured()) {
    throw new Error('Firebase is not configured')
  }
  const result = await trainAndPersistModelV1(uid)
  console.log(
    JSON.stringify(
      {
        ok: true,
        serviceProviderUid: uid,
        ...result,
      },
      null,
      2,
    ),
  )
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exitCode = 1
})
