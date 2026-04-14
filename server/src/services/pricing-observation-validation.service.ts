import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import { buildMedianMap, buildRobustBoundsMap } from './pricing-outlier-stats.service.js'
import { detectUnit } from './pricing-parser-utils.service.js'
import { mapUnitToken } from './pricing-unit-utils.service.js'
import {
  ALLOWED_UNITS,
  addDropReason,
  createDropSummary,
  hasGenericCanonicalName,
  isAllowedUnit,
  isPositiveFinite,
  mapServiceLikeNameToVisitCanonical,
  priceKeyForObservation,
  round2,
  type ValidationDropSummary,
} from './pricing-observation-validation-utils.service.js'
import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'

export type ObservationValidationStats = {
  input: number
  kept: number
  dropped: number
  droppedByReason: ValidationDropSummary
}

function resolveObservationUnit(observation: PricingObservation): PricingUnit | null {
  const currentUnit = observation.unit
  if (ALLOWED_UNITS.has(currentUnit)) return currentUnit

  const sources = [
    observation.sourceLine,
    observation.rawName,
    observation.canonicalName,
    String(currentUnit ?? ''),
  ]

  for (const source of sources) {
    const inferred = detectUnit(source)
    if (ALLOWED_UNITS.has(inferred)) return inferred

    const tokenCandidates = source
      .split(/[\s()[\]{}:;,.|/-]+/)
      .map((token) => mapUnitToken(token))
      .filter((unit): unit is PricingUnit => unit !== null)
      .filter((unit) => ALLOWED_UNITS.has(unit))
    if (tokenCandidates.length > 0) return tokenCandidates[0]
  }

  return currentUnit === 'unknown' ? 'unknown' : null
}

function withValidatedBaseFields(
  observation: PricingObservation,
  droppedByReason: ValidationDropSummary,
  options: { industry?: string | null },
): PricingObservation | null {
  const unit = resolveObservationUnit(observation)
  if (!unit) {
    addDropReason(droppedByReason, 'invalid_unit')
    return null
  }

  const canonical = canonicalizeTrainingItemForIndustry(
    observation.canonicalName || observation.rawName,
    unit,
    options.industry ?? null,
  )

  const mappedVisitName =
    mapServiceLikeNameToVisitCanonical(observation.sourceLine) ??
    mapServiceLikeNameToVisitCanonical(observation.canonicalName) ??
    mapServiceLikeNameToVisitCanonical(observation.rawName) ??
    mapServiceLikeNameToVisitCanonical(canonical.itemName)

  const canonicalUnit = mappedVisitName ? 'point' : canonical.unit
  const canonicalName = mappedVisitName ?? canonical.itemName
  if (!isAllowedUnit(canonicalUnit)) {
    addDropReason(droppedByReason, 'invalid_unit')
    return null
  }

  const normalizedObservation: PricingObservation = {
    ...observation,
    rawName: mappedVisitName ?? observation.rawName,
    canonicalName,
    unit: canonicalUnit,
  }
  if (hasGenericCanonicalName(normalizedObservation)) {
    addDropReason(droppedByReason, 'generic_name')
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
  const nextLineTotal = isPositiveFinite(observation.lineTotal)
    ? observation.lineTotal
    : computedLineTotal
  if (!isPositiveFinite(nextLineTotal)) {
    addDropReason(droppedByReason, 'invalid_line_total')
    return null
  }

  return { ...normalizedObservation, lineTotal: round2(nextLineTotal) }
}

function keepByOutlierThreshold(
  observation: PricingObservation,
  mediansByKey: Map<string, number>,
  robustBoundsByKey: Map<string, { low: number; high: number }>,
  droppedByReason: ValidationDropSummary,
): boolean {
  const key = priceKeyForObservation(observation)
  const medianPrice = mediansByKey.get(key)
  if (!medianPrice || !Number.isFinite(medianPrice) || medianPrice <= 0) return true

  if (observation.pricePerUnit > medianPrice * 10) {
    addDropReason(droppedByReason, 'extreme_price_high')
    return false
  }
  if (observation.pricePerUnit < medianPrice * 0.1) {
    addDropReason(droppedByReason, 'extreme_price_low')
    return false
  }

  const robustBounds = robustBoundsByKey.get(key)
  if (!robustBounds) return true
  if (observation.pricePerUnit > robustBounds.high) {
    addDropReason(droppedByReason, 'extreme_price_high')
    return false
  }
  if (observation.pricePerUnit < robustBounds.low) {
    addDropReason(droppedByReason, 'extreme_price_low')
    return false
  }
  return true
}

export function validateObservationsForTraining(
  observations: PricingObservation[],
  options: { industry?: string | null } = {},
): { observations: PricingObservation[]; stats: ObservationValidationStats } {
  const droppedByReason = createDropSummary()
  const withBaseValidation = observations
    .map((observation) => withValidatedBaseFields(observation, droppedByReason, options))
    .filter((observation): observation is PricingObservation => observation !== null)

  const mediansByKey = buildMedianMap(
    withBaseValidation,
    priceKeyForObservation,
    (observation) => observation.pricePerUnit,
  )
  const robustBoundsByKey = buildRobustBoundsMap(
    withBaseValidation,
    priceKeyForObservation,
    (observation) => observation.pricePerUnit,
  )
  const cleaned = withBaseValidation.filter((observation) =>
    keepByOutlierThreshold(observation, mediansByKey, robustBoundsByKey, droppedByReason),
  )

  return {
    observations: cleaned,
    stats: {
      input: observations.length,
      kept: cleaned.length,
      dropped: observations.length - cleaned.length,
      droppedByReason,
    },
  }
}
