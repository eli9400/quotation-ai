import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRandomEvaluationSplit, buildTimeEvaluationSplit } from './model-evaluation-split.service.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function example(id: string, date: string): TrainingDatasetExample {
  return {
    id,
    serviceProviderUid: 'uid',
    source: 'uploaded_document',
    sourceDocumentId: id,
    sourceQuoteDate: date,
    sourceQuoteId: null,
    sourceTrainingJobId: 'job',
    itemKey: `item-${id}|unit`,
    itemName: `item-${id}`,
    unit: 'unit',
    quantity: 1,
    lineTotal: 100,
    targetUnitPrice: 100,
    featureProjectType: null,
    featureScope: null,
    featureUrgency: null,
    featureRequirements: null,
    featureInventorySurplus: null,
    featureAvailableWorkers: null,
    featureDynamicValues: {},
    featureDynamicVisibility: {},
    split: 'train',
    createdAt: date,
    updatedAt: date,
  }
}

test('buildRandomEvaluationSplit is deterministic by seed', () => {
  const examples = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) =>
    example(id, `2026-01-0${index + 1}T00:00:00.000Z`),
  )
  const first = buildRandomEvaluationSplit(examples, 0.3, 'seed-1')
  const second = buildRandomEvaluationSplit(examples, 0.3, 'seed-1')
  assert.deepEqual(
    first.test.map((row) => row.id),
    second.test.map((row) => row.id),
  )
  assert.ok(first.train.length > 0)
  assert.ok(first.test.length > 0)
})

test('buildTimeEvaluationSplit keeps most recent rows in test', () => {
  const examples = ['a', 'b', 'c', 'd', 'e'].map((id, index) =>
    example(id, `2026-02-0${index + 1}T00:00:00.000Z`),
  )
  const split = buildTimeEvaluationSplit(examples, 0.4)
  assert.deepEqual(
    split.test.map((row) => row.id),
    ['d', 'e'],
  )
  assert.deepEqual(
    split.train.map((row) => row.id),
    ['a', 'b', 'c'],
  )
})
