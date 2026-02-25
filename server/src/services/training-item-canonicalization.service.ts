import { normalizeServiceProviderIndustry } from './service-provider-industries.service.js'
import type { PricingUnit } from '../types/model-profile.js'

type SupportedUnit = PricingUnit | 'custom'

const AUTOMOTIVE_INDUSTRIES = new Set<string>([
  'auto_electrician',
  'auto_mechanic',
  'auto_body_technician',
])
const GLOBAL_AREA_KEYWORDS = [
  'דשא',
  'קרקע',
  'ערוג',
  'ניכוש',
  'עשב',
  'חיפוי',
  'טוף',
  'סקאריפיקציה',
  'אוורור',
  'שבילים',
  'מרצפות',
  'הדחת',
  'תשתית',
  'ניקוי עלים',
  'שטח',
  'מרובע',
  'sqm',
  'm2',
  'square',
]
const GLOBAL_METER_KEYWORDS = ['גיזום', 'גדר', 'טפטוף', 'השקיה', 'צינור', 'קו', 'meter']
const GLOBAL_FIXED_KEYWORDS = ['מחיר קבוע', 'ייעוץ', 'תכנון', 'הדברה', 'איתור נזילה', 'תיקון', 'fixed']
const GLOBAL_TRANSPORT_KEYWORDS = ['פינוי', 'גזם', 'פסולת', 'הובלה', 'transport', 'waste']

const NORMALIZE_WORDS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /מסננים?/gi, replacement: 'פילטר' },
  { pattern: /פילטרים/gi, replacement: 'פילטר' },
  { pattern: /מצתים/gi, replacement: 'פלאגים' },
  { pattern: /\s+/g, replacement: ' ' },
]

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeNameForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳´׳³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isKnownUnit(value: string): value is PricingUnit {
  return (
    value === 'sqm' ||
    value === 'unit' ||
    value === 'point' ||
    value === 'day' ||
    value === 'container' ||
    value === 'package' ||
    value === 'hour' ||
    value === 'meter' ||
    value === 'fixed' ||
    value === 'percent' ||
    value === 'unknown'
  )
}

function normalizeCommonName(input: string): string {
  let output = normalizeSpaces(input)
  output = output.replace(/\s*[-/]\s*/g, ' ')
  output = output.replace(/\s+\d+\s*$/g, ' ')
  output = output.replace(/\s+/g, ' ')
  return output.trim()
}

function collapseRepeatedWords(value: string): string {
  const words = normalizeSpaces(value).split(' ')
  const output: string[] = []
  words.forEach((word) => {
    if (output.length === 0 || output[output.length - 1] !== word) {
      output.push(word)
    }
  })
  return output.join(' ')
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

function inferUnknownUnitFromName(key: string): PricingUnit {
  if (key.includes('ביקור') || key.includes('visit') || key.includes('point')) return 'point'
  if (key.includes('שעה') || key.includes('hour')) return 'hour'
  if (key.includes('יום') || key.includes('day')) return 'day'
  if (key.includes('אחוז') || key.includes('percent') || key.includes('%')) return 'percent'
  if (key.includes('מכול') || key.includes('container')) return 'container'
  if (key.includes('קומפלט') || key.includes('package') || includesAny(key, GLOBAL_TRANSPORT_KEYWORDS)) {
    return 'package'
  }
  if (includesAny(key, GLOBAL_FIXED_KEYWORDS)) return 'fixed'
  if (key.includes('מ ר') || key.includes('ר מ') || key.includes('sqm') || key.includes('m2')) {
    return 'sqm'
  }
  if (includesAny(key, GLOBAL_AREA_KEYWORDS)) return 'sqm'
  if (key.includes('מטר') || includesAny(key, GLOBAL_METER_KEYWORDS)) return 'meter'
  return 'unit'
}

function normalizeUnitGlobal(unit: SupportedUnit, key: string): SupportedUnit {
  if (unit === 'custom') return unit

  if (unit === 'meter') {
    if (includesAny(key, GLOBAL_AREA_KEYWORDS) && !includesAny(key, GLOBAL_METER_KEYWORDS)) {
      return 'sqm'
    }
    return unit
  }

  if (unit === 'fixed' && includesAny(key, GLOBAL_TRANSPORT_KEYWORDS)) {
    return 'package'
  }

  if (unit !== 'unknown') {
    return unit
  }

  return inferUnknownUnitFromName(key)
}

function normalizeAutomotiveName(input: string): string {
  let output = normalizeCommonName(input)
  NORMALIZE_WORDS.forEach(({ pattern, replacement }) => {
    output = output.replace(pattern, replacement)
  })
  output = output.replace(/\s+(ציר(?:\s*\d+)?|זוג|סט)\s*$/gi, '')
  output = collapseRepeatedWords(output)

  const normalizedKey = normalizeNameForKey(output)
  if (
    normalizedKey.includes('טיפול') &&
    normalizedKey.includes('שמן') &&
    (normalizedKey.includes('פילטר') || normalizedKey.includes('מסנן'))
  ) {
    return 'טיפול שמנים ופילטר'
  }
  return output
}

function normalizeUnitForIndustry(
  unit: SupportedUnit,
  itemName: string,
  industry: string,
): SupportedUnit {
  const key = normalizeNameForKey(itemName)
  const globalUnit = normalizeUnitGlobal(unit, key)

  if (AUTOMOTIVE_INDUSTRIES.has(industry)) {
    // Keep an automotive-safe fallback if global policy couldn't infer.
    return globalUnit === 'unknown' ? 'unit' : globalUnit
  }

  return globalUnit
}

export function canonicalizeTrainingItemForIndustry(
  itemName: string,
  unit: string,
  industryInput: string | null | undefined,
): { itemName: string; unit: SupportedUnit; itemKey: string } {
  const industry = normalizeServiceProviderIndustry(industryInput ?? '')
  const safeUnit: SupportedUnit = isKnownUnit(unit) ? unit : 'custom'
  const baseName = normalizeCommonName(itemName)
  const canonicalName = AUTOMOTIVE_INDUSTRIES.has(industry)
    ? normalizeAutomotiveName(baseName)
    : baseName
  const canonicalUnit = normalizeUnitForIndustry(safeUnit, canonicalName, industry)
  const itemKey = `${normalizeNameForKey(canonicalName)}|${canonicalUnit}`

  return {
    itemName: canonicalName,
    unit: canonicalUnit,
    itemKey,
  }
}
