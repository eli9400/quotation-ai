import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import { buildDatasetFingerprint, buildDatasetVersionId } from './training-dataset-governance.service.js'
import { buildTrainingDatasetStats } from './training-dataset-stats.service.js'
import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'
import {
  TRAINING_DATASET_COLLECTION,
  TRAINING_DATASET_STATS_COLLECTION,
} from './training-dataset.service.js'
import type { StoredQuote } from '../types/quote.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

const BATCH_LIMIT = 450

function nowIso(): string {
  return new Date().toISOString()
}

function toExampleId(serviceProviderUid: string, quoteId: string, lineId: string): string {
  const raw = `${serviceProviderUid}|${quoteId}|${lineId}`
  const digest = createHash('sha1').update(raw).digest('hex').slice(0, 24)
  return `${serviceProviderUid}_${digest}`
}

function toDynamicFeatures(quote: StoredQuote) {
  const values: Record<string, string | number | boolean | null> = {}
  const visibility: Record<string, boolean> = {}
  quote.quote.customFields.forEach((field) => {
    values[field.key] = field.value
    visibility[field.key] = field.showInQuoteDetails
  })
  return { values, visibility }
}

export function buildApprovedQuoteTrainingExamples(
  quote: StoredQuote,
  industry: string | null,
  timestamp: string = nowIso(),
): TrainingDatasetExample[] {
  const dynamic = toDynamicFeatures(quote)

  return quote.quote.lineItems.map((line) => {
    const canonical = canonicalizeTrainingItemForIndustry(line.description, line.unit, industry)
    return {
      id: toExampleId(quote.serviceProviderUid, quote.id, line.id),
      serviceProviderUid: quote.serviceProviderUid,
      source: 'approved_quote',
      sourceDocumentId: null,
      sourceQuoteDate: quote.createdAt.slice(0, 10),
      sourceQuoteId: quote.id,
      sourceTrainingJobId: quote.trainingJobId,
      itemKey: canonical.itemKey,
      itemName: canonical.itemName,
      unit: canonical.unit,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      targetUnitPrice: line.unitPrice,
      featureProjectType: quote.clientRequest.projectType,
      featureScope: quote.clientRequest.scope,
      featureUrgency: quote.clientRequest.urgency,
      featureRequirements: quote.clientRequest.requirements,
      featureInventorySurplus: null,
      featureAvailableWorkers: null,
      featureDynamicValues: { ...dynamic.values },
      featureDynamicVisibility: { ...dynamic.visibility },
      split: 'train',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
}

async function listProviderExamples(serviceProviderUid: string): Promise<TrainingDatasetExample[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs.map((doc) => doc.data() as TrainingDatasetExample)
}

async function commitInBatches(
  operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
): Promise<void> {
  const db = getFirestoreDb()
  for (let offset = 0; offset < operations.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    operations.slice(offset, offset + BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

async function refreshStats(serviceProviderUid: string): Promise<void> {
  const db = getFirestoreDb()
  const examples = await listProviderExamples(serviceProviderUid)
  const generatedAt = nowIso()
  const datasetFingerprint = buildDatasetFingerprint(examples)
  const datasetVersionId = buildDatasetVersionId(datasetFingerprint)
  const stats = buildTrainingDatasetStats(serviceProviderUid, examples, {
    datasetFingerprint,
    datasetVersionId,
    generatedAt,
  })
  await db.collection(TRAINING_DATASET_STATS_COLLECTION).doc(serviceProviderUid).set(stats)
}

async function deleteQuoteExamples(serviceProviderUid: string, quoteId: string): Promise<void> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('source', '==', 'approved_quote')
    .where('sourceQuoteId', '==', quoteId)
    .get()

  const operations = snapshot.docs.map((doc) => (batch: FirebaseFirestore.WriteBatch) => {
    batch.delete(doc.ref)
  })
  await commitInBatches(operations)
}

export async function syncApprovedQuoteToTrainingDataset(quote: StoredQuote): Promise<void> {
  await deleteQuoteExamples(quote.serviceProviderUid, quote.id)
  const serviceProvider = await getServiceProviderByUid(quote.serviceProviderUid)
  const examples = buildApprovedQuoteTrainingExamples(quote, serviceProvider?.industry ?? null)
  const db = getFirestoreDb()
  const operations = examples.map((example) => (batch: FirebaseFirestore.WriteBatch) => {
    batch.set(db.collection(TRAINING_DATASET_COLLECTION).doc(example.id), example)
  })
  await commitInBatches(operations)
  await refreshStats(quote.serviceProviderUid)
}

export async function removeApprovedQuoteFromTrainingDataset(
  serviceProviderUid: string,
  quoteId: string,
): Promise<void> {
  await deleteQuoteExamples(serviceProviderUid, quoteId)
  await refreshStats(serviceProviderUid)
}
