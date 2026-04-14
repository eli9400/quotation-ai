import 'dotenv/config'
import { initializeFirebaseIfConfigured, getFirestoreDb } from '../src/config/firebase.js'
import { rebuildPricingItemsFromDataset } from '../src/services/pricing-items-dataset-sync.service.js'
import { getServiceProviderByUid } from '../src/services/service-providers.service.js'
import { refreshTrainingDatasetStatsForServiceProvider } from '../src/services/training-dataset-maintenance.service.js'
import { canonicalizeTrainingItemForIndustry } from '../src/services/training-item-canonicalization.service.js'

const BATCH_LIMIT = 400

function parseUid(argv: string[]): string {
  const fromEquals = argv.find((arg) => arg.startsWith('--uid='))?.split('=')[1]
  if (fromEquals && fromEquals.trim().length > 0) return fromEquals.trim()
  const flagIndex = argv.findIndex((arg) => arg === '--uid')
  if (flagIndex >= 0 && argv[flagIndex + 1]?.trim()) return argv[flagIndex + 1].trim()
  return ''
}

function nowIso(): string {
  return new Date().toISOString()
}

async function main() {
  const uid = parseUid(process.argv.slice(2))
  if (!uid) {
    console.error('Usage: npx tsx scripts/canonicalize-training-dataset.ts --uid=<SERVICE_PROVIDER_UID>')
    process.exit(1)
  }

  if (!initializeFirebaseIfConfigured()) {
    console.error(JSON.stringify({ ok: false, message: 'Firebase is not configured' }, null, 2))
    process.exit(1)
  }

  const db = getFirestoreDb()
  const provider = await getServiceProviderByUid(uid)
  const industry = provider?.industry ?? null

  const snapshot = await db
    .collection('training_dataset_examples')
    .where('serviceProviderUid', '==', uid)
    .get()

  let updatedRows = 0
  let unchangedRows = 0
  const updatedAt = nowIso()

  for (let offset = 0; offset < snapshot.docs.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    let chunkUpdates = 0
    snapshot.docs.slice(offset, offset + BATCH_LIMIT).forEach((doc) => {
      const data = doc.data() as Record<string, unknown>
      const unitRaw = typeof data.unit === 'string' ? data.unit : 'custom'
      const itemNameRaw =
        typeof data.itemName === 'string' && data.itemName.trim().length > 0
          ? data.itemName
          : String((typeof data.itemKey === 'string' ? data.itemKey : '').split('|')[0] ?? '')

      const canonical = canonicalizeTrainingItemForIndustry(itemNameRaw, unitRaw, industry)
      const currentItemKey = typeof data.itemKey === 'string' ? data.itemKey : ''
      const currentItemName = typeof data.itemName === 'string' ? data.itemName : ''

      if (
        currentItemKey === canonical.itemKey &&
        currentItemName === canonical.itemName &&
        unitRaw === canonical.unit
      ) {
        unchangedRows += 1
        return
      }

      updatedRows += 1
      chunkUpdates += 1
      batch.set(
        doc.ref,
        {
          itemKey: canonical.itemKey,
          itemName: canonical.itemName,
          unit: canonical.unit,
          updatedAt,
        },
        { merge: true },
      )
    })
    if (chunkUpdates > 0) {
      await batch.commit()
    }
  }

  const stats = await refreshTrainingDatasetStatsForServiceProvider(uid)
  const rebuild = await rebuildPricingItemsFromDataset(uid)

  console.log(
    JSON.stringify(
      {
        ok: true,
        serviceProviderUid: uid,
        industry,
        scannedRows: snapshot.docs.length,
        updatedRows,
        unchangedRows,
        datasetStats: {
          totalExamples: stats.totalExamples,
          uniqueItems: stats.uniqueItems,
          splitCounts: stats.splitCounts,
        },
        rebuild,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error && error.message.trim().length > 0 ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exit(1)
})
