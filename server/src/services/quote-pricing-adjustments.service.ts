import type { QuoteCpiAdjustment, QuotePricingAdjustments } from '../types/quote.js'

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function parseYear(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2200) {
    return null
  }
  return parsed
}

function parseFactor(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return round4(Math.max(0.5, Math.min(3, parsed)))
}

function normalizeCpi(value: unknown): QuoteCpiAdjustment | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Partial<QuoteCpiAdjustment>
  const factor = parseFactor(candidate.factor)
  const enabled =
    typeof candidate.enabled === 'boolean'
      ? candidate.enabled
      : factor !== 1

  return {
    enabled,
    factor,
    sourceYear: parseYear(candidate.sourceYear),
    targetYear: parseYear(candidate.targetYear),
  }
}

export function normalizeQuotePricingAdjustments(value: unknown): QuotePricingAdjustments {
  return {
    cpi: normalizeCpi((value as QuotePricingAdjustments | undefined)?.cpi),
  }
}

export function applyCpiFactorToUnitPrice(
  unitPrice: number,
  cpi: QuoteCpiAdjustment | null,
): number {
  if (!cpi || !cpi.enabled) {
    return unitPrice
  }
  return round4(unitPrice * cpi.factor)
}
