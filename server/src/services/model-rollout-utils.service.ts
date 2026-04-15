import { createHash } from 'node:crypto'
import type { ModelV1MetricSummary } from '../types/model-v1.js'
import type {
  ModelV1CanaryQualityGate,
  ModelV1CanaryQualityGateResult,
} from '../types/model-rollout.js'

function toPercentIncrease(base: number, candidate: number): number | null {
  if (!Number.isFinite(base) || !Number.isFinite(candidate) || base <= 0) return null
  return (candidate - base) / base
}

function pickMetricByStrategy(
  metrics: ModelV1MetricSummary[],
  preferred: ModelV1MetricSummary['strategy'],
): ModelV1MetricSummary | null {
  const exact = metrics.find((metric) => metric.strategy === preferred)
  if (exact) return exact
  return metrics[0] ?? null
}

export function evaluateCanaryQualityGate(input: {
  stableMetrics: ModelV1MetricSummary[]
  candidateMetrics: ModelV1MetricSummary[]
  qualityGate: ModelV1CanaryQualityGate
}): ModelV1CanaryQualityGateResult {
  const stable = pickMetricByStrategy(input.stableMetrics, 'time')
  const candidate = pickMetricByStrategy(input.candidateMetrics, 'time')
  if (!stable || !candidate) {
    return {
      pass: false,
      maeIncreasePct: null,
      smapeIncreasePct: null,
      reasons: ['Missing evaluation metrics for quality gate comparison.'],
    }
  }

  const maeIncreasePct = toPercentIncrease(stable.mae, candidate.mae)
  const smapeIncreasePct = toPercentIncrease(stable.smape ?? 0, candidate.smape ?? 0)
  const reasons: string[] = []

  if (
    maeIncreasePct !== null &&
    maeIncreasePct > input.qualityGate.maxMaeIncreasePct
  ) {
    reasons.push(
      `MAE degraded by ${(maeIncreasePct * 100).toFixed(2)}% (limit ${(input.qualityGate.maxMaeIncreasePct * 100).toFixed(2)}%).`,
    )
  }
  if (
    smapeIncreasePct !== null &&
    smapeIncreasePct > input.qualityGate.maxSmapeIncreasePct
  ) {
    reasons.push(
      `SMAPE degraded by ${(smapeIncreasePct * 100).toFixed(2)}% (limit ${(input.qualityGate.maxSmapeIncreasePct * 100).toFixed(2)}%).`,
    )
  }

  return {
    pass: reasons.length === 0,
    maeIncreasePct,
    smapeIncreasePct,
    reasons,
  }
}

export function shouldServeCanary(input: {
  routingKey: string
  canaryTrafficPercent: number
}): boolean {
  const traffic = Math.max(0, Math.min(100, Math.round(input.canaryTrafficPercent)))
  if (traffic <= 0) return false
  if (traffic >= 100) return true
  const digest = createHash('sha1').update(input.routingKey).digest('hex').slice(0, 8)
  const bucket = Number.parseInt(digest, 16) % 100
  return bucket < traffic
}
