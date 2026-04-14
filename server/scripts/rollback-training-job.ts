import 'dotenv/config'
import { getFirestoreDb, initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import { deleteStoredDocument } from '../src/services/documents.service.js'
import { rebuildPricingItemsFromDataset } from '../src/services/pricing-items-dataset-sync.service.js'
import { refreshTrainingDatasetStatsForServiceProvider } from '../src/services/training-dataset-maintenance.service.js'
import { TRAINING_DATASET_COLLECTION } from '../src/services/training-dataset.service.js'

const TRAINING_JOBS_COLLECTION = 'training_jobs'
const BATCH_LIMIT = 400

type TrainingJobLike = {
  serviceProviderUid?: string
  contractorUid?: string
  documentIds?: string[]
}

function getArg(name: string): string | null {
  const prefix = `--${name}=`
  const direct = process.argv.find((arg) => arg.startsWith(prefix))
  if (direct) return direct.slice(prefix.length).trim()
  const index = process.argv.findIndex((arg) => arg === `--${name}`)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1].trim()
  return null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function toUniqueDocumentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return Array.from(new Set(ids))
}

async function deleteDocsInBatches(
  refs: FirebaseFirestore.DocumentReference[],
): Promise<void> {
  const db = getFirestoreDb()
  for (let offset = 0; offset < refs.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    refs.slice(offset, offset + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function deleteUploadedFilesAndMetadata(
  serviceProviderUid: string,
  documentIds: string[],
): Promise<{ requested: number; deleted: number }> {
  let deleted = 0
  for (const documentId of documentIds) {
    const ok = await deleteStoredDocument(serviceProviderUid, documentId)
    if (ok) deleted += 1
  }
  return {
    requested: documentIds.length,
    deleted,
  }
}

async function main(): Promise<void> {
  const jobId = getArg('jobId')
  const dryRun = hasFlag('dry-run')
  const keepFiles = hasFlag('keep-files')
  const keepJob = hasFlag('keep-job')
  if (!jobId) {
    throw new Error('Missing required --jobId argument.')
  }

  const initialized = initializeFirebaseIfConfigured()
  if (!initialized) {
    throw new Error('Firebase is not configured in this environment.')
  }

  const db = getFirestoreDb()
  const jobSnap = await db.collection(TRAINING_JOBS_COLLECTION).doc(jobId).get()
  if (!jobSnap.exists) {
    throw new Error(`Training job not found: ${jobId}`)
  }

  const job = jobSnap.data() as TrainingJobLike
  const serviceProviderUid = (job.serviceProviderUid ?? job.contractorUid ?? '').trim()
  if (!serviceProviderUid) {
    throw new Error(`Training job ${jobId} is missing serviceProviderUid.`)
  }

  const targetDocumentIds = toUniqueDocumentIds(job.documentIds)
  if (targetDocumentIds.length === 0) {
    throw new Error(`Training job ${jobId} has no documentIds.`)
  }

  const targetSet = new Set(targetDocumentIds)
  const providerExamplesSnap = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  const docsToDelete = providerExamplesSnap.docs.filter((doc) => {
    const data = doc.data() as { source?: unknown; sourceDocumentId?: unknown }
    return (
      data.source === 'uploaded_document' &&
      typeof data.sourceDocumentId === 'string' &&
      targetSet.has(data.sourceDocumentId)
    )
  })

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          jobId,
          serviceProviderUid,
          jobDocumentIds: targetDocumentIds.length,
          datasetRowsToDelete: docsToDelete.length,
          filesWillBeDeleted: !keepFiles,
          trainingJobRecordWillBeDeleted: !keepJob,
        },
        null,
        2,
      ),
    )
    return
  }

  await deleteDocsInBatches(docsToDelete.map((doc) => doc.ref))
  const filesResult = keepFiles
    ? { requested: targetDocumentIds.length, deleted: 0 }
    : await deleteUploadedFilesAndMetadata(serviceProviderUid, targetDocumentIds)

  if (!keepJob) {
    await db.collection(TRAINING_JOBS_COLLECTION).doc(jobId).delete()
  }

  const stats = await refreshTrainingDatasetStatsForServiceProvider(serviceProviderUid)
  const rebuild = await rebuildPricingItemsFromDataset(serviceProviderUid)

  console.log(
    JSON.stringify(
      {
        ok: true,
        jobId,
        serviceProviderUid,
        deletedDatasetRows: docsToDelete.length,
        deletedFilesAndDocumentRecords: filesResult,
        deletedTrainingJobRecord: !keepJob,
        datasetStats: {
          totalExamples: stats.totalExamples,
          uniqueItems: stats.uniqueItems,
          uploadedDocuments: stats.uploadedDocuments,
          approvedQuotes: stats.approvedQuotes,
        },
        pricingItemsRebuild: rebuild,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exitCode = 1
})
