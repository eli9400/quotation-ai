import type { PricingUnit } from '../types/model-profile.js'
const HE = {
  sqmA: '\u05DE\u05E8',
  sqmB: '\u05E8\u05DE',
  unit: '\u05D9\u05D7\u05D9\u05D3\u05D4',
  units: '\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA',
  point: '\u05E0\u05E7\u05D5\u05D3\u05D4',
  points: '\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA',
  visit: '\u05D1\u05D9\u05E7\u05D5\u05E8',
  visits: '\u05D1\u05D9\u05E7\u05D5\u05E8\u05D9\u05DD',
  day: '\u05D9\u05D5\u05DD',
  days: '\u05D9\u05DE\u05D9\u05DD',
  container: '\u05DE\u05DB\u05D5\u05DC\u05D4',
  containers: '\u05DE\u05DB\u05D5\u05DC\u05D5\u05EA',
  package: '\u05E7\u05D5\u05DE\u05E4\u05DC\u05D8',
  hour: '\u05E9\u05E2\u05D4',
  hours: '\u05E9\u05E2\u05D5\u05EA',
  meter: '\u05DE\u05D8\u05E8',
  meters: '\u05DE\u05D8\u05E8\u05D9\u05DD',
  percent: '\u05D0\u05D7\u05D5\u05D6',
  percents: '\u05D0\u05D7\u05D5\u05D6\u05D9\u05DD',
  service: '\u05E9\u05D9\u05E8\u05D5\u05EA',
  serviceAlt: '\u05E9\u05E8\u05D5\u05EA',
  work: '\u05E2\u05D1\u05D5\u05D3\u05D4',
  works: '\u05E2\u05D1\u05D5\u05D3\u05D5\u05EA',
  item: '\u05E4\u05E8\u05D9\u05D8',
  generic: '\u05DB\u05DC\u05DC\u05D9',
  others: '\u05E9\u05D5\u05E0\u05D5\u05EA',
  install: '\u05D4\u05EA\u05E7\u05E0\u05D4',
  packageSingle: '\u05D7\u05D1\u05D9\u05DC\u05EA',
  odyEl: '\u05E2\u05D5\u05D3\u05D9 \u05D0\u05DC',
} as const
const TRAILING_BRACKET_UNIT_PATTERN =
  /\s*\((sqm|m2|unit|units|point|points|visit|visits|day|days|container|containers|package|hour|hours|meter|meters|%|percent)\)\s*$/gi
const LEADING_UNIT_PATTERN =
  /^(sqm|m2|unit|units|point|points|visit|visits|day|days|container|containers|package|hour|hours|meter|meters|percent)\s*[:-]?\s+/i
const TRAILING_UNIT_WORD_PATTERN =
  /\s+(sqm|m2|unit|units|point|points|visit|visits|day|days|container|containers|package|hour|hours|meter|meters|percent|ר"?מ|מר|מ(?:["׳])?|יחידה|יחידות|נקודה|נקודות|שעה|שעות|יום|ימים|מטר|מטרים)\s*$/i
const VISIT_CANONICAL_NAME = '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA'
const INSTALL_POINT_PREFIX_PATTERN =
  /^(?:install(?:ation)?|\u05D4\u05EA\u05E7\u05E0\u05EA|\u05D4\u05EA\u05E7\u05E0\u05D4)\s+(?=(?:\u05E0\u05E7\u05D5\u05D3\u05EA|water\s+point|point)(?:\s|$))/i
const UNIT_ONLY_KEYS = new Set([
  HE.sqmA,
  HE.sqmB,
  'm2',
  'sqm',
  HE.unit,
  HE.units,
  'unit',
  'units',
  HE.point,
  HE.points,
  'point',
  'points',
  HE.visit,
  HE.visits,
  'visit',
  'visits',
  HE.container,
  HE.containers,
  'container',
  'containers',
  HE.package,
  'package',
  HE.day,
  HE.days,
  'day',
  'days',
  HE.hour,
  HE.hours,
  'hour',
  'hours',
  HE.meter,
  HE.meters,
  'meter',
  'meters',
  HE.percent,
  HE.percents,
  'percent',
])

const GENERIC_NOISE_KEYS = new Set([
  HE.service,
  HE.serviceAlt,
  HE.work,
  HE.works,
  HE.item,
  HE.generic,
  HE.others,
  HE.install,
  HE.packageSingle,
  'service',
  'services',
  'item',
  'items',
  'general',
  'misc',
  'install',
  'package',
])
const GENERIC_PREFIX_TOKENS = new Set([HE.service, HE.serviceAlt, HE.work, 'service', 'work'])
const NOISY_SUFFIX_TOKENS = new Set([
  HE.odyEl,
  '\u05E2\u05D5\u05D3\u05D9',
  '\u05D0\u05DC',
  '\u05E8\u05D5\u05E7\u05D9\u05D1',
  '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
  'transport',
  'retem',
  'callout',
  '\u05D4\u05D5\u05D1\u05DC\u05D4',
  '\u05E7\u05D1\u05D5\u05E2',
  '\u05DE\u05D7\u05D9\u05E8',
])
const VISIT_PREFIX_TOKENS = new Set([HE.service, HE.serviceAlt, 'service', HE.visit, HE.visits, 'visit', 'callout'])
const VISIT_ALIAS_TOKENS = new Set([
  HE.visit,
  HE.visits,
  'visit',
  'visits',
  'callout',
  'servicecall',
  'service_call',
  '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
  '\u05E8\u05D5\u05E7\u05D9\u05D1',
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function shouldMapToVisitCanonical(text: string): boolean {
  const normalized = pricingCanonicalKey(text.replace(/[_-]+/g, ' '))
  if (!normalized) return false
  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length === 0) return false
  if (/(service[_\s-]*call|callout)/i.test(text)) return true
  if (VISIT_PREFIX_TOKENS.has(tokens[0])) return true
  return tokens.some((token) => VISIT_ALIAS_TOKENS.has(token))
}

export function cleanPricingItemName(value: string, unit: PricingUnit): string {
  if (shouldMapToVisitCanonical(value)) return VISIT_CANONICAL_NAME
  let text = value.replace(TRAILING_BRACKET_UNIT_PATTERN, ' ').trim()
  text = text.replace(/\u05E2\u05D5\u05D3\u05D9\s+\u05D0\u05DC/gi, ' ')
  text = text.replace(/\b(service[_\s-]*call|callout|transport|retem)\b/gi, ' ')
  text = text.replace(INSTALL_POINT_PREFIX_PATTERN, '')
  while (LEADING_UNIT_PATTERN.test(text)) text = text.replace(LEADING_UNIT_PATTERN, ' ').trim()
  while (TRAILING_UNIT_WORD_PATTERN.test(text)) text = text.replace(TRAILING_UNIT_WORD_PATTERN, ' ').trim()
  text = text.replace(/\s*[-/]\s*/g, ' ')
  let tokens = normalizeSpaces(text).split(' ').filter(Boolean)
  while (tokens.length > 2 && NOISY_SUFFIX_TOKENS.has(tokens[tokens.length - 1])) tokens.pop()
  text = tokens.join(' ')
  if (unit === 'percent') text = text.replace(/\s+\d{1,3}(?:[.,]\d+)?\s*$/g, ' ').trim()
  return normalizeSpaces(text)
}

export function pricingCanonicalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳³ֲ´׳³ֲ³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectPricingUnitHint(text: string): PricingUnit | null {
  const source = text.toLowerCase()
  if (/(נקוד|point|ביקור|visit|callout|service[_\s-]*call)/i.test(source)) return 'point'
  if (/(יום עבודה|ימים?|day)/i.test(source)) return 'day'
  if (/(מכול|container)/i.test(source)) return 'container'
  if (/(קומפלט|package|פינוי|פסולת|הובלת|transport|waste)/i.test(source)) return 'package'
  if (/%|אחוז|percent/.test(source)) return 'percent'
  if (/(מ\s*["׳³']?\s*ר|ר\s*["׳³']?\s*מ|sqm|m2|square)/i.test(source)) return 'sqm'
  if (/(מטר|meter|lm|linear)/i.test(source)) return 'meter'
  if (/(שעה|hours?)/i.test(source)) return 'hour'
  if (/(יחיד|unit|pcs)/i.test(source)) return 'unit'
  return null
}

export function isNoisePricingItemName(name: string): boolean {
  if (!name) return true
  const key = pricingCanonicalKey(name)
  if (UNIT_ONLY_KEYS.has(key) || GENERIC_NOISE_KEYS.has(key)) return true
  const tokens = key.split(' ').filter(Boolean)
  if (tokens.length === 0) return true
  if (tokens.length <= 2 && GENERIC_PREFIX_TOKENS.has(tokens[0])) return true
  return false
}
