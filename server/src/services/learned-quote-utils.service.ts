import type { PricingUnit } from '../types/model-profile.js'
import type { QuoteLineItem, QuoteRequestedItem } from '../types/quote.js'

type CoverageLine = {
  coverageTier: 'high' | 'medium' | 'low'
  needsManualReview: boolean
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function workloadWeight(unit: PricingUnit | 'custom'): number {
  switch (unit) {
    case 'sqm':
      return 0.045
    case 'point':
      return 0.2
    case 'day':
      return 1
    case 'container':
      return 0.4
    case 'package':
      return 0.6
    case 'meter':
      return 0.04
    case 'unit':
      return 0.28
    case 'hour':
      return 0.12
    case 'fixed':
      return 0.5
    default:
      return 0.18
  }
}

export function normalizeRequestedUnit(unit: QuoteRequestedItem['unit']): PricingUnit | 'custom' {
  if (!unit) return 'custom'
  const normalized = String(unit).trim().toLowerCase()
  if (normalized === 'sqm' || normalized === 'm2' || normalized === 'מ"ר') return 'sqm'
  if (normalized === 'unit' || normalized === 'יחידה' || normalized === 'יחידות') return 'unit'
  if (normalized === 'point' || normalized === 'נקודה' || normalized === 'נקודות') return 'point'
  if (normalized === 'day' || normalized === 'יום' || normalized === 'ימים') return 'day'
  if (normalized === 'container' || normalized === 'מכולה' || normalized === 'מכולות') return 'container'
  if (normalized === 'package' || normalized === 'קומפלט') return 'package'
  if (normalized === 'hour' || normalized === 'שעה' || normalized === 'שעות') return 'hour'
  if (normalized === 'meter' || normalized === 'מטר' || normalized === 'מטרים') return 'meter'
  return 'custom'
}

export function estimateDays(lineItems: QuoteLineItem[]): number {
  const workUnits = lineItems.reduce((sum, line) => sum + line.quantity * workloadWeight(line.unit), 0)
  return Math.max(1, Math.ceil(workUnits / 8))
}

export function estimateConfidence(lines: CoverageLine[]): number {
  if (lines.length === 0) return 55
  const score = lines.reduce((sum, line) => {
    if (line.needsManualReview) return sum + 0.42
    if (line.coverageTier === 'high') return sum + 1
    if (line.coverageTier === 'medium') return sum + 0.76
    return sum + 0.56
  }, 0)
  return Math.round(clamp(50 + (score / lines.length) * 46, 40, 98))
}

export function calibrationDeltaForLine(line: CoverageLine): number {
  if (line.needsManualReview) return 0.05
  if (line.coverageTier === 'high') return 0.15
  if (line.coverageTier === 'medium') return 0.1
  return 0.05
}

export function applyBoundedReasoningAdjustment(
  baseUnitPrice: number,
  requestedAdjustmentPct: number,
  maxDelta: number,
): number {
  const safePct = clamp(requestedAdjustmentPct, -maxDelta, maxDelta)
  const adjusted = baseUnitPrice * (1 + safePct)
  return round2(Math.max(0, adjusted))
}
