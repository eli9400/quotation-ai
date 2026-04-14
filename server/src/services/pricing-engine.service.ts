import { estimateUnitPriceLinear, exactMatchUnitPrice } from './line-pricing-utils.service.js'
import {
  estimateBinnedMedianPrice,
  resolveExamples,
  resolvePriceStats,
  round2,
  similarity,
  toItemKey,
  tokenize,
} from './pricing-engine-utils.service.js'
import { getTrainingDatasetStats } from './training-dataset.service.js'
import type { LearnedPricingItem, PricingUnit } from '../types/model-profile.js'
import type { QuoteRequestedItem } from '../types/quote.js'

export type PricingCoverageTier = 'high' | 'medium' | 'low'

export type GroundedPriceStats = {
  min: number
  median: number
  avg: number
  max: number
}

export type GroundedPriceCoverage = {
  sampleCount: number
  exampleCount: number
  documentCount: number
  tier: PricingCoverageTier
}

export type GroundedPriceExample = {
  quantity: number
  unitPrice: number
}

export type GroundedPricingMethod =
  | 'exact_match'
  | 'binned_median'
  | 'median_low_coverage'
  | 'similar_item_fallback'
  | 'trend_fallback'

export type GroundedPricingLine = {
  id: string
  sourceItemId: string
  itemKey: string
  description: string
  unit: PricingUnit
  quantity: number
  baseUnitPrice: number
  baseLineTotal: number
  priceStats: GroundedPriceStats
  coverage: GroundedPriceCoverage
  pricingMethod: GroundedPricingMethod
  sourceExamples: GroundedPriceExample[]
  needsManualReview: boolean
  referenceItemKey: string | null
}

export type BuildGroundedPricingResult = {
  lines: GroundedPricingLine[]
  skippedSourceItemIds: string[]
}

type DatasetItemStatsLookup = {
  exampleCount: number
  documentCount: number
}

const HIGH_COVERAGE_THRESHOLD = 20
const MEDIUM_COVERAGE_THRESHOLD = 5
const SIMILARITY_THRESHOLD = 0.34
const EXAMPLES_LIMIT = 8

function maxAllowedUnitPrice(unit: PricingUnit): number {
  switch (unit) {
    case 'sqm':
      return 2_000
    case 'point':
      return 5_000
    case 'day':
      return 8_000
    case 'container':
      return 30_000
    case 'package':
      return 500_000
    case 'unit':
      return 50_000
    case 'meter':
      return 5_000
    case 'hour':
      return 1_000
    case 'fixed':
      return 500_000
    case 'percent':
      return 100
    default:
      return 50_000
  }
}

function resolveCoverageTier(exampleCount: number): PricingCoverageTier {
  if (exampleCount >= HIGH_COVERAGE_THRESHOLD) return 'high'
  if (exampleCount >= MEDIUM_COVERAGE_THRESHOLD) return 'medium'
  return 'low'
}

function resolveCoverage(
  item: LearnedPricingItem,
  statsLookup: Map<string, DatasetItemStatsLookup>,
): GroundedPriceCoverage {
  const itemStats = statsLookup.get(toItemKey(item))
  const sampleCount = item.quantityPriceSamples?.length ?? 0
  const exampleCount = itemStats?.exampleCount ?? Math.max(sampleCount, item.sampleLines)
  const documentCount = itemStats?.documentCount ?? Math.min(exampleCount, sampleCount)
  return {
    sampleCount,
    exampleCount,
    documentCount,
    tier: resolveCoverageTier(exampleCount),
  }
}

function resolveLabel(item: LearnedPricingItem, fallback: string): string {
  const preferredAlias = item.aliases?.find((alias) => alias.trim().length > 0)
  return (preferredAlias ?? fallback).trim() || item.canonicalName
}

function findSimilarItem(
  target: LearnedPricingItem,
  items: LearnedPricingItem[],
  statsLookup: Map<string, DatasetItemStatsLookup>,
): LearnedPricingItem | null {
  const targetTokens = tokenize(`${target.canonicalName} ${(target.aliases ?? []).join(' ')}`)
  let best: { item: LearnedPricingItem; score: number } | null = null
  for (const candidate of items) {
    if (candidate.id === target.id || candidate.unit !== target.unit) continue
    const coverage = resolveCoverage(candidate, statsLookup)
    if (coverage.exampleCount < MEDIUM_COVERAGE_THRESHOLD) continue
    const candidateTokens = tokenize(`${candidate.canonicalName} ${(candidate.aliases ?? []).join(' ')}`)
    const score = similarity(targetTokens, candidateTokens)
    if (score < SIMILARITY_THRESHOLD) continue
    if (!best || score > best.score) best = { item: candidate, score }
  }
  return best ? best.item : null
}

async function createDatasetStatsLookup(
  serviceProviderUid: string,
): Promise<Map<string, DatasetItemStatsLookup>> {
  const stats = await getTrainingDatasetStats(serviceProviderUid)
  const entries: Array<[string, DatasetItemStatsLookup]> =
    stats?.itemStats.map((item) => [
      item.itemKey,
      { exampleCount: item.exampleCount, documentCount: item.documentCount },
    ]) ?? []
  return new Map(entries)
}

export async function buildGroundedPricingLines(input: {
  serviceProviderUid: string
  requestedItems: QuoteRequestedItem[]
  learnedItems: LearnedPricingItem[]
}): Promise<BuildGroundedPricingResult> {
  const statsLookup = await createDatasetStatsLookup(input.serviceProviderUid)
  const learnedById = new Map(input.learnedItems.map((item) => [item.id, item]))
  const skippedSourceItemIds: string[] = []
  const lines: GroundedPricingLine[] = []

  input.requestedItems.forEach((requested, index) => {
    const sourceItemId =
      typeof requested.sourceItemId === 'string' && requested.sourceItemId.trim().length > 0
        ? requested.sourceItemId
        : null
    if (!sourceItemId || requested.quantity <= 0) {
      skippedSourceItemIds.push(sourceItemId ?? requested.label)
      return
    }

    const item = learnedById.get(sourceItemId)
    if (!item) {
      skippedSourceItemIds.push(sourceItemId)
      return
    }

    const quantity = round2(requested.quantity)
    const coverage = resolveCoverage(item, statsLookup)
    const exactPrice = exactMatchUnitPrice(item, quantity)
    const binnedPrice = estimateBinnedMedianPrice(item, quantity)
    const stats = resolvePriceStats(resolveExamples(item, quantity, EXAMPLES_LIMIT))

    let baseUnitPrice = exactPrice ?? binnedPrice ?? estimateUnitPriceLinear(item, quantity)
    let method: GroundedPricingMethod =
      exactPrice !== null
        ? 'exact_match'
        : coverage.tier === 'high'
          ? 'binned_median'
          : coverage.tier === 'medium'
            ? 'median_low_coverage'
            : 'trend_fallback'
    let referenceItemKey: string | null = null
    const needsManualReview = coverage.tier === 'low'

    if (coverage.tier === 'low') {
      const similarItem = findSimilarItem(item, input.learnedItems, statsLookup)
      if (similarItem) {
        const similarPrice =
          exactMatchUnitPrice(similarItem, quantity) ??
          estimateBinnedMedianPrice(similarItem, quantity) ??
          estimateUnitPriceLinear(similarItem, quantity)
        baseUnitPrice = similarPrice
        method = 'similar_item_fallback'
        referenceItemKey = toItemKey(similarItem)
      }
    }

    const maxUnitPrice = maxAllowedUnitPrice(item.unit)
    const safeUnitPrice = round2(Math.max(0.1, Math.min(baseUnitPrice, maxUnitPrice)))
    const wasClamped = safeUnitPrice < baseUnitPrice

    lines.push({
      id: `${item.id}_${Date.now()}_${index}`,
      sourceItemId: item.id,
      itemKey: toItemKey(item),
      description: resolveLabel(item, requested.label),
      unit: item.unit,
      quantity,
      baseUnitPrice: safeUnitPrice,
      baseLineTotal: round2(safeUnitPrice * quantity),
      priceStats: stats,
      coverage,
      pricingMethod: method,
      sourceExamples: resolveExamples(item, quantity, EXAMPLES_LIMIT),
      needsManualReview: needsManualReview || wasClamped,
      referenceItemKey,
    })
  })

  return { lines, skippedSourceItemIds }
}
