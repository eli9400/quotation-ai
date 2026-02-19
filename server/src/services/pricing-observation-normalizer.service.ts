import type { PricingObservation } from '../types/pricing-observation.js'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clampDiscount(value: number | null): number | null {
  if (value === null) {
    return null
  }
  if (!Number.isFinite(value) || value <= 0 || value > 90) {
    return null
  }
  return value
}

function normalizeVat(observation: PricingObservation): PricingObservation {
  if (observation.vatMode !== 'included') {
    return observation
  }

  const rate = observation.vatRate ?? 17
  if (!Number.isFinite(rate) || rate <= 0 || rate > 30) {
    return observation
  }

  const factor = 1 + rate / 100
  return {
    ...observation,
    pricePerUnit: round2(observation.pricePerUnit / factor),
    lineTotal: round2(observation.lineTotal / factor),
  }
}

function normalizeDiscount(observation: PricingObservation): PricingObservation {
  const discountPercent = clampDiscount(observation.discountPercent)
  if (!discountPercent) {
    return observation
  }

  const factor = 1 - discountPercent / 100
  if (factor <= 0 || factor >= 1) {
    return observation
  }

  return {
    ...observation,
    pricePerUnit: round2(observation.pricePerUnit * factor),
    lineTotal: round2(observation.lineTotal * factor),
  }
}

function keepPositiveObservation(observation: PricingObservation): PricingObservation | null {
  if (observation.pricePerUnit <= 0 || observation.lineTotal <= 0 || observation.quantity <= 0) {
    return null
  }
  const lineTotal = round2(observation.pricePerUnit * observation.quantity)
  return {
    ...observation,
    lineTotal,
  }
}

export function normalizeObservationsForTraining(
  observations: PricingObservation[],
): PricingObservation[] {
  return observations
    .map((observation) => normalizeVat(observation))
    .map((observation) => normalizeDiscount(observation))
    .map((observation) => keepPositiveObservation(observation))
    .filter((observation): observation is PricingObservation => observation !== null)
}
