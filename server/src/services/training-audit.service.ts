import type { PricingObservation } from '../types/pricing-observation.js'
import type { ObservationValidationStats } from './pricing-observation-validation.service.js'

type UnitDistribution = Record<string, number>

export type TrainingAuditReport = {
  inputRows: number
  keptRows: number
  droppedRows: number
  droppedByReason: ObservationValidationStats['droppedByReason']
  unknownUnits: number
  meterUnits: number
  sqmUnits: number
  unitDistribution: UnitDistribution
  uniqueItemKeys: number
  uniqueCanonicalNames: number
  itemKeyFragmentationRatio: number
  outlierSummary: {
    extremeHigh: number
    extremeLow: number
  }
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳´׳³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function buildUnitDistribution(observations: PricingObservation[]): UnitDistribution {
  const result: UnitDistribution = {}
  observations.forEach((observation) => {
    const key = observation.unit
    result[key] = (result[key] ?? 0) + 1
  })
  return result
}

function countUniqueItemKeys(observations: PricingObservation[]): number {
  const unique = new Set<string>()
  observations.forEach((observation) => {
    unique.add(`${normalizeName(observation.canonicalName)}|${observation.unit}`)
  })
  return unique.size
}

function countUniqueCanonicalNames(observations: PricingObservation[]): number {
  const unique = new Set<string>()
  observations.forEach((observation) => {
    unique.add(normalizeName(observation.canonicalName))
  })
  return unique.size
}

export function buildTrainingAuditReport(
  observations: PricingObservation[],
  validationStats: ObservationValidationStats,
): TrainingAuditReport {
  const unitDistribution = buildUnitDistribution(observations)
  const uniqueItemKeys = countUniqueItemKeys(observations)
  const uniqueCanonicalNames = countUniqueCanonicalNames(observations)
  const ratioBase = uniqueCanonicalNames > 0 ? uniqueCanonicalNames : 1

  return {
    inputRows: validationStats.input,
    keptRows: validationStats.kept,
    droppedRows: validationStats.dropped,
    droppedByReason: validationStats.droppedByReason,
    unknownUnits: unitDistribution.unknown ?? 0,
    meterUnits: unitDistribution.meter ?? 0,
    sqmUnits: unitDistribution.sqm ?? 0,
    unitDistribution,
    uniqueItemKeys,
    uniqueCanonicalNames,
    itemKeyFragmentationRatio: round3(uniqueItemKeys / ratioBase),
    outlierSummary: {
      extremeHigh: validationStats.droppedByReason.extreme_price_high,
      extremeLow: validationStats.droppedByReason.extreme_price_low,
    },
  }
}
