import 'dotenv/config'
import { env } from '../src/config/env.js'
import { getFirestoreDb, initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import {
  getStoredDocumentsByIds,
  resolveTrainingDocumentIds,
} from '../src/services/documents.service.js'
import {
  DYNAMIC_FORM_SCHEMAS_COLLECTION,
  PRICING_ITEMS_COLLECTION,
} from '../src/services/model-profile.service.js'
import {
  TRAINING_DATASET_COLLECTION,
  TRAINING_DATASET_STATS_COLLECTION,
} from '../src/services/training-dataset.service.js'
import { runLearningTrainingJob } from '../src/services/training-learning.service.js'
import { createTrainingJob, getTrainingJob } from '../src/services/training-jobs.service.js'
import { runWithProgressLogging } from './full-retrain-progress.js'
import type { TrainingDatasetExample } from '../src/types/training-dataset.js'

const BATCH_LIMIT = 400

function parseUidArg(): string {
  const uidArg = process.argv.find((arg) => arg.startsWith('--uid='))
  const uid = uidArg?.split('=')[1]?.trim() ?? ''
  if (!uid) {
    throw new Error('Missing --uid=<serviceProviderUid>')
  }
  return uid
}

function parseKeepApprovedArg(): boolean {
  const keepApprovedArg = process.argv.find((arg) => arg.startsWith('--keepApproved='))
  if (!keepApprovedArg) {
    return true
  }
  return keepApprovedArg.split('=')[1]?.trim().toLowerCase() !== 'false'
}

async function commitDeleteOps(
  operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
): Promise<void> {
  const db = getFirestoreDb()
  for (let offset = 0; offset < operations.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    operations.slice(offset, offset + BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

async function resetLearnedState(
  serviceProviderUid: string,
  keepApprovedExamples: boolean,
): Promise<{
  deletedPricingItems: number
  deletedDatasetExamples: number
  deletedSchema: boolean
  deletedDatasetStats: boolean
}> {
  const db = getFirestoreDb()
  const pricingItemsSnap = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  const datasetSnap = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  const datasetDocs = keepApprovedExamples
    ? datasetSnap.docs.filter((doc) => {
        const data = doc.data() as TrainingDatasetExample
        return data.source === 'uploaded_document'
      })
    : datasetSnap.docs

  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = []
  pricingItemsSnap.docs.forEach((doc) => {
    operations.push((batch) => batch.delete(db.collection(PRICING_ITEMS_COLLECTION).doc(doc.id)))
  })
  datasetDocs.forEach((doc) => {
    operations.push((batch) => batch.delete(db.collection(TRAINING_DATASET_COLLECTION).doc(doc.id)))
  })
  await commitDeleteOps(operations)

  const schemaRef = db.collection(DYNAMIC_FORM_SCHEMAS_COLLECTION).doc(serviceProviderUid)
  const statsRef = db.collection(TRAINING_DATASET_STATS_COLLECTION).doc(serviceProviderUid)
  const [schemaSnap, statsSnap] = await Promise.all([schemaRef.get(), statsRef.get()])
  if (schemaSnap.exists) {
    await schemaRef.delete()
  }
  if (statsSnap.exists) {
    await statsRef.delete()
  }

  return {
    deletedPricingItems: pricingItemsSnap.size,
    deletedDatasetExamples: datasetDocs.length,
    deletedSchema: schemaSnap.exists,
    deletedDatasetStats: statsSnap.exists,
  }
}

function uniqueDocumentIdsByHash(
  docs: Awaited<ReturnType<typeof getStoredDocumentsByIds>>,
): { uniqueIds: string[]; skippedDuplicates: number } {
  const seenHashes = new Set<string>()
  const seenIds = new Set<string>()
  const uniqueIds: string[] = []
  let skippedDuplicates = 0

  docs.forEach((doc) => {
    if (seenIds.has(doc.id)) {
      skippedDuplicates += 1
      return
    }
    const hash = doc.fileHash?.trim() ?? ''
    if (hash) {
      if (seenHashes.has(hash)) {
        skippedDuplicates += 1
        return
      }
      seenHashes.add(hash)
    }
    seenIds.add(doc.id)
    uniqueIds.push(doc.id)
  })

  return { uniqueIds, skippedDuplicates }
}

async function run(): Promise<void> {
  const serviceProviderUid = parseUidArg()
  const keepApprovedExamples = parseKeepApprovedArg()
  if (!initializeFirebaseIfConfigured()) {
    throw new Error('Firebase is not configured')
  }
  console.info(
    `[retrain] openaiConfigured=${Boolean(env.openAiApiKey)} | model=${env.openAiModel}`,
  )

  const allDocumentIds = await resolveTrainingDocumentIds(serviceProviderUid, [])
  if (allDocumentIds.length === 0) {
    throw new Error('No stored documents found for this service provider.')
  }

  const docs = await getStoredDocumentsByIds(serviceProviderUid, allDocumentIds)
  const deduped = uniqueDocumentIdsByHash(docs)
  if (deduped.uniqueIds.length === 0) {
    throw new Error('No valid documents available after duplicate filtering.')
  }

  console.info(
    `[retrain] uid=${serviceProviderUid} | requested=${allDocumentIds.length} | unique=${deduped.uniqueIds.length} | skippedDuplicates=${deduped.skippedDuplicates}`,
  )
  console.info('[retrain] resetting learned collections...')
  const resetResult = await resetLearnedState(serviceProviderUid, keepApprovedExamples)
  console.info(
    `[retrain] reset done | pricing_items=${resetResult.deletedPricingItems} | dataset_examples=${resetResult.deletedDatasetExamples} | schemaDeleted=${resetResult.deletedSchema} | statsDeleted=${resetResult.deletedDatasetStats}`,
  )

  const job = await createTrainingJob(serviceProviderUid, deduped.uniqueIds)
  console.info(`[retrain] training job created: ${job.id}`)
  await runWithProgressLogging(job.id, async () => {
    await runLearningTrainingJob({
      jobId: job.id,
      serviceProviderUid,
      documentIds: deduped.uniqueIds,
      processingDocumentIds: deduped.uniqueIds,
    })
  })

  const finishedJob = await getTrainingJob(job.id)
  console.log(
    JSON.stringify(
      {
        ok: finishedJob?.status === 'completed',
        serviceProviderUid,
        keepApprovedExamples,
        reset: resetResult,
        documentsRequested: allDocumentIds.length,
        documentsProcessed: deduped.uniqueIds.length,
        skippedDuplicates: deduped.skippedDuplicates,
        job: finishedJob,
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
