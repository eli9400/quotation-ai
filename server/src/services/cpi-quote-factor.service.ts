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
  itemQuantities?: Array<{ itemKey: string; quantity: number }>
}

function normalizeItemKeys(itemKeys: string[]): Set<string> {
  return new Set(itemKeys.map((itemKey) => itemKey.trim()).filter((itemKey) => itemKey.length > 0))
}

function chooseSourceYearByFrequency(
  examples: TrainingDatasetExample[],
  itemKeys: Set<string>,
  availableYears: Set<number>,
  targetYear: number,
): number | null {
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
    const rawYear = parseYear(example.sourceQuoteDate)
    if (!rawYear) {
      return
    }

    const year = Math.min(rawYear, targetYear)
    if (!availableYears.has(year)) {
      return
    }
    yearWeights.set(year, (yearWeights.get(year) ?? 0) + 1)
  })

  if (yearWeights.size === 0) {
    return null
  }

  return Array.from(yearWeights.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

function normalizeItemQuantities(
  itemQuantities: ResolveInput['itemQuantities'],
): Array<{ itemKey: string; quantity: number }> {
  if (!itemQuantities || itemQuantities.length === 0) {
    return []
  }

  return itemQuantities
    .map((item) => ({
      itemKey: item.itemKey.trim(),
      quantity: Number(item.quantity),
    }))
    .filter((item) => item.itemKey.length > 0 && Number.isFinite(item.quantity) && item.quantity > 0)
}

function chooseSourceYearByNearestQuantity(
  examples: TrainingDatasetExample[],
  itemQuantities: Array<{ itemKey: string; quantity: number }>,
  availableYears: Set<number>,
  targetYear: number,
): number | null {
  const byItemKey = new Map<string, TrainingDatasetExample[]>()
  for (const example of examples) {
    if (example.source !== 'uploaded_document') {
      continue
    }
    const current = byItemKey.get(example.itemKey) ?? []
    current.push(example)
    byItemKey.set(example.itemKey, current)
  }

  const yearWeights = new Map<number, number>()
  for (const requested of itemQuantities) {
    const candidates = byItemKey.get(requested.itemKey) ?? []
    let bestMatch: { year: number; diff: number } | null = null

    for (const candidate of candidates) {
      const rawYear = parseYear(candidate.sourceQuoteDate)
      if (!rawYear) {
        continue
      }
      const year = Math.min(rawYear, targetYear)
      if (!availableYears.has(year)) {
        continue
      }
      const diff = Math.abs((candidate.quantity ?? 0) - requested.quantity)
      if (!Number.isFinite(diff)) {
        continue
      }
      if (!bestMatch || diff < bestMatch.diff || (diff === bestMatch.diff && year < bestMatch.year)) {
        bestMatch = { year, diff }
      }
    }

    if (!bestMatch) {
      continue
    }
    yearWeights.set(bestMatch.year, (yearWeights.get(bestMatch.year) ?? 0) + 1)
  }

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
  const indices = await getYearlyCpiIndices()
  const targetYear = latestAvailableCpiYear(indices)
  const examples = await listExamples(input.serviceProviderUid)
  const availableYears = new Set(indices.keys())
  const sourceYearFromQuantity = chooseSourceYearByNearestQuantity(
    examples,
    normalizeItemQuantities(input.itemQuantities),
    availableYears,
    targetYear,
  )
  const sourceYear =
    sourceYearFromQuantity ??
    chooseSourceYearByFrequency(examples, normalizeItemKeys(input.itemKeys), availableYears, targetYear)
  if (!sourceYear) {
    return null
  }

  const factor = computeCpiFactor(indices, sourceYear, targetYear)
  return {
    enabled: factor !== 1,
    factor,
    sourceYear,
    targetYear,
  }
}
