import { estimateUnitPriceLinear, exactMatchUnitPrice } from './line-pricing-utils.service.js'
import { createModelV1Predictor } from './model-v1-inference.service.js'
import { listProviderLineItemOptions } from './provider-line-items.service.js'
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
  | 'model_v1_blend'

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
  inferenceCategoryId: string | null
  priceWasClamped: boolean
  mlDecision: GroundedMlDecision | null
}

export type GroundedMlDecision = {
  applied: boolean
  source: 'direct_item_unit' | 'unit_fallback' | 'global_fallback'
  uncertaintyScore: number
  p25: number
  p50: number
  p75: number
}

export type BuildGroundedPricingResult = {
  lines: GroundedPricingLine[]
  skippedSourceItemIds: string[]
}

type DatasetItemStatsLookup = {
  exampleCount: number
  documentCount: number
}

type InjectedModelPredictor = {
  predict: (input: {
    itemKey?: string | null
    itemName?: string | null
    unit: string
    quantity: number
    industry?: string | null
    projectType?: string | null
    scope?: string | null
    urgency?: string | null
    requirements?: string | null
    inventorySurplus?: number | null
    availableWorkers?: number | null
  }) =>
    | {
        unitPrice: number
        p25: number
        p50: number
        p75: number
        uncertaintyScore: number
        source: 'direct_item_unit' | 'unit_fallback' | 'global_fallback'
        modelArtifactId: string
      }
    | null
}

const HIGH_COVERAGE_THRESHOLD = 20
const MEDIUM_COVERAGE_THRESHOLD = 5
const SIMILARITY_THRESHOLD = 0.34
const EXAMPLES_LIMIT = 8
const VISIT_HINT = /(\u05D1\u05D9\u05E7\u05D5\u05E8|visit|service[_\s-]*call|callout|\u05E7\u05E8\u05D9\u05D0\u05EA\s*\u05E9\u05D9\u05E8\u05D5\u05EA)/i

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

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
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

function resolveQuoteUnit(item: LearnedPricingItem): PricingUnit {
  if (item.unit === 'point') {
    const source = `${item.canonicalName} ${(item.aliases ?? []).join(' ')}`
    if (VISIT_HINT.test(source)) return 'unit'
  }
  return item.unit
}

function findSimilarItem(
  target: LearnedPricingItem,
  items: LearnedPricingItem[],
  statsLookup: Map<string, DatasetItemStatsLookup>,
  categoryBySourceItemId: Map<string, string>,
  targetCategoryId: string | null,
): LearnedPricingItem | null {
  const targetTokens = tokenize(`${target.canonicalName} ${(target.aliases ?? []).join(' ')}`)
  let best: { item: LearnedPricingItem; score: number } | null = null
  for (const candidate of items) {
    if (candidate.id === target.id || candidate.unit !== target.unit) continue
    if (targetCategoryId) {
      const candidateCategoryId = categoryBySourceItemId.get(candidate.id) ?? null
      if (!candidateCategoryId || candidateCategoryId !== targetCategoryId) continue
    }
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

async function createCategoryLookup(
  serviceProviderUid: string,
): Promise<Map<string, string>> {
  const options = await listProviderLineItemOptions(serviceProviderUid)
  return new Map(options.map((option) => [option.id, option.categoryId]))
}

export async function buildGroundedPricingLines(input: {
  serviceProviderUid: string
  requestedItems: QuoteRequestedItem[]
  learnedItems: LearnedPricingItem[]
  industry?: string | null
  requestFeatures?: {
    projectType?: string | null
    scope?: string | null
    urgency?: string | null
    requirements?: string | null
  }
  categoryBySourceItemId?: Map<string, string>
  statsLookup?: Map<string, DatasetItemStatsLookup>
  modelPredictor?: InjectedModelPredictor | null
}): Promise<BuildGroundedPricingResult> {
  const statsLookup = input.statsLookup ?? (await createDatasetStatsLookup(input.serviceProviderUid))
  const categoryBySourceItemId =
    input.categoryBySourceItemId ?? (await createCategoryLookup(input.serviceProviderUid))
  const modelPredictor =
    input.modelPredictor === undefined
      ? await createModelV1Predictor(input.serviceProviderUid)
      : input.modelPredictor
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
    const itemCategoryId = categoryBySourceItemId.get(item.id) ?? null
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
    let needsManualReview = coverage.tier === 'low'
    let mlDecision: GroundedMlDecision | null = null

    if (coverage.tier === 'low') {
      const similarItem = findSimilarItem(
        item,
        input.learnedItems,
        statsLookup,
        categoryBySourceItemId,
        itemCategoryId,
      )
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
    let finalUnitPrice = safeUnitPrice
    if (modelPredictor) {
      const predicted = modelPredictor.predict({
        itemKey: null,
        itemName: item.canonicalName,
        unit: item.unit,
        quantity,
        industry: input.industry ?? null,
        projectType: input.requestFeatures?.projectType ?? null,
        scope: input.requestFeatures?.scope ?? null,
        urgency: input.requestFeatures?.urgency ?? null,
        requirements: input.requestFeatures?.requirements ?? null,
      })
      if (predicted) {
        mlDecision = {
          applied: false,
          source: predicted.source,
          uncertaintyScore: predicted.uncertaintyScore,
          p25: predicted.p25,
          p50: predicted.p50,
          p75: predicted.p75,
        }
        const deltaRatio = Math.abs(predicted.p50 - safeUnitPrice) / Math.max(1, safeUnitPrice)
        const maxRatioBase = coverage.tier === 'high' ? 0.25 : coverage.tier === 'medium' ? 0.45 : 0.8
        const sourceFactor =
          predicted.source === 'direct_item_unit'
            ? 1
            : predicted.source === 'unit_fallback'
              ? 0.85
              : 0.7
        const uncertaintyFactor = Math.max(0.4, 1 - predicted.uncertaintyScore * 0.6)
        const maxRatio = maxRatioBase * sourceFactor * uncertaintyFactor
        if (deltaRatio <= maxRatio) {
          const baseModelWeight = coverage.tier === 'high' ? 0.25 : coverage.tier === 'medium' ? 0.4 : 0.55
          const sourceWeight =
            predicted.source === 'direct_item_unit'
              ? 1
              : predicted.source === 'unit_fallback'
                ? 0.75
                : 0.55
          const uncertaintyWeight = Math.max(0.35, 1 - predicted.uncertaintyScore * 0.7)
          const modelWeight = clamp(baseModelWeight * sourceWeight * uncertaintyWeight, 0.1, 0.7)
          const blended = safeUnitPrice * (1 - modelWeight) + predicted.p50 * modelWeight
          const lowBound = Math.min(safeUnitPrice, predicted.p25)
          const highBound = Math.max(safeUnitPrice, predicted.p75)
          finalUnitPrice = round2(clamp(blended, lowBound, highBound))
          method = 'model_v1_blend'
          mlDecision.applied = true
        }
        const uncertaintyThreshold =
          predicted.source === 'direct_item_unit'
            ? 0.55
            : predicted.source === 'unit_fallback'
              ? 0.4
              : 0.3
        if (
          predicted.uncertaintyScore >= uncertaintyThreshold ||
          predicted.source === 'global_fallback' ||
          (predicted.source !== 'direct_item_unit' && coverage.tier === 'low')
        ) {
          needsManualReview = true
        }
      }
    }

    lines.push({
      id: `${item.id}_${Date.now()}_${index}`,
      sourceItemId: item.id,
      itemKey: toItemKey(item),
      description: resolveLabel(item, requested.label),
      unit: resolveQuoteUnit(item),
      quantity,
      baseUnitPrice: finalUnitPrice,
      baseLineTotal: round2(finalUnitPrice * quantity),
      priceStats: stats,
      coverage,
      pricingMethod: method,
      sourceExamples: resolveExamples(item, quantity, EXAMPLES_LIMIT),
      needsManualReview: needsManualReview || wasClamped,
      referenceItemKey,
      inferenceCategoryId: itemCategoryId,
      priceWasClamped: wasClamped,
      mlDecision,
    })
  })

  return { lines, skippedSourceItemIds }
}
