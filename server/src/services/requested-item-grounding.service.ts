import { normalizeRequestedUnit } from './learned-quote-utils.service.js'
import type { ProviderPricingItem } from './pricing-items-source.service.js'
import type { QuoteRequestedItem } from '../types/quote.js'

const VISIT_HINT = /(ביקור|visit|service[_\s-]*call|callout|קריאת\s*שירות)/i
const SOURCE_PRIORITY: Record<ProviderPricingItem['sourceType'], number> = {
  provider: 3,
  industry: 2,
}

function normalizeLabelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳`´]/g, '')
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeLabelKey(value)
      .split(' ')
      .filter((token) => token.length >= 2),
  )
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  left.forEach((token) => {
    if (right.has(token)) intersection += 1
  })
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}

function candidateNames(item: ProviderPricingItem): string[] {
  return [item.canonicalName, ...(item.aliases ?? [])].filter((name) => name.trim().length > 0)
}

function isVisitLikeLabel(label: string): boolean {
  return VISIT_HINT.test(label)
}

function isVisitLikeItem(item: ProviderPricingItem): boolean {
  return candidateNames(item).some((name) => isVisitLikeLabel(name))
}

function isUnitCompatible(
  requested: QuoteRequestedItem,
  candidate: ProviderPricingItem,
): boolean {
  const normalizedRequestedUnit = normalizeRequestedUnit(requested.unit)
  if (normalizedRequestedUnit === 'custom') return true
  if (candidate.unit === normalizedRequestedUnit) return true
  if (
    isVisitLikeLabel(requested.label) &&
    ((normalizedRequestedUnit === 'unit' && candidate.unit === 'point') ||
      (normalizedRequestedUnit === 'point' && candidate.unit === 'unit'))
  ) {
    return true
  }
  return false
}

function pickBestByPriority(candidates: ProviderPricingItem[]): ProviderPricingItem | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((left, right) => {
    const priorityDelta = SOURCE_PRIORITY[right.sourceType] - SOURCE_PRIORITY[left.sourceType]
    if (priorityDelta !== 0) return priorityDelta
    if (right.sampleLines !== left.sampleLines) return right.sampleLines - left.sampleLines
    return right.quantityPriceSamples.length - left.quantityPriceSamples.length
  })
  return sorted[0] ?? null
}

function findExactMatch(
  requested: QuoteRequestedItem,
  learnedItems: ProviderPricingItem[],
): ProviderPricingItem | null {
  const requestedKey = normalizeLabelKey(requested.label)
  if (!requestedKey) return null
  const exact = learnedItems.filter((item) => {
    if (!isUnitCompatible(requested, item)) return false
    return candidateNames(item).some((name) => normalizeLabelKey(name) === requestedKey)
  })
  return pickBestByPriority(exact)
}

function findVisitFallback(
  requested: QuoteRequestedItem,
  learnedItems: ProviderPricingItem[],
): ProviderPricingItem | null {
  if (!isVisitLikeLabel(requested.label)) return null
  const candidates = learnedItems.filter(
    (item) => (item.unit === 'point' || item.unit === 'unit') && isVisitLikeItem(item),
  )
  return pickBestByPriority(candidates)
}

function findStrongSimilarityMatch(
  requested: QuoteRequestedItem,
  learnedItems: ProviderPricingItem[],
): ProviderPricingItem | null {
  const requestedKey = normalizeLabelKey(requested.label)
  if (!requestedKey || requestedKey.length < 5) return null
  const requestedTokens = tokenize(requested.label)
  let best: { item: ProviderPricingItem; score: number } | null = null

  for (const item of learnedItems) {
    if (!isUnitCompatible(requested, item)) continue
    for (const name of candidateNames(item)) {
      const score = jaccard(requestedTokens, tokenize(name))
      if (score < 0.82) continue
      if (!best || score > best.score) {
        best = { item, score }
      }
    }
  }

  if (!best) return null
  return best.item
}

export function resolveRequestedSourceItemId(
  requested: QuoteRequestedItem,
  learnedItems: ProviderPricingItem[],
): string | null {
  const exact = findExactMatch(requested, learnedItems)
  if (exact) return exact.id

  const visitFallback = findVisitFallback(requested, learnedItems)
  if (visitFallback) return visitFallback.id

  const similar = findStrongSimilarityMatch(requested, learnedItems)
  if (similar) return similar.id

  return null
}
