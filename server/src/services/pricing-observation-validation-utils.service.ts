import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'

export type ValidationDropReason =
  | 'generic_name'
  | 'invalid_unit'
  | 'invalid_quantity'
  | 'invalid_price'
  | 'invalid_line_total'
  | 'extreme_price_high'
  | 'extreme_price_low'

export type ValidationDropSummary = Record<ValidationDropReason, number>

export const ALLOWED_UNITS = new Set<PricingUnit>([
  'sqm',
  'unit',
  'point',
  'day',
  'container',
  'package',
  'hour',
  'meter',
  'fixed',
  'percent',
])

const HE = {
  service: '\u05E9\u05D9\u05E8\u05D5\u05EA',
  serviceAlt: '\u05E9\u05E8\u05D5\u05EA',
  visit: '\u05D1\u05D9\u05E7\u05D5\u05E8',
  visits: '\u05D1\u05D9\u05E7\u05D5\u05E8\u05D9\u05DD',
  visitCanonical: '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA',
  work: '\u05E2\u05D1\u05D5\u05D3\u05D4',
  works: '\u05E2\u05D1\u05D5\u05D3\u05D5\u05EA',
  item: '\u05E4\u05E8\u05D9\u05D8',
  generic: '\u05DB\u05DC\u05DC\u05D9',
  other: '\u05E9\u05D5\u05E0\u05D5\u05EA',
  install: '\u05D4\u05EA\u05E7\u05E0\u05D4',
  package: '\u05D7\u05D1\u05D9\u05DC\u05EA',
  reverseVisits: '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
} as const

const GENERIC_NAME_KEYS = new Set([
  HE.service,
  HE.serviceAlt,
  HE.work,
  HE.works,
  HE.item,
  HE.generic,
  HE.other,
  'service',
  'services',
  'item',
  'items',
  'general',
  'misc',
])

const BROAD_SINGLE_NAME_KEYS = new Set([HE.install, HE.package, 'install', 'package'])
const GENERIC_PREFIXES = new Set([HE.service, HE.serviceAlt, HE.work, 'service', 'work'])
const VISIT_PREFIX_KEYS = new Set([
  HE.service,
  HE.serviceAlt,
  HE.visit,
  HE.visits,
  'service',
  'visit',
  'visits',
  'callout',
])
const VISIT_ALIAS_KEYS = new Set([
  HE.visit,
  HE.visits,
  HE.reverseVisits,
  'visit',
  'visits',
  'callout',
  'servicecall',
  'service_call',
  '\u05E8\u05D5\u05E7\u05D9\u05D1',
  '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
])
const GENERIC_NOISY_TOKENS = new Set([
  '\u05E8\u05D5\u05E7\u05D9\u05D1',
  HE.reverseVisits,
  'callout',
  'servicecall',
  'service_call',
])

export function createDropSummary(): ValidationDropSummary {
  return {
    generic_name: 0,
    invalid_unit: 0,
    invalid_quantity: 0,
    invalid_price: 0,
    invalid_line_total: 0,
    extreme_price_high: 0,
    extreme_price_low: 0,
  }
}

export function addDropReason(summary: ValidationDropSummary, reason: ValidationDropReason): void {
  summary[reason] += 1
}

export function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function isAllowedUnit(value: string): value is PricingUnit {
  return ALLOWED_UNITS.has(value as PricingUnit)
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeItemKeySource(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳³ֲ´׳³ֲ³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTokens(value: string): string[] {
  return normalizeItemKeySource(value).split(' ').filter(Boolean)
}

export function mapServiceLikeNameToVisitCanonical(value: string): string | null {
  const source = value.trim()
  if (!source) return null
  if (/(service[_\s-]*call|callout)/i.test(source)) return HE.visitCanonical
  const tokens = normalizeTokens(source)
  if (tokens.length === 0) return null
  if (VISIT_PREFIX_KEYS.has(tokens[0])) return HE.visitCanonical
  if (tokens.some((token) => VISIT_ALIAS_KEYS.has(token))) return HE.visitCanonical
  return null
}

function isLikelyGenericName(value: string): boolean {
  const normalized = normalizeItemKeySource(value)
  if (!normalized) return true
  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length === 0) return true
  if (tokens.length === 1) return GENERIC_NAME_KEYS.has(tokens[0]) || BROAD_SINGLE_NAME_KEYS.has(tokens[0])
  if (GENERIC_PREFIXES.has(tokens[0])) return true
  if (tokens.length <= 2 && tokens.some((token) => GENERIC_NOISY_TOKENS.has(token))) return true
  if (normalized.includes(HE.reverseVisits) && tokens.length <= 2) return true
  return false
}

export function hasGenericCanonicalName(observation: PricingObservation): boolean {
  return isLikelyGenericName(observation.canonicalName) || isLikelyGenericName(observation.rawName)
}

export function priceKeyForObservation(observation: PricingObservation): string {
  return `${normalizeItemKeySource(observation.canonicalName)}|${observation.unit}`
}
