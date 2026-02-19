import { parseFlexibleNumber } from './number-parser.service.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type {
  DocumentPricingContext,
  MaterialsMode,
  VatMode,
} from '../types/pricing-context.js'

const PRICE_LABELS = ['מחיר', 'מחיר ליחידה', 'מחיר למ', 'unit price']
const QUANTITY_LABELS = ['כמות', 'qty', 'quantity']
const TOTAL_LABELS = ['סהכ', 'סכום', 'total']
const HEBREW_VAT_PATTERN = 'מע["״׳]?מ'
const IGNORED_NAME_PATTERNS = [
  /--\s*of\s*--/i,
  new RegExp(HEBREW_VAT_PATTERN, 'i'),
  /vat/i,
  /תנאי תשלום/i,
  /מקדמה/i,
  /יתרה/i,
  /סה.?כ/i,
  /subtotal/i,
  /grand total/i,
  /הנחה/i,
  /discount/i,
]
const UNIT_HINTS: Array<{ match: RegExp; unit: PricingUnit }> = [
  { match: /מ["׳']?ר|מ2|sqm/gi, unit: 'sqm' },
  { match: /נקוד(?:ה|ות)?|point|pts?/gi, unit: 'point' },
  { match: /יום(?:י עבודה)?|ימים|day|days/gi, unit: 'day' },
  { match: /מכול(?:ה|ות)|container|containers/gi, unit: 'container' },
  { match: /קומפלט|package/gi, unit: 'package' },
  { match: /%|אחוז|percent/gi, unit: 'percent' },
  { match: /יחי?דה|יח׳|unit|pcs/gi, unit: 'unit' },
  { match: /שעה|שעות|hour|hours/gi, unit: 'hour' },
  { match: /מטר|מ'|meter|meters/gi, unit: 'meter' },
  { match: /מחיר קבוע|fixed|lump sum/gi, unit: 'fixed' },
]
const LEADING_UNIT_PATTERN =
  /^(מ["׳']?ר|מ2|sqm|נקוד(?:ה|ות)?|points?|ימים?|days?|מכול(?:ה|ות)|containers?|קומפלט|package|יחי?דה|יח׳|unit|pcs|שעות?|hours?|מטרים?|meters?|אחוז|percent)\s+/i
const TRAILING_UNIT_PATTERN =
  /\s*\((מ["׳']?ר|sqm|m2|נקוד(?:ה|ות)?|points?|ימים?|days?|מכול(?:ה|ות)|containers?|קומפלט|package|יחידות?|unit|שעות?|hours?|מטרים?|meters?|%|אחוז|percent)\)\s*$/i

export type ObservationBuildContext = Partial<DocumentPricingContext> & {
  sourceQuoteDate?: string | null
}

const VAT_INCLUDED_PATTERNS = [
  new RegExp(`כולל\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  /including\s+vat/i,
  /prices?\s+include(?:s|d)?\s+vat/i,
]
const VAT_EXCLUDED_PATTERNS = [
  new RegExp(`\\+\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  new RegExp(`לא\\s*כולל\\s*${HEBREW_VAT_PATTERN}`, 'i'),
  /\+\s*vat/i,
  /excluding\s+vat/i,
]
const MATERIALS_INCLUDED_PATTERNS = [/כולל\s+חומר(?:ים)?/i, /materials?\s+included/i]
const MATERIALS_EXCLUDED_PATTERNS = [
  /לא\s+כולל\s+חומר(?:ים)?/i,
  /materials?\s+not\s+included/i,
]

function detectMode(patterns: RegExp[], source: string): boolean {
  return patterns.some((pattern) => pattern.test(source))
}

function resolveVatMode(sourceLine: string, context: ObservationBuildContext): VatMode {
  const included = detectMode(VAT_INCLUDED_PATTERNS, sourceLine)
  const excluded = detectMode(VAT_EXCLUDED_PATTERNS, sourceLine)
  if (included && !excluded) return 'included'
  if (excluded && !included) return 'excluded'
  return context.vatMode ?? 'unknown'
}

function resolveMaterialsMode(sourceLine: string, context: ObservationBuildContext): MaterialsMode {
  const included = detectMode(MATERIALS_INCLUDED_PATTERNS, sourceLine)
  const excluded = detectMode(MATERIALS_EXCLUDED_PATTERNS, sourceLine)
  if (included && !excluded) return 'included'
  if (excluded && !included) return 'excluded'
  return context.materialsMode ?? 'unknown'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeLine(rawLine: string): string {
  return rawLine.replace(/\s+/g, ' ').trim()
}

function cleanRawName(rawName: string): string {
  return rawName.replace(LEADING_UNIT_PATTERN, '').replace(TRAILING_UNIT_PATTERN, '').trim()
}

export function normalizeName(rawName: string): string {
  return cleanRawName(rawName)
    .toLowerCase()
    .replace(/["'׳״]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNumber(rawValue: string): number | null {
  return parseFlexibleNumber(rawValue, { allowZero: false })
}

export function extractNumbers(line: string): number[] {
  const matches = line.match(/[-+]?\d[\d\s,.']*/g) ?? []
  return matches
    .map((part) => parseFlexibleNumber(part, { allowNegative: true, allowZero: false }))
    .filter((value): value is number => value !== null)
    .map((value) => Math.abs(value))
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

function normalizeUnit(unit: PricingUnit, rawName: string, sourceLine: string): PricingUnit {
  const textHint = detectUnit(`${rawName} ${sourceLine}`)
  if (textHint !== 'unknown') return textHint
  if (unit === 'fixed' && /קומפלט|package/i.test(`${rawName} ${sourceLine}`)) {
    return 'package'
  }
  return unit
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
  const normalized = line.toLowerCase().replace(/["'׳״]/g, '')
  return labels.some((label) => normalized.includes(label))
}

export function pickDescriptionFromLine(line: string): string | null {
  const stripped = line
    .replace(/[-+]?\d[\d,.\s']*/g, ' ')
    .replace(/[₪$€£:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length < 3) return null
  if (!/[\p{L}]/u.test(stripped)) return null
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
  context: ObservationBuildContext = {},
): PricingObservation | null {
  if (!rawName || quantity <= 0 || pricePerUnit <= 0 || lineTotal <= 0) {
    return null
  }

  const normalizedUnit = normalizeUnit(unit, rawName, sourceLine)
  const canonicalName = normalizeName(rawName)
  if (isIgnoredDescription(canonicalName) || canonicalName.length < 3) {
    return null
  }
  if (normalizedUnit === 'unknown' && quantity <= 1 && pricePerUnit <= 1) {
    return null
  }

  const ratio = lineTotal / Math.max(1, quantity * pricePerUnit)
  if (ratio < 0.25 || ratio > 4) return null
  if (normalizedUnit === 'unknown' && canonicalName.split(' ').length > 12) return null

  return {
    sourceDocumentId: documentId,
    sourceQuoteDate: context.sourceQuoteDate ?? null,
    sourceLine,
    rawName,
    canonicalName,
    unit: normalizedUnit,
    quantity: round2(quantity),
    pricePerUnit: round2(pricePerUnit),
    lineTotal: round2(lineTotal),
    cpiAdjustmentFactor: 1,
    vatMode: resolveVatMode(sourceLine, context),
    vatRate: context.vatRate ?? null,
    materialsMode: resolveMaterialsMode(sourceLine, context),
    discountPercent: context.discountPercent ?? null,
    discountAmount: context.discountAmount ?? null,
  }
}

export function isIgnoredDescription(value: string): boolean {
  const normalized = normalizeName(value)
  if (!normalized) return true
  return IGNORED_NAME_PATTERNS.some((pattern) => pattern.test(normalized))
}
