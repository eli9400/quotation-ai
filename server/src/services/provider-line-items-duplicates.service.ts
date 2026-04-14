import type { ProviderLineItemSourceType } from './provider-line-items.service.js'

const TOKEN_SYNONYMS: Record<string, string> = {
  '\u05DE\u05E1\u05E0\u05DF': '\u05E4\u05D9\u05DC\u05D8\u05E8',
  '\u05DE\u05E1\u05E0\u05E0\u05D9\u05DD': '\u05E4\u05D9\u05DC\u05D8\u05E8',
  '\u05E4\u05D9\u05DC\u05D8\u05E8\u05D9\u05DD': '\u05E4\u05D9\u05DC\u05D8\u05E8',
  '\u05E9\u05DE\u05E0\u05D9\u05DD': '\u05E9\u05DE\u05DF',
}

const WEAK_DIFF_TOKENS = new Set([
  '\u05DB\u05D5\u05DC\u05DC',
  '\u05DC\u05DC\u05D0',
  '\u05E2\u05DD',
  '\u05DC\u05E4\u05D9',
  '\u05DE\u05D7\u05D9\u05E8',
  '\u05E7\u05D1\u05D5\u05E2',
  '\u05E2\u05D1\u05D5\u05D3\u05D4',
  '\u05E9\u05D9\u05E8\u05D5\u05EA',
  'with',
  'without',
  'including',
  'service',
  'job',
])

function normalizeToken(token: string): string {
  const cleaned = token.trim().toLowerCase().replace(/^[\u05D5]/, '')
  if (!cleaned) return ''
  return TOKEN_SYNONYMS[cleaned] ?? cleaned
}

function tokenize(value: string): string[] {
  return value
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 0)
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right)
  const overlap = left.filter((token) => rightSet.has(token)).length
  return overlap / Math.max(left.length, right.length)
}

function strongDiffTokens(left: string[], right: string[]): string[] {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  const diff = new Set<string>()
  leftSet.forEach((token) => {
    if (!rightSet.has(token)) diff.add(token)
  })
  rightSet.forEach((token) => {
    if (!leftSet.has(token)) diff.add(token)
  })
  return Array.from(diff).filter((token) => !WEAK_DIFF_TOKENS.has(token))
}

// Soft duplicate check for provider+baseline near synonyms with strict guards.
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

  if (overlapRatio(leftTokens, rightTokens) < 0.7) return false
  if (Math.abs(leftTokens.length - rightTokens.length) > 1) return false

  return strongDiffTokens(leftTokens, rightTokens).length === 0
}
