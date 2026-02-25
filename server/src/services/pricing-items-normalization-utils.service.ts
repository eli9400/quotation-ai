import type { PricingUnit } from '../types/model-profile.js'

const TRAILING_BRACKET_UNIT_PATTERN =
  /\s*\((מ["׳³']?ר|ר["׳³']?מ|sqm|m2|יחיד(?:ה|ות)|unit|points?|visits?|ביקור(?:ים)?|נקוד(?:ה|ות)|days?|ימים?|containers?|מכול(?:ה|ות)|קומפלט|package|שעות?|hours?|meters?|מטרים?|%|אחוזים?|percent)\)\s*$/gi
const LEADING_UNIT_PATTERN =
  /^(מ["׳³']?ר|ר["׳³']?מ|sqm|m2|יחיד(?:ה|ות)|unit|נקוד(?:ה|ות)|points?|visits?|ביקור(?:ים)?|ימים?|יום|days?|מכול(?:ה|ות)|containers?|קומפלט|package|שעות?|hours?|מטרים?|meters?|אחוזים?|percent)\s*[:-]?\s+/i
const TRAILING_UNIT_WORD_PATTERN =
  /\s+(מ["׳³']?ר|ר["׳³']?מ|sqm|m2|יחיד(?:ה|ות)|unit|units|נקוד(?:ה|ות)|points?|visits?|ביקור(?:ים)?|ימים?|יום|days?|מכול(?:ה|ות)|containers?|קומפלט|package|שעות?|hour|hours|מטרים?|meters?|אחוזים?|percent)\s*$/i

const UNIT_ONLY_KEYS = new Set([
  'מר',
  'רמ',
  'm2',
  'sqm',
  'יחידה',
  'יחידות',
  'unit',
  'units',
  'נקודה',
  'נקודות',
  'point',
  'points',
  'ביקור',
  'ביקורים',
  'visit',
  'visits',
  'מכולה',
  'מכולות',
  'container',
  'containers',
  'קומפלט',
  'package',
  'יום',
  'ימים',
  'day',
  'days',
  'שעה',
  'שעות',
  'hour',
  'hours',
  'מטר',
  'מטרים',
  'meter',
  'meters',
  'אחוז',
  'אחוזים',
  'percent',
])
const GENERIC_NOISE_KEYS = new Set([
  'שירות',
  'שרות',
  'עבודה',
  'עבודות',
  'פריט',
  'כללי',
  'שונות',
  'service',
  'services',
  'item',
  'items',
  'general',
  'misc',
])

export const UNIT_PRIORITY: Record<PricingUnit, number> = {
  sqm: 1,
  point: 2,
  day: 3,
  container: 4,
  package: 5,
  meter: 6,
  unit: 7,
  hour: 8,
  percent: 9,
  fixed: 10,
  unknown: 11,
}

export function cleanPricingItemName(value: string, unit: PricingUnit): string {
  let text = value.replace(TRAILING_BRACKET_UNIT_PATTERN, ' ').trim()
  while (LEADING_UNIT_PATTERN.test(text)) {
    text = text.replace(LEADING_UNIT_PATTERN, ' ').trim()
  }
  while (TRAILING_UNIT_WORD_PATTERN.test(text)) {
    text = text.replace(TRAILING_UNIT_WORD_PATTERN, ' ').trim()
  }
  if (unit === 'percent') {
    text = text.replace(/\s+\d{1,3}(?:[.,]\d+)?\s*$/g, ' ').trim()
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function pricingCanonicalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳³׳´]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectPricingUnitHint(text: string): PricingUnit | null {
  const source = text.toLowerCase()
  if (/נקוד|point|ביקור|visit/.test(source)) return 'point'
  if (/יום עבודה|ימים?|day/.test(source)) return 'day'
  if (/מכול|container/.test(source)) return 'container'
  if (/קומפלט|package/.test(source)) return 'package'
  if (/%|אחוז|percent/.test(source)) return 'percent'
  if (/מ\s*["׳³']?\s*ר|ר\s*["׳³']?\s*מ|sqm|m2/.test(source)) return 'sqm'
  if (/מטר|meter/.test(source)) return 'meter'
  if (/שעה|hours?/.test(source)) return 'hour'
  if (/יחיד|unit|pcs/.test(source)) return 'unit'
  return null
}

export function isNoisePricingItemName(name: string): boolean {
  if (!name) return true
  const key = pricingCanonicalKey(name)
  return UNIT_ONLY_KEYS.has(key) || GENERIC_NOISE_KEYS.has(key)
}
