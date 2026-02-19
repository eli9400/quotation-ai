import { getFirestoreDb } from '../config/firebase.js'
import {
  computeCpiFactor,
  getYearlyCpiIndices,
  latestAvailableCpiYear,
  parseYear,
} from './cpi-adjustment.service.js'
import type { QuoteCpiAdjustment } from '../types/quote.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

const TRAINING_DATASET_COLLECTION = 'training_dataset_examples'

type ResolveInput = {
  serviceProviderUid: string
  itemKeys: string[]
}

function normalizeItemKeys(itemKeys: string[]): Set<string> {
  return new Set(itemKeys.map((itemKey) => itemKey.trim()).filter((itemKey) => itemKey.length > 0))
}

function chooseSourceYear(examples: TrainingDatasetExample[], itemKeys: Set<string>): number | null {
  const filtered = examples.filter((example) => {
    if (example.source !== 'uploaded_document') {
      return false
    }
    if (itemKeys.size === 0) {
      return true
    }
    return itemKeys.has(example.itemKey)
  })

  const yearWeights = new Map<number, number>()
  filtered.forEach((example) => {
    const year = parseYear(example.sourceQuoteDate)
    if (!year) {
      return
    }
    yearWeights.set(year, (yearWeights.get(year) ?? 0) + 1)
  })

  if (yearWeights.size === 0) {
    return null
  }

  return Array.from(yearWeights.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

async function listExamples(serviceProviderUid: string): Promise<TrainingDatasetExample[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs.map((doc) => doc.data() as TrainingDatasetExample)
}

export async function resolveCpiAdjustmentForQuote(
  input: ResolveInput,
): Promise<QuoteCpiAdjustment | null> {
  const examples = await listExamples(input.serviceProviderUid)
  const sourceYear = chooseSourceYear(examples, normalizeItemKeys(input.itemKeys))
  if (!sourceYear) {
    return null
  }

  const indices = await getYearlyCpiIndices()
  const targetYear = latestAvailableCpiYear(indices)
  const factor = computeCpiFactor(indices, sourceYear, targetYear)
  return {
    enabled: factor !== 1,
    factor,
    sourceYear,
    targetYear,
  }
}
