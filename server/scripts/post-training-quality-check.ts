import 'dotenv/config'
import { getFirestoreDb, initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from '../src/services/model-profile.service.js'
import { buildPostTrainingQualityAudit, type TrainingQualityExpectations } from '../src/services/post-training-quality-audit.service.js'
import { TRAINING_DATASET_COLLECTION } from '../src/services/training-dataset.service.js'
import { getLatestCompletedTrainingJobByServiceProvider, getTrainingJob } from '../src/services/training-jobs.service.js'
import type { LearnedPricingItem } from '../src/types/model-profile.js'
import type { TrainingDatasetExample } from '../src/types/training-dataset.js'

type Args = {
  uid: string
  jobId: string | null
  expectations: TrainingQualityExpectations
}

function readArg(name: string): string | null {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return withEquals ? withEquals.slice(name.length + 3).trim() : null
}

function readNumber(name: string): number | undefined {
  const raw = readArg(name)
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseArgs(): Args {
  const uid = readArg('uid') ?? ''
  if (!uid) throw new Error('Missing --uid=<serviceProviderUid>')
  return {
    uid,
    jobId: readArg('jobId'),
    expectations: {
      pricingItems: { min: readNumber('minPricingItems'), max: readNumber('maxPricingItems') },
      datasetRows: { min: readNumber('minDatasetRows'), max: readNumber('maxDatasetRows') },
      uniqueItemKeys: { min: readNumber('minItemKeys'), max: readNumber('maxItemKeys') },
    },
  }
}

function compactExpectations(expectations: TrainingQualityExpectations): TrainingQualityExpectations {
  const result: TrainingQualityExpectations = {}
  if (expectations.pricingItems?.min !== undefined || expectations.pricingItems?.max !== undefined) {
    result.pricingItems = expectations.pricingItems
  }
  if (expectations.datasetRows?.min !== undefined || expectations.datasetRows?.max !== undefined) {
    result.datasetRows = expectations.datasetRows
  }
  if (expectations.uniqueItemKeys?.min !== undefined || expectations.uniqueItemKeys?.max !== undefined) {
    result.uniqueItemKeys = expectations.uniqueItemKeys
  }
  return result
}

async function listPricingItems(serviceProviderUid: string): Promise<LearnedPricingItem[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs.map((doc) => doc.data() as LearnedPricingItem)
}

async function listDatasetExamples(serviceProviderUid: string): Promise<TrainingDatasetExample[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs.map((doc) => doc.data() as TrainingDatasetExample)
}

async function resolveJob(serviceProviderUid: string, jobId: string | null) {
  if (jobId) {
    return getTrainingJob(jobId)
  }
  return getLatestCompletedTrainingJobByServiceProvider(serviceProviderUid)
}

async function run(): Promise<void> {
  const args = parseArgs()
  if (!initializeFirebaseIfConfigured()) {
    throw new Error('Firebase is not configured')
  }

  const [pricingItems, datasetExamples, job] = await Promise.all([
    listPricingItems(args.uid),
    listDatasetExamples(args.uid),
    resolveJob(args.uid, args.jobId),
  ])
  const report = buildPostTrainingQualityAudit({
    serviceProviderUid: args.uid,
    pricingItems,
    datasetExamples,
    job,
    expectations: compactExpectations(args.expectations),
  })

  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.ok ? 0 : 1
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exitCode = 1
})
