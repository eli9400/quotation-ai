import 'dotenv/config'
import { initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import { buildDynamicFormSchema } from '../src/services/dynamic-form-schema.service.js'
import { normalizePricingItemsForServiceProvider } from '../src/services/pricing-items-normalization.service.js'

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

  const normalized = await normalizePricingItemsForServiceProvider(uid)
  const schema = await buildDynamicFormSchema(uid)
  console.log(
    JSON.stringify(
      {
        ok: true,
        uid,
        pricingItemsBefore: normalized.before,
        pricingItemsAfter: normalized.after,
        mergedGroups: normalized.mergedGroups,
        removedDuplicates: normalized.removedDuplicates,
        removedNoise: normalized.removedNoise,
        schemaDynamicFields: schema.fields.filter((field) => field.sourceItemId !== null).length,
        schemaGeneratedAt: schema.generatedAt,
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
