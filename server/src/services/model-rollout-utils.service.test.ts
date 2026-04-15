import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateCanaryQualityGate,
  shouldServeCanary,
} from './model-rollout-utils.service.js'
import type { ModelV1MetricSummary } from '../types/model-v1.js'

function metrics(mae: number, smape: number): ModelV1MetricSummary[] {
  return [{ strategy: 'time', samples: 100, mae, mape: null, smape, medianAe: mae }]
}

test('quality gate passes when degradation is under threshold', () => {
  const result = evaluateCanaryQualityGate({
    stableMetrics: metrics(100, 0.2),
    candidateMetrics: metrics(108, 0.22),
    qualityGate: { maxMaeIncreasePct: 0.1, maxSmapeIncreasePct: 0.2 },
  })
  assert.equal(result.pass, true)
  assert.equal(result.reasons.length, 0)
})

test('quality gate fails when mae degradation exceeds threshold', () => {
  const result = evaluateCanaryQualityGate({
    stableMetrics: metrics(100, 0.2),
    candidateMetrics: metrics(120, 0.21),
    qualityGate: { maxMaeIncreasePct: 0.1, maxSmapeIncreasePct: 0.2 },
  })
  assert.equal(result.pass, false)
  assert.equal(result.reasons.some((reason) => reason.includes('MAE degraded')), true)
})

test('shouldServeCanary is deterministic for same key', () => {
  const first = shouldServeCanary({ routingKey: 'provider-1|quote-123', canaryTrafficPercent: 25 })
  const second = shouldServeCanary({ routingKey: 'provider-1|quote-123', canaryTrafficPercent: 25 })
  assert.equal(first, second)
})

test('shouldServeCanary respects 0 and 100 percent bounds', () => {
  assert.equal(shouldServeCanary({ routingKey: 'x', canaryTrafficPercent: 0 }), false)
  assert.equal(shouldServeCanary({ routingKey: 'x', canaryTrafficPercent: 100 }), true)
})
