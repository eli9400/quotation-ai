import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEvaluationMetricSummary } from './model-evaluation-metrics.service.js'

test('buildEvaluationMetricSummary computes MAE/MAPE/SMAPE/MedianAE', () => {
  const summary = buildEvaluationMetricSummary([
    { actual: 100, predicted: 110 },
    { actual: 200, predicted: 180 },
    { actual: 300, predicted: 315 },
  ])

  assert.equal(summary.samples, 3)
  assert.equal(summary.mae, 15)
  assert.equal(summary.mape, 8.3333)
  assert.equal(summary.smape, 8.3094)
  assert.equal(summary.medianAe, 15)
})

test('buildEvaluationMetricSummary handles empty points', () => {
  const summary = buildEvaluationMetricSummary([])
  assert.deepEqual(summary, {
    samples: 0,
    mae: 0,
    mape: null,
    smape: null,
    medianAe: 0,
  })
})
