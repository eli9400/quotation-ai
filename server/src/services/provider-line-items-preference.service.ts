import { isSoftNearDuplicateName } from './provider-line-items-duplicates.service.js'

type ProviderLineItemSourceType = 'provider' | 'industry' | 'catalog'

type ProviderLineItemOptionLike = {
  canonicalName: string
  sourceType: ProviderLineItemSourceType
}

const NAME_NOISE_TOKENS = new Set([
  'כולל',
  'לפי',
  'מחיר',
  'קבוע',
  'עבודה',
  'עבודת',
  'sqm',
  'm2',
  'unit',
  'point',
  'meter',
  'hour',
  'day',
  'package',
  'רמ',
  'מר',
  'שעה',
  'שעות',
])

export function normalizeProviderLineItemNameKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = normalized.split(' ').filter(Boolean).filter((token) => !NAME_NOISE_TOKENS.has(token))
  return tokens.length > 0 ? tokens.join(' ') : normalized
}

export function isNearDuplicateProviderLineItemName(left: string, right: string): boolean {
  if (!left || !right || left === right) return false
  const leftWords = left.split(' ').filter(Boolean)
  const rightWords = right.split(' ').filter(Boolean)
  if (leftWords.length < 2 || rightWords.length < 2) return false
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  if (shorter.length >= 8 && longer.includes(shorter)) return true
  const rightSet = new Set(rightWords)
  const intersection = leftWords.filter((word) => rightSet.has(word)).length
  return intersection >= Math.min(leftWords.length, rightWords.length) && Math.abs(leftWords.length - rightWords.length) <= 1
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
