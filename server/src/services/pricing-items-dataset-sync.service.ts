import { getFirestoreDb } from '../config/firebase.js'
import { buildDynamicFormSchema } from './dynamic-form-schema.service.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import { learnPricingItemsFromObservations } from './pricing-items-learning.service.js'
import {
  resolveExampleWeight,
  toExampleTimestamp,
} from './pricing-items-dataset-weighting.service.js'
import { normalizePricingItemsForServiceProvider } from './pricing-items-normalization.service.js'
import { TRAINING_DATASET_COLLECTION } from './training-dataset.service.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

const BATCH_LIMIT = 400

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function toCanonicalName(example: TrainingDatasetExample): string {
  const fromName = normalizeName(example.itemName ?? '')
  if (fromName.length > 0) {
    return fromName
  }
  const fromKey = normalizeName(String(example.itemKey ?? '').split('|')[0] ?? '')
  return fromKey
}

function isKnownUnit(unit: TrainingDatasetExample['unit']): unit is PricingUnit {
  return (
    unit === 'sqm' ||
    unit === 'unit' ||
    unit === 'point' ||
    unit === 'day' ||
    unit === 'container' ||
    unit === 'package' ||
    unit === 'hour' ||
    unit === 'meter' ||
    unit === 'fixed' ||
    unit === 'percent' ||
    unit === 'unknown'
  )
}

function toSourceDocumentId(example: TrainingDatasetExample): string {
  if (example.sourceDocumentId && example.sourceDocumentId.trim().length > 0) {
    return example.sourceDocumentId
  }
  if (example.sourceQuoteId && example.sourceQuoteId.trim().length > 0) {
    return `approved:${example.sourceQuoteId}`
  }
  return `dataset:${example.id}`
}

function toObservation(
  example: TrainingDatasetExample,
): PricingObservation | null {
  const canonicalName = toCanonicalName(example)
  if (!canonicalName) {
    return null
  }
  if (!isKnownUnit(example.unit) || example.unit === 'unknown' || example.unit === 'percent') {
    return null
  }
  if (!Number.isFinite(example.quantity) || !Number.isFinite(example.targetUnitPrice)) {
    return null
  }
  if (example.quantity <= 0 || example.targetUnitPrice <= 0) {
    return null
  }

  const lineTotal =
    Number.isFinite(example.lineTotal) && example.lineTotal > 0
      ? example.lineTotal
      : example.quantity * example.targetUnitPrice

  return {
    sourceDocumentId: toSourceDocumentId(example),
    sourceQuoteDate: example.sourceQuoteDate,
    sourceLine: canonicalName,
    rawName: canonicalName,
    canonicalName,
    unit: example.unit,
    quantity: example.quantity,
    pricePerUnit: example.targetUnitPrice,
    lineTotal,
    cpiAdjustmentFactor: 1,
    vatMode: 'unknown',
    vatRate: null,
    materialsMode: 'unknown',
    discountPercent: null,
    discountAmount: null,
  }
}

function expandWeightedObservations(examples: TrainingDatasetExample[]): PricingObservation[] {
  const latestTimestamp = examples.reduce(
    (latest, example) => Math.max(latest, toExampleTimestamp(example)),
    0,
  )
  const weighted: PricingObservation[] = []
  examples.forEach((example) => {
    const observation = toObservation(example)
    if (!observation) {
      return
    }
    const weight = resolveExampleWeight(example, latestTimestamp)
    for (let index = 0; index < weight; index += 1) {
      weighted.push(observation)
    }
  })
  return weighted
}

async function listExamples(serviceProviderUid: string): Promise<TrainingDatasetExample[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs
    .map((doc) => doc.data() as TrainingDatasetExample)
    .sort((left, right) => {
      const leftTs = toExampleTimestamp(left)
      const rightTs = toExampleTimestamp(right)
      if (leftTs !== rightTs) return leftTs - rightTs
      return left.id.localeCompare(right.id)
    })
}

async function deletePricingItemsByServiceProvider(serviceProviderUid: string): Promise<void> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  for (let offset = 0; offset < snapshot.docs.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    snapshot.docs.slice(offset, offset + BATCH_LIMIT).forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
  }
}

export type RebuildPricingItemsFromDatasetResult = {
  examplesCount: number
  observationsCount: number
  learnedItems: number
  schemaFields: number
}

export async function rebuildPricingItemsFromDataset(
  serviceProviderUid: string,
): Promise<RebuildPricingItemsFromDatasetResult> {
  const examples = await listExamples(serviceProviderUid)
  const weightedObservations = expandWeightedObservations(examples)

  await deletePricingItemsByServiceProvider(serviceProviderUid)

  let learnedItems = 0
  if (weightedObservations.length > 0) {
    const learnResult = await learnPricingItemsFromObservations(
      serviceProviderUid,
      weightedObservations,
    )
    learnedItems = learnResult.learnedItems
    await normalizePricingItemsForServiceProvider(serviceProviderUid)
  }

  const schema = await buildDynamicFormSchema(serviceProviderUid)
  return {
    examplesCount: examples.length,
    observationsCount: weightedObservations.length,
    learnedItems,
    schemaFields: schema.fields.length,
  }
}
