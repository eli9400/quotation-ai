import { isSoftNearDuplicateName } from './provider-line-items-duplicates.service.js'

type ProviderLineItemSourceType = 'provider' | 'industry' | 'catalog'

type ProviderLineItemOptionLike = {
  canonicalName: string
  sourceType: ProviderLineItemSourceType
}

const NAME_NOISE_TOKENS = new Set([
  '\u05DB\u05D5\u05DC\u05DC',
  '\u05DC\u05E4\u05D9',
  '\u05DE\u05D7\u05D9\u05E8',
  '\u05E7\u05D1\u05D5\u05E2',
  '\u05E2\u05D1\u05D5\u05D3\u05D4',
  '\u05E2\u05D1\u05D5\u05D3\u05EA',
  'sqm',
  'm2',
  'unit',
  'point',
  'meter',
  'hour',
  'day',
  'package',
  '\u05E8\u05DE',
  '\u05DE\u05E8',
  '\u05E9\u05E2\u05D4',
  '\u05E9\u05E2\u05D5\u05EA',
])

const WEAK_VARIANT_TOKENS = new Set([
  '\u05DB\u05D5\u05DC\u05DC',
  '\u05DC\u05DC\u05D0',
  '\u05E2\u05DD',
  '\u05DC\u05E4\u05D9',
  '\u05E2\u05D1\u05D5\u05D3\u05D4',
  '\u05E9\u05D9\u05E8\u05D5\u05EA',
  '\u05DE\u05D7\u05D9\u05E8',
  '\u05E7\u05D1\u05D5\u05E2',
  'with',
  'without',
  'including',
  'service',
  'job',
])

export function normalizeProviderLineItemNameKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .filter((token) => !NAME_NOISE_TOKENS.has(token))
  return tokens.length > 0 ? tokens.join(' ') : normalized
}

function toTokenSet(value: string): Set<string> {
  return new Set(value.split(' ').filter(Boolean))
}

function strongDiffTokens(left: Set<string>, right: Set<string>): string[] {
  const diff = new Set<string>()
  left.forEach((token) => {
    if (!right.has(token)) diff.add(token)
  })
  right.forEach((token) => {
    if (!left.has(token)) diff.add(token)
  })
  return Array.from(diff).filter((token) => !WEAK_VARIANT_TOKENS.has(token))
}

export function isNearDuplicateProviderLineItemName(left: string, right: string): boolean {
  if (!left || !right || left === right) return false
  const leftSet = toTokenSet(left)
  const rightSet = toTokenSet(right)
  if (leftSet.size < 2 || rightSet.size < 2) return false

  let intersection = 0
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1
  })
  const overlapByShorter = intersection / Math.max(1, Math.min(leftSet.size, rightSet.size))
  if (overlapByShorter < 0.75) return false
  if (Math.abs(leftSet.size - rightSet.size) > 1) return false

  return strongDiffTokens(leftSet, rightSet).length === 0
}

function hasProviderEquivalent(
  provider: ProviderLineItemOptionLike,
  candidate: ProviderLineItemOptionLike,
): boolean {
  const providerKey = normalizeProviderLineItemNameKey(provider.canonicalName)
  const candidateKey = normalizeProviderLineItemNameKey(candidate.canonicalName)
  if (!providerKey || !candidateKey) return false
  if (providerKey === candidateKey) return true
  if (isNearDuplicateProviderLineItemName(providerKey, candidateKey)) return true
  return isSoftNearDuplicateName(provider.canonicalName, candidate.canonicalName, provider.sourceType, candidate.sourceType)
}

export function suppressIndustryAndCatalogWhenProviderExists<T extends ProviderLineItemOptionLike>(
  options: T[],
): T[] {
  const providerOptions = options.filter((option) => option.sourceType === 'provider')
  if (providerOptions.length === 0) return options
  return options.filter((option) => {
    if (option.sourceType === 'provider') return true
    return !providerOptions.some((provider) => hasProviderEquivalent(provider, option))
  })
}
