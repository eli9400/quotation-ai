import { normalizeServiceProviderIndustry } from './service-provider-industries.service.js'
import type { PricingUnit } from '../types/model-profile.js'

type SupportedUnit = PricingUnit | 'custom'

const AUTOMOTIVE_INDUSTRIES = new Set<string>([
  'auto_electrician',
  'auto_mechanic',
  'auto_body_technician',
])

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
  if (unit === 'custom' || !AUTOMOTIVE_INDUSTRIES.has(industry)) return unit
  if (unit !== 'unknown' && unit !== 'fixed') return unit

  const key = normalizeNameForKey(itemName)
  if (key.includes('שעה') || key.includes('hour')) return 'hour'
  if (key.includes('יום') || key.includes('day')) return 'day'
  if (key.includes('אחוז') || key.includes('percent') || key.includes('%')) return 'percent'
  if (key.includes('מטר') || key.includes('meter')) return 'meter'
  if (key.includes('קומפלט') || key.includes('package')) return 'package'
  return 'unit'
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
