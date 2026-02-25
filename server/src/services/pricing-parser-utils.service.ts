import { parseFlexibleNumber } from './number-parser.service.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type { DocumentPricingContext } from '../types/pricing-context.js'
import { detectMaterialsModeFromText, detectVatModeFromText } from './document-pricing-context.service.js'
import { mapUnitToken } from './pricing-unit-utils.service.js'

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
const SQM_STRONG_HINT = /(?:מ\s*["׳'״`]?\s*ר|ר\s*["׳'״`]?\s*מ|sqm|m2|sq\.?\s*m)/giu
const VISIT_HINT = /(?:ביקור(?:ים)?|visit|visits)/giu
const METER_WORD_HINT = /(?:מטר(?:ים)?|meters?|lm|למ)/giu
const METER_SHORT_HINT =
  /(?:^|[\s()[\]{}:;,.|/-])מ['׳`״]?(?!\s*ר)(?=$|[\s()[\]{}:;,.|/-])/giu

const UNIT_HINTS: Array<{ match: RegExp; unit: PricingUnit }> = [
  { match: SQM_STRONG_HINT, unit: 'sqm' },
  { match: /נקוד(?:ה|ות)?|point|pts?/gi, unit: 'point' },
  { match: VISIT_HINT, unit: 'point' },
  { match: /יום(?:י עבודה)?|ימים|day|days/gi, unit: 'day' },
  { match: /מכול(?:ה|ות)|container|containers/gi, unit: 'container' },
  { match: /קומפלט|package/gi, unit: 'package' },
  { match: /%|אחוז|percent/gi, unit: 'percent' },
  { match: /יחי?דה|יח׳|unit|pcs/gi, unit: 'unit' },
  { match: /שעה|שעות|hour|hours/gi, unit: 'hour' },
  { match: METER_WORD_HINT, unit: 'meter' },
  { match: METER_SHORT_HINT, unit: 'meter' },
  { match: /מחיר קבוע|fixed|lump sum/gi, unit: 'fixed' },
]
const LEADING_UNIT_PATTERN =
  /^(מ["׳']?ר|ר["׳']?מ|מ2|sqm|נקוד(?:ה|ות)?|ביקור(?:ים)?|points?|visits?|ימים?|days?|מכול(?:ה|ות)|containers?|קומפלט|package|יחי?דה|יח׳|unit|pcs|שעות?|hours?|מטרים?|meters?|אחוז|percent)\s+/i
const TRAILING_UNIT_PATTERN =
  /\s*\((מ["׳']?ר|ר["׳']?מ|sqm|m2|נקוד(?:ה|ות)?|ביקור(?:ים)?|points?|visits?|ימים?|days?|מכול(?:ה|ות)|containers?|קומפלט|package|יחידות?|unit|שעות?|hours?|מטרים?|meters?|%|אחוז|percent)\)\s*$/i

export type ObservationBuildContext = Partial<DocumentPricingContext> & {
  sourceQuoteDate?: string | null
}

function resolveVatMode(sourceLine: string, context: ObservationBuildContext): DocumentPricingContext['vatMode'] {
  const detectedMode = detectVatModeFromText(sourceLine)
  return detectedMode === 'unknown' ? (context.vatMode ?? 'unknown') : detectedMode
}

function resolveMaterialsMode(sourceLine: string, context: ObservationBuildContext): DocumentPricingContext['materialsMode'] {
  const detectedMode = detectMaterialsModeFromText(sourceLine)
  return detectedMode === 'unknown' ? (context.materialsMode ?? 'unknown') : detectedMode
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
  const tokenUnit = mapUnitToken(line)
  if (tokenUnit) return tokenUnit

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
