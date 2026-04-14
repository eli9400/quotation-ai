import { normalizeServiceProviderIndustry } from './service-provider-industries.service.js'
import { normalizeGenericTrainingItemName } from './training-item-name-normalization.service.js'
import type { PricingUnit } from '../types/model-profile.js'

type SupportedUnit = PricingUnit | 'custom'

const HE = {
  visit: '\u05D1\u05D9\u05E7\u05D5\u05E8',
  hour: '\u05E9\u05E2\u05D4',
  day: '\u05D9\u05D5\u05DD',
  percent: '\u05D0\u05D7\u05D5\u05D6',
  container: '\u05DE\u05DB\u05D5\u05DC',
  package: '\u05E7\u05D5\u05DE\u05E4\u05DC\u05D8',
  sqmA: '\u05DE \u05E8',
  sqmB: '\u05E8 \u05DE',
  meter: '\u05DE\u05D8\u05E8',
  fixedPrice: '\u05DE\u05D7\u05D9\u05E8 \u05E7\u05D1\u05D5\u05E2',
  consult: '\u05D9\u05D9\u05E2\u05D5\u05E5',
  planning: '\u05EA\u05DB\u05E0\u05D5\u05DF',
  pestControl: '\u05D4\u05D3\u05D1\u05E8\u05D4',
  leak: '\u05D0\u05D9\u05EA\u05D5\u05E8 \u05E0\u05D6\u05D9\u05DC\u05D4',
  repair: '\u05EA\u05D9\u05E7\u05D5\u05DF',
  wasteClear: '\u05E4\u05D9\u05E0\u05D5\u05D9',
  branches: '\u05D2\u05D6\u05DD',
  waste: '\u05E4\u05E1\u05D5\u05DC\u05EA',
  transport: '\u05D4\u05D5\u05D1\u05DC\u05D4',
  transportAlt: '\u05D4\u05D5\u05D1\u05DC\u05EA',
  grass: '\u05D3\u05E9\u05D0',
  soil: '\u05E7\u05E8\u05E7\u05E2',
  bed: '\u05E2\u05E8\u05D5\u05D2',
  weeding: '\u05E0\u05D9\u05DB\u05D5\u05E9',
  weed: '\u05E2\u05E9\u05D1',
  cover: '\u05D7\u05D9\u05E4\u05D5\u05D9',
  tuff: '\u05D8\u05D5\u05E3',
  scarification: '\u05E1\u05E7\u05D0\u05E8\u05D9\u05E4\u05D9\u05E7\u05E6\u05D9\u05D4',
  aeration: '\u05D0\u05D5\u05D5\u05E8\u05D5\u05E8',
  paths: '\u05E9\u05D1\u05D9\u05DC\u05D9\u05DD',
  tiles: '\u05DE\u05E8\u05E6\u05E4\u05D5\u05EA',
  wash: '\u05D4\u05D3\u05D7\u05EA',
  infra: '\u05EA\u05E9\u05EA\u05D9\u05EA',
  leafClean: '\u05E0\u05D9\u05E7\u05D5\u05D9 \u05E2\u05DC\u05D9\u05DD',
  area: '\u05E9\u05D8\u05D7',
  square: '\u05DE\u05E8\u05D5\u05D1\u05E2',
  pruning: '\u05D2\u05D9\u05D6\u05D5\u05DD',
  hedge: '\u05D2\u05D3\u05E8',
  drip: '\u05D8\u05E4\u05D8\u05D5\u05E3',
  irrigation: '\u05D4\u05E9\u05E7\u05D9\u05D4',
  pipe: '\u05E6\u05D9\u05E0\u05D5\u05E8',
  line: '\u05E7\u05D5',
  filter: '\u05E4\u05D9\u05DC\u05D8\u05E8',
  filters: '\u05E4\u05D9\u05DC\u05D8\u05E8\u05D9\u05DD',
  strainer: '\u05DE\u05E1\u05E0\u05DF',
  strainers: '\u05DE\u05E1\u05E0\u05E0\u05D9\u05DD',
  sparks: '\u05DE\u05E6\u05EA\u05D9\u05DD',
  plugs: '\u05E4\u05DC\u05D0\u05D2\u05D9\u05DD',
  service: '\u05D8\u05D9\u05E4\u05D5\u05DC',
  oil: '\u05E9\u05DE\u05DF',
  oils: '\u05E9\u05DE\u05E0\u05D9\u05DD',
  axle: '\u05E6\u05D9\u05E8',
  pair: '\u05D6\u05D5\u05D2',
  set: '\u05E1\u05D8',
  genericService: '\u05E9\u05D9\u05E8\u05D5\u05EA',
  genericWork: '\u05E2\u05D1\u05D5\u05D3\u05D4',
  genericItem: '\u05E4\u05E8\u05D9\u05D8',
} as const

const AUTOMOTIVE_INDUSTRIES = new Set(['auto_electrician', 'auto_mechanic', 'auto_body_technician'])
const GLOBAL_AREA_KEYWORDS = [
  HE.grass,
  HE.soil,
  HE.bed,
  HE.weeding,
  HE.weed,
  HE.cover,
  HE.tuff,
  HE.scarification,
  HE.aeration,
  HE.paths,
  HE.tiles,
  HE.wash,
  HE.infra,
  HE.leafClean,
  HE.area,
  HE.square,
  'sqm',
  'm2',
  'square',
]

const GLOBAL_METER_KEYWORDS = [HE.pruning, HE.hedge, HE.drip, HE.irrigation, HE.pipe, HE.line, 'meter']
const GLOBAL_FIXED_KEYWORDS = [HE.fixedPrice, HE.consult, HE.planning, HE.pestControl, HE.leak, HE.repair, 'fixed']
const GLOBAL_TRANSPORT_KEYWORDS = [
  HE.wasteClear,
  HE.branches,
  HE.waste,
  HE.transport,
  HE.transportAlt,
  'transport',
  'waste',
  'service call',
  'callout',
]
const VISIT_SERVICE_CANONICAL = '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA'

const WEAK_KEY_TOKENS = new Set([
  'service',
  'work',
  'job',
  'item',
  'transport',
  'callout',
  'retem',
  '\u05E2\u05D5\u05D3\u05D9',
  '\u05D0\u05DC',
  HE.genericService,
  HE.genericWork,
  HE.genericItem,
])
const NORMALIZE_WORDS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: new RegExp(`${HE.strainer}s?`, 'gi'), replacement: HE.filter },
  { pattern: new RegExp(HE.filters, 'gi'), replacement: HE.filter },
  { pattern: new RegExp(HE.sparks, 'gi'), replacement: HE.plugs },
  { pattern: /\s+/g, replacement: ' ' },
]

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeNameForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳³ֲ´׳³ֲ³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeNameForItemKey(value: string): string {
  const tokens = normalizeNameForKey(value).split(' ').filter((token) => token.length > 0)
  const reduced = tokens.filter((token) => !WEAK_KEY_TOKENS.has(token))
  const source = reduced.length >= 2 ? reduced : tokens
  return Array.from(new Set(source)).sort((left, right) => left.localeCompare(right)).join(' ')
}

function isKnownUnit(value: string): value is PricingUnit {
  return ['sqm', 'unit', 'point', 'day', 'container', 'package', 'hour', 'meter', 'fixed', 'percent', 'unknown'].includes(value)
}

function normalizeCommonName(input: string): string {
  return normalizeGenericTrainingItemName(input)
}

function collapseRepeatedWords(value: string): string {
  const words = normalizeSpaces(value).split(' ')
  const output: string[] = []
  words.forEach((word) => {
    if (output.length === 0 || output[output.length - 1] !== word) output.push(word)
  })
  return output.join(' ')
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

function inferUnknownUnitFromName(key: string): PricingUnit {
  if (key.includes(HE.visit) || key.includes('visit') || key.includes('point')) return 'point'
  if (key.includes(HE.hour) || key.includes('hour')) return 'hour'
  if (key.includes(HE.day) || key.includes('day')) return 'day'
  if (key.includes(HE.percent) || key.includes('percent') || key.includes('%')) return 'percent'
  if (key.includes(HE.container) || key.includes('container')) return 'container'
  if (key.includes(HE.package) || key.includes('package') || includesAny(key, GLOBAL_TRANSPORT_KEYWORDS)) return 'package'
  if (includesAny(key, GLOBAL_FIXED_KEYWORDS)) return 'fixed'
  if (key.includes(HE.sqmA) || key.includes(HE.sqmB) || key.includes('sqm') || key.includes('m2')) return 'sqm'
  if (includesAny(key, GLOBAL_AREA_KEYWORDS)) return 'sqm'
  if (key.includes(HE.meter) || includesAny(key, GLOBAL_METER_KEYWORDS)) return 'meter'
  return 'unknown'
}

function normalizeUnitGlobal(unit: SupportedUnit, key: string): SupportedUnit {
  if (unit === 'custom') return unit
  if (key.includes(VISIT_SERVICE_CANONICAL) || key.includes(HE.visit) || key.includes('visit')) {
    return 'point'
  }
  if (unit === 'meter' && includesAny(key, GLOBAL_AREA_KEYWORDS) && !includesAny(key, GLOBAL_METER_KEYWORDS)) return 'sqm'
  if (includesAny(key, GLOBAL_TRANSPORT_KEYWORDS) && (unit === 'fixed' || unit === 'unit' || unit === 'unknown')) return 'package'
  if (unit !== 'unknown') return unit
  return inferUnknownUnitFromName(key)
}

function normalizeAutomotiveName(input: string): string {
  let output = normalizeCommonName(input)
  NORMALIZE_WORDS.forEach(({ pattern, replacement }) => {
    output = output.replace(pattern, replacement)
  })
  output = output.replace(new RegExp(`\\s+(${HE.axle}(?:\\s*\\d+)?|${HE.pair}|${HE.set})\\s*$`, 'gi'), '')
  output = collapseRepeatedWords(output)

  const normalizedKey = normalizeNameForKey(output)
  if (
    normalizedKey.includes(HE.service) &&
    (normalizedKey.includes(HE.oil) || normalizedKey.includes(HE.oils)) &&
    (normalizedKey.includes(HE.filter) || normalizedKey.includes(HE.strainer))
  ) {
    return `${HE.service} ${HE.oils} \u05D5${HE.filter}`
  }
  return output
}

function normalizeUnitForIndustry(
  unit: SupportedUnit,
  itemName: string,
  industry: string,
  rawSource: string,
): SupportedUnit {
  const key = normalizeNameForKey(`${itemName} ${rawSource}`)
  const globalUnit = normalizeUnitGlobal(unit, key)
  if (AUTOMOTIVE_INDUSTRIES.has(industry)) return globalUnit === 'unknown' ? 'unit' : globalUnit
  return globalUnit
}

export function canonicalizeTrainingItemForIndustry(
  itemName: string,
  unit: string,
  industryInput: string | null | undefined,
): { itemName: string; unit: SupportedUnit; itemKey: string } {
  const industry = normalizeServiceProviderIndustry(industryInput ?? '')
  const safeUnit: SupportedUnit = isKnownUnit(unit) ? unit : 'custom'
  const rawSource = itemName
  const baseName = normalizeCommonName(itemName)
  const canonicalName = AUTOMOTIVE_INDUSTRIES.has(industry) ? normalizeAutomotiveName(baseName) : baseName
  const canonicalUnit = normalizeUnitForIndustry(safeUnit, canonicalName, industry, rawSource)
  const itemKey = `${normalizeNameForItemKey(canonicalName)}|${canonicalUnit}`
  return { itemName: canonicalName, unit: canonicalUnit, itemKey }
}
