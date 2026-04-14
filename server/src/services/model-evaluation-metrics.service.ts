import type { EvaluationMetricSummary } from '../types/model-evaluation.js'

type RegressionPoint = {
  actual: number
  predicted: number
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((acc, value) => acc + value, 0) / values.length
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

export function buildEvaluationMetricSummary(points: RegressionPoint[]): EvaluationMetricSummary {
  if (points.length === 0) {
    return { samples: 0, mae: 0, mape: null, smape: null, medianAe: 0 }
  }

  const absErrors = points.map((point) => Math.abs(point.actual - point.predicted))
  const mapeTerms = points
    .filter((point) => Math.abs(point.actual) > 0)
    .map((point) => (Math.abs(point.actual - point.predicted) / Math.abs(point.actual)) * 100)
  const smapeTerms = points
    .map((point) => {
      const denominator = Math.abs(point.actual) + Math.abs(point.predicted)
      if (denominator === 0) return null
      return (200 * Math.abs(point.actual - point.predicted)) / denominator
    })
    .filter((value): value is number => value !== null)

  return {
    samples: points.length,
    mae: round(mean(absErrors)),
    mape: mapeTerms.length > 0 ? round(mean(mapeTerms)) : null,
    smape: smapeTerms.length > 0 ? round(mean(smapeTerms)) : null,
    medianAe: round(median(absErrors)),
  }
}
