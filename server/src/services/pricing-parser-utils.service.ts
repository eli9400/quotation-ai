import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'

const PRICE_LABELS = ['מחיר', 'מחיר ליחידה', 'מחיר למ', 'unit price']
const QUANTITY_LABELS = ['כמות', 'qty', 'quantity']
const TOTAL_LABELS = ['סהכ', 'סכום', 'total']
const IGNORED_NAME_PATTERNS = [
  /--\s*of\s*--/i,
  /מע.?מ/i,
  /vat/i,
  /תנאי תשלום/i,
  /מקדמה/i,
  /יתרה/i,
  /סה.?כ/i,
  /subtotal/i,
  /grand total/i,
]
const UNIT_HINTS: Array<{ match: RegExp; unit: PricingUnit }> = [
  { match: /מ["׳']?ר|מ2|sqm/gi, unit: 'sqm' },
  { match: /יחי?דה|יח׳|unit/gi, unit: 'unit' },
  { match: /שעה|שעות|hour/gi, unit: 'hour' },
  { match: /מטר|מ'|meter/gi, unit: 'meter' },
]
const LEADING_UNIT_PATTERN =
  /^(מ["׳']?ר|מ2|sqm|יחי?דה|יח׳|unit|שעה|שעות|hour|מטר|meter)\s+/i

export function normalizeLine(rawLine: string): string {
  return rawLine.replace(/\s+/g, ' ').trim()
}

export function normalizeName(rawName: string): string {
  return rawName
    .toLowerCase()
    .replace(/["'׳״]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNumber(rawValue: string): number | null {
  const normalized = rawValue
    .replace(/[₪,\s]/g, '')
    .replace(/־/g, '-')
    .replace(/[^\d.-]/g, '')
  if (!normalized) {
    return null
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export function extractNumbers(line: string): number[] {
  const matches = line.match(/-?\d[\d,.]*/g) ?? []
  return matches
    .map((part) => parseNumber(part))
    .filter((value): value is number => value !== null)
}

export function detectUnit(line: string): PricingUnit {
  for (const hint of UNIT_HINTS) {
    if (hint.match.test(line)) {
      hint.match.lastIndex = 0
      return hint.unit
    }
    hint.match.lastIndex = 0
  }
  return 'unknown'
}

export function hasPriceLabel(line: string): boolean {
  return lineContainsAny(line, PRICE_LABELS)
}

export function hasQuantityLabel(line: string): boolean {
  return lineContainsAny(line, QUANTITY_LABELS)
}

export function hasTotalLabel(line: string): boolean {
  return lineContainsAny(line, TOTAL_LABELS)
}

function lineContainsAny(line: string, labels: string[]): boolean {
  const normalized = line.toLowerCase().replace(/[\"'׳״]/g, '')
  return labels.some((label) => normalized.includes(label))
}

export function pickDescriptionFromLine(line: string): string | null {
  const stripped = line
    .replace(/-?\d[\d,.\s]*/g, ' ')
    .replace(/[₪:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (stripped.length < 3) {
    return null
  }
  if (!/[\p{L}]/u.test(stripped)) {
    return null
  }
  return stripped.replace(LEADING_UNIT_PATTERN, '').trim()
}

export function buildObservation(
  documentId: string,
  sourceLine: string,
  rawName: string,
  unit: PricingUnit,
  quantity: number,
  pricePerUnit: number,
  lineTotal: number,
): PricingObservation | null {
  if (
    !rawName ||
    isIgnoredDescription(rawName) ||
    quantity <= 0 ||
    pricePerUnit <= 0 ||
    lineTotal <= 0
  ) {
    return null
  }

  const canonicalName = normalizeName(rawName)
  if (canonicalName.length < 3 || isIgnoredDescription(canonicalName)) {
    return null
  }

  if (unit === 'unknown' && quantity <= 1 && pricePerUnit <= 1) {
    return null
  }

  const expectedTotal = quantity * pricePerUnit
  if (expectedTotal > 0) {
    const ratio = lineTotal / expectedTotal
    if (ratio < 0.25 || ratio > 4) {
      return null
    }
  }

  if (unit === 'unknown' && canonicalName.split(' ').length > 12) {
    return null
  }

  return {
    sourceDocumentId: documentId,
    sourceLine,
    rawName,
    canonicalName,
    unit,
    quantity,
    pricePerUnit,
    lineTotal,
  }
}

export function isIgnoredDescription(value: string): boolean {
  const normalized = normalizeName(value)
  if (!normalized) {
    return true
  }
  return IGNORED_NAME_PATTERNS.some((pattern) => pattern.test(normalized))
}
