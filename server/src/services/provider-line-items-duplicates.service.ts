import type { ProviderLineItemSourceType } from './provider-line-items.service.js'

const HEBREW_TOKEN_SYNONYMS: Record<string, string> = {
  מסנן: 'פילטר',
  מסננים: 'פילטר',
  פילטרים: 'פילטר',
  שמנים: 'שמן',
}

function normalizeToken(token: string): string {
  const cleaned = token.trim().toLowerCase().replace(/^[ו]/, '')
  if (!cleaned) return ''
  return HEBREW_TOKEN_SYNONYMS[cleaned] ?? cleaned
}

function tokenize(value: string): string[] {
  return value
    .split(' ')
    .map(normalizeToken)
    .filter((token) => token.length > 0)
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right)
  const overlap = left.filter((token) => rightSet.has(token)).length
  return overlap / Math.max(left.length, right.length)
}

// Soft duplicate check for provider+catalog near synonyms (e.g., פילטר/מסננים).
export function isSoftNearDuplicateName(
  leftName: string,
  rightName: string,
  leftSource: ProviderLineItemSourceType,
  rightSource: ProviderLineItemSourceType,
): boolean {
  if (leftSource === rightSource) return false
  if (leftSource !== 'provider' && rightSource !== 'provider') return false

  const leftTokens = tokenize(leftName)
  const rightTokens = tokenize(rightName)
  if (leftTokens.length < 2 || rightTokens.length < 2) return false

  const ratio = overlapRatio(leftTokens, rightTokens)
  const delta = Math.abs(leftTokens.length - rightTokens.length)
  return ratio >= 0.66 && delta <= 1
}
