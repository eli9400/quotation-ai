import 'dotenv/config'
import { initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import { trainAndPersistModelV1 } from '../src/services/model-v1-training.service.js'

function parseArgs(): {
  uid: string
  mode: 'activate' | 'canary'
  canaryTrafficPercent: number | undefined
} {
  const uidArg = process.argv.find((arg) => arg.startsWith('--uid='))
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
  const canaryArg = process.argv.find((arg) => arg.startsWith('--canary='))
  const uid = uidArg?.split('=')[1]?.trim() ?? ''
  if (!uid) {
    throw new Error('Missing --uid=<serviceProviderUid>')
  }
  const mode = modeArg?.split('=')[1]?.trim().toLowerCase() === 'canary' ? 'canary' : 'activate'
  const canaryTrafficPercent =
    canaryArg && Number.isFinite(Number(canaryArg.split('=')[1]))
      ? Number(canaryArg.split('=')[1])
      : undefined
  return { uid, mode, canaryTrafficPercent }
}

async function run(): Promise<void> {
  const args = parseArgs()
  if (!initializeFirebaseIfConfigured()) {
    throw new Error('Firebase is not configured')
  }
  const result = await trainAndPersistModelV1(args.uid, {
    rolloutMode: args.mode,
    canaryTrafficPercent: args.canaryTrafficPercent,
  })
  console.log(
    JSON.stringify(
      {
        ok: true,
        serviceProviderUid: args.uid,
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
