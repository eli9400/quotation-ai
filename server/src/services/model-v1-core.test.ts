import assert from 'node:assert/strict'
import test from 'node:test'
import { predictModelV1, trainAndEvaluateModelV1 } from './model-v1-core.service.js'
import type { ModelFeatureRow } from '../types/model-feature-schema.js'

function row(itemKey: string, quantity: number, unit = 'unit'): ModelFeatureRow {
  return {
    itemKey,
    unit,
    quantity,
    projectType: 'unknown',
    scope: 'unknown',
    urgency: 'unknown',
    requirementsState: 'none',
    inventorySurplus: 0,
    availableWorkers: 0,
    hasInventorySurplus: 0,
    hasAvailableWorkers: 0,
  }
}

test('trainAndEvaluateModelV1 returns payload and metrics', () => {
  const rows = [
    row('a|unit', 1),
    row('a|unit', 2),
    row('a|unit', 3),
    row('b|unit', 1),
    row('b|unit', 2),
    row('b|unit', 3),
    row('c|hour', 1, 'hour'),
    row('c|hour', 2, 'hour'),
    row('c|hour', 3, 'hour'),
  ]
  const targets = [100, 120, 130, 80, 85, 90, 200, 220, 230]
  const trained = trainAndEvaluateModelV1(rows, targets, { testRatio: 0.3, seed: 'test' })
  assert.equal(trained.metrics.length, 2)
  assert.ok(trained.payload.directByItemUnit.length >= 2)
  const prediction = predictModelV1(trained.payload, { itemKey: 'a|unit', unit: 'unit', quantity: 2 })
  assert.ok(prediction.unitPrice > 0)
})

test('predictModelV1 falls back to unit then global', () => {
  const rows = [row('x|hour', 1, 'hour'), row('x|hour', 2, 'hour'), row('x|hour', 3, 'hour')]
  const targets = [100, 120, 140]
  const trained = trainAndEvaluateModelV1(rows, targets, { minItemSamples: 10, minUnitSamples: 2 })
  const byUnit = predictModelV1(trained.payload, { itemKey: 'missing|hour', unit: 'hour', quantity: 2 })
  assert.equal(byUnit.source, 'unit_fallback')
  const global = predictModelV1(trained.payload, { itemKey: 'missing|unit', unit: 'unit', quantity: 2 })
  assert.equal(global.source, 'global_fallback')
})
