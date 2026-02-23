import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { exactMatchUnitPrice, estimateUnitPriceLinear } from './line-pricing-utils.service.js'
import { listProviderPricingItemsWithIndustryBaseline } from './pricing-items-source.service.js'
import { estimateBinnedMedianPrice } from './pricing-engine-utils.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'
import type { GeneratedQuote, QuoteLineItem } from '../types/quote.js'

const SIMILARITY_THRESHOLD = 0.34

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase()
  if (normalized === '%' || normalized === 'pct') {
    return 'percent'
  }
  return normalized
}

function isPercentUnit(unit: string): boolean {
  return normalizeUnit(unit) === 'percent'
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳׳]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeLabel(value: string): Set<string> {
  return new Set(
    normalizeLabel(value)
      .split(' ')
      .filter((token) => token.length >= 2),
  )
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0
  }
  let intersection = 0
  left.forEach((token) => {
    if (right.has(token)) {
      intersection += 1
    }
  })
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}

function candidateNames(item: LearnedPricingItem): string[] {
  return [item.canonicalName, ...(item.aliases ?? [])]
}

function isExactNameMatch(line: QuoteLineItem, item: LearnedPricingItem): boolean {
  const lineLabel = normalizeLabel(line.description)
  return candidateNames(item).some((name) => normalizeLabel(name) === lineLabel)
}

function similarityScore(line: QuoteLineItem, item: LearnedPricingItem): number {
  const lineTokens = tokenizeLabel(line.description)
  let best = 0
  candidateNames(item).forEach((name) => {
    const score = tokenSimilarity(lineTokens, tokenizeLabel(name))
    if (score > best) {
      best = score
    }
  })
  return best
}

function estimateUnitPrice(item: LearnedPricingItem, quantity: number): number {
  const exact = exactMatchUnitPrice(item, quantity)
  if (exact !== null) {
    return round2(exact)
  }
  const binned = estimateBinnedMedianPrice(item, quantity)
  if (binned !== null) {
    return round2(binned)
  }
  return round2(estimateUnitPriceLinear(item, quantity))
}

function needsAutofill(line: QuoteLineItem): boolean {
  if (isPercentUnit(line.unit)) {
    return false
  }
  if (line.quantity <= 0) {
    return false
  }
  return line.unitPrice <= 0
}

function findBestItem(line: QuoteLineItem, items: LearnedPricingItem[]): LearnedPricingItem | null {
  const lineUnit = normalizeUnit(line.unit)
  const candidates = items.filter((item) => normalizeUnit(item.unit) === lineUnit)
  if (candidates.length === 0) {
    return null
  }

  if (line.sourceItemId) {
    const bySource = candidates.find((item) => item.id === line.sourceItemId)
    if (bySource) {
      return bySource
    }
  }

  const exact = candidates
    .filter((item) => isExactNameMatch(line, item))
    .sort((left, right) => right.sampleLines - left.sampleLines)[0]
  if (exact) {
    return exact
  }

  const scored = candidates
    .map((item) => ({ item, score: similarityScore(line, item) }))
    .filter((entry) => entry.score >= SIMILARITY_THRESHOLD)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.item.sampleLines - left.item.sampleLines,
    )[0]

  return scored?.item ?? null
}

export async function autofillQuoteLinePricesFromTraining(
  serviceProviderUid: string,
  quote: GeneratedQuote,
): Promise<GeneratedQuote> {
  const linesToAutofill = quote.lineItems.filter(needsAutofill)
  if (linesToAutofill.length === 0) {
    return quote
  }

  const profile = await getServiceProviderByUid(serviceProviderUid)
  const learnedItems = await listProviderPricingItemsWithIndustryBaseline(
    serviceProviderUid,
    profile?.industry ?? '',
  )
  if (learnedItems.length === 0) {
    return quote
  }

  let changed = false
  const updatedLineItems = quote.lineItems.map((line) => {
    if (!needsAutofill(line)) {
      return line
    }
    const item = findBestItem(line, learnedItems)
    if (!item) {
      return line
    }
    const unitPrice = estimateUnitPrice(item, line.quantity)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return line
    }
    changed = true
    return {
      ...line,
      sourceItemId: line.sourceItemId ?? item.id,
      unitPrice,
    }
  })

  if (!changed) {
    return quote
  }

  return buildQuoteFromLineItems({
    lineItems: updatedLineItems,
    customFields: quote.customFields,
    pricingAdjustments: quote.pricingAdjustments,
    vatRate: quote.vatRate,
    estimatedDays: quote.estimatedDays,
    confidence: quote.confidence,
    summary: quote.summary,
    assumptions: quote.assumptions,
    generatedAt: quote.generatedAt,
  })
}
