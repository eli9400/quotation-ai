import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import { detectUnit } from './pricing-parser-utils.service.js'
import { mapUnitToken } from './pricing-unit-utils.service.js'
const ALLOWED_UNITS = new Set<PricingUnit>(['sqm', 'unit', 'point', 'day', 'container', 'package', 'hour', 'meter', 'fixed', 'percent'])
const GENERIC_NAME_KEYS = new Set<string>(['שירות', 'שרות', 'עבודה', 'עבודות', 'פריט', 'כללי', 'שונות', 'service', 'services', 'item', 'items', 'general', 'misc'])

type ValidationDropReason =
  | 'generic_name'
  | 'invalid_unit'
  | 'invalid_quantity'
  | 'invalid_price'
  | 'invalid_line_total'
  | 'extreme_price_high'
  | 'extreme_price_low'

type ValidationDropSummary = Record<ValidationDropReason, number>

export type ObservationValidationStats = {
  input: number
  kept: number
  dropped: number
  droppedByReason: ValidationDropSummary
}

function createDropSummary(): ValidationDropSummary {
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

function addDropReason(summary: ValidationDropSummary, reason: ValidationDropReason): void {
  summary[reason] += 1
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeItemKeySource(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳´׳³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasGenericCanonicalName(observation: PricingObservation): boolean {
  const canonical = normalizeItemKeySource(observation.canonicalName)
  const raw = normalizeItemKeySource(observation.rawName)
  return GENERIC_NAME_KEYS.has(canonical) || GENERIC_NAME_KEYS.has(raw)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function resolveObservationUnit(observation: PricingObservation): PricingUnit | null {
  const currentUnit = observation.unit
  if (ALLOWED_UNITS.has(currentUnit)) {
    return currentUnit
  }

  const sources = [
    observation.sourceLine,
    observation.rawName,
    observation.canonicalName,
    String(currentUnit ?? ''),
  ]

  for (const source of sources) {
    const inferred = detectUnit(source)
    if (ALLOWED_UNITS.has(inferred)) {
      return inferred
    }

    const tokenCandidates = source
      .split(/[\s()[\]{}:;,.|/-]+/)
      .map((token) => mapUnitToken(token))
      .filter((unit): unit is PricingUnit => unit !== null)
      .filter((unit) => ALLOWED_UNITS.has(unit))
    if (tokenCandidates.length > 0) {
      return tokenCandidates[0]
    }
  }

  return null
}

function priceKeyForObservation(observation: PricingObservation): string {
  return `${normalizeItemKeySource(observation.canonicalName)}|${observation.unit}`
}

function buildMedianByKey(observations: PricingObservation[]): Map<string, number> {
  const grouped = new Map<string, number[]>()
  observations.forEach((observation) => {
    const key = priceKeyForObservation(observation)
    const prices = grouped.get(key) ?? []
    prices.push(observation.pricePerUnit)
    grouped.set(key, prices)
  })

  const medians = new Map<string, number>()
  grouped.forEach((prices, key) => {
    medians.set(key, median(prices))
  })
  return medians
}

function withValidatedBaseFields(
  observation: PricingObservation,
  droppedByReason: ValidationDropSummary,
): PricingObservation | null {
  if (hasGenericCanonicalName(observation)) {
    addDropReason(droppedByReason, 'generic_name')
    return null
  }

  const unit = resolveObservationUnit(observation)
  if (!unit) {
    addDropReason(droppedByReason, 'invalid_unit')
    return null
  }

  if (!isPositiveFinite(observation.quantity)) {
    addDropReason(droppedByReason, 'invalid_quantity')
    return null
  }

  if (!isPositiveFinite(observation.pricePerUnit)) {
    addDropReason(droppedByReason, 'invalid_price')
    return null
  }

  const computedLineTotal = observation.quantity * observation.pricePerUnit
  const nextLineTotal = isPositiveFinite(observation.lineTotal) ? observation.lineTotal : computedLineTotal
  if (!isPositiveFinite(nextLineTotal)) {
    addDropReason(droppedByReason, 'invalid_line_total')
    return null
  }

  return {
    ...observation,
    unit,
    lineTotal: round2(nextLineTotal),
  }
}

function keepByMedianThreshold(
  observation: PricingObservation,
  mediansByKey: Map<string, number>,
  droppedByReason: ValidationDropSummary,
): boolean {
  const medianPrice = mediansByKey.get(priceKeyForObservation(observation))
  if (!medianPrice || !Number.isFinite(medianPrice) || medianPrice <= 0) {
    return true
  }

  if (observation.pricePerUnit > medianPrice * 10) {
    addDropReason(droppedByReason, 'extreme_price_high')
    return false
  }

  if (observation.pricePerUnit < medianPrice * 0.1) {
    addDropReason(droppedByReason, 'extreme_price_low')
    return false
  }

  return true
}

export function validateObservationsForTraining(
  observations: PricingObservation[],
): { observations: PricingObservation[]; stats: ObservationValidationStats } {
  const droppedByReason = createDropSummary()
  const withBaseValidation = observations
    .map((observation) => withValidatedBaseFields(observation, droppedByReason))
    .filter((observation): observation is PricingObservation => observation !== null)

  const mediansByKey = buildMedianByKey(withBaseValidation)
  const cleaned = withBaseValidation.filter((observation) =>
    keepByMedianThreshold(observation, mediansByKey, droppedByReason),
  )

  const stats: ObservationValidationStats = {
    input: observations.length,
    kept: cleaned.length,
    dropped: observations.length - cleaned.length,
    droppedByReason,
  }

  return {
    observations: cleaned,
    stats,
  }
}
