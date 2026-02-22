import { getFirestoreDb } from '../config/firebase.js'
import { computeCpiFactor, getYearlyCpiIndices, latestAvailableCpiYear, parseYear } from './cpi-adjustment.service.js'
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

function normalizeItemQuantities(
  itemQuantities: ResolveInput['itemQuantities'],
): Array<{ itemKey: string; quantity: number }> {
  if (!itemQuantities || itemQuantities.length === 0) {
    return []
  }
  return itemQuantities
    .map((item) => ({ itemKey: item.itemKey.trim(), quantity: Number(item.quantity) }))
    .filter((item) => item.itemKey.length > 0 && Number.isFinite(item.quantity) && item.quantity > 0)
}

function sourceWeight(example: TrainingDatasetExample): number {
  return example.source === 'approved_quote' ? 1.45 : 1
}

function recencyWeight(year: number, targetYear: number): number {
  const gap = Math.max(0, targetYear - year)
  return 1 / (1 + gap * 0.85)
}

function addYearScore(scores: Map<number, number>, year: number, score: number): void {
  scores.set(year, (scores.get(year) ?? 0) + score)
}

function pickBestYear(scores: Map<number, number>): number | null {
  if (scores.size === 0) return null
  return Array.from(scores.entries()).sort((left, right) => right[1] - left[1] || right[0] - left[0])[0][0]
}

function scoreYearsByNearestQuantity(
  examples: TrainingDatasetExample[],
  itemQuantities: Array<{ itemKey: string; quantity: number }>,
  availableYears: Set<number>,
  targetYear: number,
): number | null {
  if (itemQuantities.length === 0) return null
  const byItemKey = new Map<string, TrainingDatasetExample[]>()
  examples.forEach((example) => {
    const current = byItemKey.get(example.itemKey) ?? []
    current.push(example)
    byItemKey.set(example.itemKey, current)
  })

  const yearScores = new Map<number, number>()
  itemQuantities.forEach((requested) => {
    const candidates = byItemKey.get(requested.itemKey) ?? []
    candidates.forEach((candidate) => {
      const rawYear = parseYear(candidate.sourceQuoteDate)
      if (!rawYear) return
      const year = Math.min(rawYear, targetYear)
      if (!availableYears.has(year)) return
      const quantityDiff = Math.abs((candidate.quantity ?? 0) - requested.quantity)
      const similarityWeight = 1 / (1 + quantityDiff)
      const score = sourceWeight(candidate) * recencyWeight(year, targetYear) * similarityWeight
      addYearScore(yearScores, year, score)
    })
  })

  return pickBestYear(yearScores)
}

function scoreYearsByFrequency(
  examples: TrainingDatasetExample[],
  itemKeys: Set<string>,
  availableYears: Set<number>,
  targetYear: number,
): number | null {
  const relevant = examples.filter((example) => itemKeys.size === 0 || itemKeys.has(example.itemKey))
  const yearScores = new Map<number, number>()
  relevant.forEach((example) => {
    const rawYear = parseYear(example.sourceQuoteDate)
    if (!rawYear) return
    const year = Math.min(rawYear, targetYear)
    if (!availableYears.has(year)) return
    const score = sourceWeight(example) * recencyWeight(year, targetYear)
    addYearScore(yearScores, year, score)
  })
  return pickBestYear(yearScores)
}

async function listExamples(serviceProviderUid: string): Promise<TrainingDatasetExample[]> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(TRAINING_DATASET_COLLECTION).where('serviceProviderUid', '==', serviceProviderUid).get()
  return snapshot.docs.map((doc) => doc.data() as TrainingDatasetExample)
}

export async function resolveCpiAdjustmentForQuote(input: ResolveInput): Promise<QuoteCpiAdjustment | null> {
  const indices = await getYearlyCpiIndices()
  const targetYear = latestAvailableCpiYear(indices)
  const availableYears = new Set(indices.keys())
  const examples = await listExamples(input.serviceProviderUid)

  const sourceYear =
    scoreYearsByNearestQuantity(examples, normalizeItemQuantities(input.itemQuantities), availableYears, targetYear) ??
    scoreYearsByFrequency(examples, normalizeItemKeys(input.itemKeys), availableYears, targetYear)

  if (!sourceYear || sourceYear >= targetYear) {
    return null
  }

  const factor = computeCpiFactor(indices, sourceYear, targetYear)
  if (!Number.isFinite(factor) || Math.abs(1 - factor) < 0.005) {
    return null
  }

  return {
    enabled: true,
    factor,
    sourceYear,
    targetYear,
  }
}
