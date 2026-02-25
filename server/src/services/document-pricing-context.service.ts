import { parseFlexibleNumber } from './number-parser.service.js'
import type {
  DocumentPricingContext,
  MaterialsMode,
  VatMode,
} from '../types/pricing-context.js'

const HEBREW_VAT_PATTERN = 'מע["״׳]?מ'

const VAT_INCLUDED_PATTERNS = [
  new RegExp(`כולל\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  /prices?\s+include(?:s|d)?\s+vat/i,
  /including\s+vat/i,
  /incl\.?\s+vat/i,
]

const VAT_EXCLUDED_PATTERNS = [
  new RegExp(`\\+\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  new RegExp(`לא\\s*כולל\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  /prices?\s+(?:are\s+)?before\s+vat/i,
  /excluding\s+vat/i,
  /\+\s*vat/i,
]

const MATERIALS_INCLUDED_PATTERNS = [
  /כולל\s+חומר(?:ים)?/i,
  /materials?\s+included/i,
  /including\s+materials?/i,
]

const MATERIALS_EXCLUDED_PATTERNS = [
  /לא\s+כולל\s+חומר(?:ים)?/i,
  /materials?\s+not\s+included/i,
  /excluding\s+materials?/i,
  /without\s+materials?/i,
]

const VAT_RATE_PATTERNS = [
  new RegExp(`(?:${HEBREW_VAT_PATTERN}|vat)[^%\\n\\r]{0,20}(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*%`, 'gi'),
  new RegExp(`(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*%\\s*(?:${HEBREW_VAT_PATTERN}|vat)`, 'gi'),
]

const DISCOUNT_PERCENT_PATTERNS = [
  /(?:הנחה|discount)[^%\n\r]{0,24}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/gi,
  /(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:הנחה|discount)/gi,
]

const DISCOUNT_AMOUNT_PATTERNS = [
  /(?:הנחה|discount)[^\d\n\r-]{0,24}(-?\d[\d\s,.'`-]*)/gi,
]

function detectMode(patterns: RegExp[], source: string): boolean {
  return patterns.some((pattern) => pattern.test(source))
}

function asPercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null
  }
  if (value <= 0 || value > 30) {
    return null
  }
  return Math.round(value * 100) / 100
}

function parseFirstMatch(patterns: RegExp[], source: string): number | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(source)
    if (!match?.[1]) {
      continue
    }
    const parsed = parseFlexibleNumber(match[1], { allowZero: false })
    if (parsed === null) {
      continue
    }
    return parsed
  }
  return null
}

function parseDiscountAmount(source: string): number | null {
  const value = parseFirstMatch(DISCOUNT_AMOUNT_PATTERNS, source)
  if (value === null) {
    return null
  }
  return Math.round(Math.abs(value) * 100) / 100
}

export function detectVatModeFromText(source: string): VatMode {
  const included = detectMode(VAT_INCLUDED_PATTERNS, source)
  const excluded = detectMode(VAT_EXCLUDED_PATTERNS, source)
  if (included && !excluded) {
    return 'included'
  }
  if (excluded && !included) {
    return 'excluded'
  }
  return 'unknown'
}

export function detectMaterialsModeFromText(source: string): MaterialsMode {
  const included = detectMode(MATERIALS_INCLUDED_PATTERNS, source)
  const excluded = detectMode(MATERIALS_EXCLUDED_PATTERNS, source)
  if (included && !excluded) {
    return 'included'
  }
  if (excluded && !included) {
    return 'excluded'
  }
  return 'unknown'
}

function normalizeText(rawText: string): string {
  return rawText.replace(/\r\n/g, '\n')
}

export function extractDocumentPricingContext(rawText: string): DocumentPricingContext {
  const text = normalizeText(rawText)
  const vatMode = detectVatModeFromText(text)
  const vatRateCandidate = parseFirstMatch(VAT_RATE_PATTERNS, text)
  const vatRate = asPercent(vatRateCandidate) ?? (vatMode !== 'unknown' ? 17 : null)
  const discountPercentRaw = parseFirstMatch(DISCOUNT_PERCENT_PATTERNS, text)
  const discountPercent =
    discountPercentRaw !== null && discountPercentRaw > 0 && discountPercentRaw <= 90
      ? Math.round(discountPercentRaw * 100) / 100
      : null
  const discountAmount = parseDiscountAmount(text)

  return {
    vatMode,
    vatRate,
    discountPercent,
    discountAmount,
    materialsMode: detectMaterialsModeFromText(text),
  }
}
