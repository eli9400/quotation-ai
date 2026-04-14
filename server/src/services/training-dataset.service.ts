import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { shouldKeepPricingObservation } from './pricing-items-learning.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import {
  buildDynamicFeaturePayload,
  listServiceProviderFeatures,
} from './service-provider-features.service.js'
import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'
import {
  assignDatasetSplitsByItemDocument,
  resolveObservationSplit,
} from './training-dataset-split.service.js'
import {
  buildDatasetFingerprint,
  buildDatasetVersionId,
} from './training-dataset-governance.service.js'
import { buildTrainingDatasetStats } from './training-dataset-stats.service.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type {
  RebuildTrainingDatasetResult,
  TrainingDatasetExample,
  TrainingDatasetStats,
} from '../types/training-dataset.js'

export const TRAINING_DATASET_COLLECTION = 'training_dataset_examples'
export const TRAINING_DATASET_STATS_COLLECTION = 'training_dataset_stats'

const BATCH_LIMIT = 450

type RebuildInput = {
  serviceProviderUid: string
  trainingJobId: string
  observations: PricingObservation[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function sanitizeObservations(observations: PricingObservation[]): PricingObservation[] {
  return observations.filter((observation) => {
    if (!shouldKeepPricingObservation(observation)) {
      return false
    }
    if (!observation.canonicalName.trim() || !observation.sourceDocumentId.trim()) {
      return false
    }
    if (!Number.isFinite(observation.quantity) || !Number.isFinite(observation.pricePerUnit)) {
      return false
    }
    return observation.quantity > 0 && observation.pricePerUnit > 0
  })
}

function buildExampleId(
  serviceProviderUid: string,
  observation: PricingObservation,
  duplicateIndex: number,
): string {
  const raw = [
    serviceProviderUid,
    observation.sourceDocumentId,
    observation.canonicalName,
    observation.unit,
    observation.quantity,
    observation.pricePerUnit,
    observation.lineTotal,
    observation.sourceLine,
    duplicateIndex,
  ].join('|')
  const digest = createHash('sha1').update(raw).digest('hex').slice(0, 24)
  return `${serviceProviderUid}_${digest}`
}

function toExamples(
  serviceProviderUid: string,
  trainingJobId: string,
  observations: PricingObservation[],
  dynamicFeatures: ReturnType<typeof buildDynamicFeaturePayload>,
  industry: string | null,
): TrainingDatasetExample[] {
  const splitAssignment = assignDatasetSplitsByItemDocument(observations)
  const duplicateCounter = new Map<string, number>()
  const timestamp = nowIso()

  return observations.map((observation) => {
    const duplicateKey = [
      observation.sourceDocumentId,
      observation.canonicalName,
      observation.unit,
      observation.quantity,
      observation.pricePerUnit,
      observation.lineTotal,
      observation.sourceLine,
    ].join('|')
    const duplicateIndex = (duplicateCounter.get(duplicateKey) ?? 0) + 1
    duplicateCounter.set(duplicateKey, duplicateIndex)

    const lineTotal =
      observation.lineTotal > 0 ? observation.lineTotal : observation.quantity * observation.pricePerUnit
    const canonical = canonicalizeTrainingItemForIndustry(
      observation.canonicalName,
      observation.unit,
      industry,
    )

    return {
      id: buildExampleId(serviceProviderUid, observation, duplicateIndex),
      serviceProviderUid,
      source: 'uploaded_document',
      sourceDocumentId: observation.sourceDocumentId,
      sourceQuoteDate: observation.sourceQuoteDate,
      sourceQuoteId: null,
      sourceTrainingJobId: trainingJobId,
      itemKey: canonical.itemKey,
      itemName: canonical.itemName,
      unit: canonical.unit,
      quantity: observation.quantity,
      lineTotal,
      targetUnitPrice: observation.pricePerUnit,
      featureProjectType: null,
      featureScope: null,
      featureUrgency: null,
      featureRequirements: null,
      featureInventorySurplus: null,
      featureAvailableWorkers: null,
      featureDynamicValues: { ...dynamicFeatures.values },
      featureDynamicVisibility: { ...dynamicFeatures.visibility },
      split: resolveObservationSplit(splitAssignment, observation),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
}

async function listExamplesByServiceProvider(
  serviceProviderUid: string,
): Promise<TrainingDatasetExample[]> {
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

async function deleteExamplesByDocumentIds(
  serviceProviderUid: string,
  sourceDocumentIds: string[],
): Promise<void> {
  const documentIdSet = new Set(sourceDocumentIds.filter((id) => id.trim().length > 0))
  if (documentIdSet.size === 0) {
    return
  }

  const db = getFirestoreDb()
  const existing = await listExamplesByServiceProvider(serviceProviderUid)
  const operations = existing
    .filter(
      (example) =>
        example.source === 'uploaded_document' &&
        example.sourceDocumentId !== null &&
        documentIdSet.has(example.sourceDocumentId),
    )
    .map((example) => (batch: FirebaseFirestore.WriteBatch) => {
      batch.delete(db.collection(TRAINING_DATASET_COLLECTION).doc(example.id))
    })
  await commitInBatches(operations)
}

export async function rebuildTrainingDatasetFromObservations(
  input: RebuildInput,
): Promise<RebuildTrainingDatasetResult> {
  const filtered = sanitizeObservations(input.observations)
  const generatedAt = nowIso()
  if (filtered.length === 0) {
    const existing = await listExamplesByServiceProvider(input.serviceProviderUid)
    const datasetFingerprint = buildDatasetFingerprint(existing)
    const datasetVersionId = buildDatasetVersionId(datasetFingerprint)
    const stats = buildTrainingDatasetStats(input.serviceProviderUid, existing, {
      datasetFingerprint,
      datasetVersionId,
      generatedAt,
    })
    return {
      totalExamples: stats.totalExamples,
      splitCounts: stats.splitCounts,
      uniqueItems: stats.uniqueItems,
      sourceCounts: stats.sourceCounts,
      unitDistribution: stats.unitDistribution,
      datasetFingerprint: stats.datasetFingerprint,
      datasetVersionId: stats.datasetVersionId,
      generatedAt: stats.generatedAt,
    }
  }

  const [featureDefinitions, serviceProvider] = await Promise.all([
    listServiceProviderFeatures(input.serviceProviderUid),
    getServiceProviderByUid(input.serviceProviderUid),
  ])
  const dynamicFeatures = buildDynamicFeaturePayload(featureDefinitions)
  const examples = toExamples(
    input.serviceProviderUid,
    input.trainingJobId,
    filtered,
    dynamicFeatures,
    serviceProvider?.industry ?? null,
  )
  const db = getFirestoreDb()
  const sourceDocumentIds = Array.from(new Set(filtered.map((observation) => observation.sourceDocumentId)))

  await deleteExamplesByDocumentIds(input.serviceProviderUid, sourceDocumentIds)
  const writes = examples.map((example) => (batch: FirebaseFirestore.WriteBatch) => {
    batch.set(db.collection(TRAINING_DATASET_COLLECTION).doc(example.id), example)
  })
  await commitInBatches(writes)

  const allExamples = await listExamplesByServiceProvider(input.serviceProviderUid)
  const datasetFingerprint = buildDatasetFingerprint(allExamples)
  const datasetVersionId = buildDatasetVersionId(datasetFingerprint)
  const stats = buildTrainingDatasetStats(input.serviceProviderUid, allExamples, {
    datasetFingerprint,
    datasetVersionId,
    generatedAt,
  })
  await db.collection(TRAINING_DATASET_STATS_COLLECTION).doc(input.serviceProviderUid).set(stats)

  return {
    totalExamples: stats.totalExamples,
    splitCounts: stats.splitCounts,
    uniqueItems: stats.uniqueItems,
    sourceCounts: stats.sourceCounts,
    unitDistribution: stats.unitDistribution,
    datasetFingerprint: stats.datasetFingerprint,
    datasetVersionId: stats.datasetVersionId,
    generatedAt: stats.generatedAt,
  }
}

export async function getTrainingDatasetStats(
  serviceProviderUid: string,
): Promise<TrainingDatasetStats | null> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_STATS_COLLECTION)
    .doc(serviceProviderUid)
    .get()
  if (!snapshot.exists) {
    return null
  }
  return snapshot.data() as TrainingDatasetStats
}

export async function listUploadedDocumentIdsInDataset(
  serviceProviderUid: string,
): Promise<string[]> {
  const examples = await listExamplesByServiceProvider(serviceProviderUid)
  return Array.from(
    new Set(
      examples
        .filter((example) => example.source === 'uploaded_document' && example.sourceDocumentId)
      .map((example) => example.sourceDocumentId as string),
    ),
  )
}

export async function listTrainingDatasetExamples(
  serviceProviderUid: string,
): Promise<TrainingDatasetExample[]> {
  return listExamplesByServiceProvider(serviceProviderUid)
}
