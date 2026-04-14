import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSplitWithMedianBaseline } from './model-evaluation.service.js'
import type { EvaluationSplit } from '../types/model-evaluation.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function row(input: {
  id: string
  itemKey: string
  unit: 'unit' | 'hour'
  targetUnitPrice: number
}): TrainingDatasetExample {
  return {
    id: input.id,
    serviceProviderUid: 'uid',
    source: 'uploaded_document',
    sourceDocumentId: input.id,
    sourceQuoteDate: '2026-03-01T00:00:00.000Z',
    sourceQuoteId: null,
    sourceTrainingJobId: 'job',
    itemKey: input.itemKey,
    itemName: input.itemKey,
    unit: input.unit,
    quantity: 1,
    lineTotal: input.targetUnitPrice,
    targetUnitPrice: input.targetUnitPrice,
    featureProjectType: null,
    featureScope: null,
    featureUrgency: null,
    featureRequirements: null,
    featureInventorySurplus: null,
    featureAvailableWorkers: null,
    featureDynamicValues: {},
    featureDynamicVisibility: {},
    split: 'train',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }
}

test('evaluateSplitWithMedianBaseline tracks direct and fallback coverage', () => {
  const split: EvaluationSplit = {
    strategy: 'random',
    train: [
      row({ id: '1', itemKey: 'a|unit', unit: 'unit', targetUnitPrice: 100 }),
      row({ id: '2', itemKey: 'a|unit', unit: 'unit', targetUnitPrice: 120 }),
      row({ id: '3', itemKey: 'b|unit', unit: 'unit', targetUnitPrice: 80 }),
      row({ id: '4', itemKey: 'h|hour', unit: 'hour', targetUnitPrice: 200 }),
    ],
    test: [
      row({ id: '5', itemKey: 'a|unit', unit: 'unit', targetUnitPrice: 110 }),
      row({ id: '6', itemKey: 'c|unit', unit: 'unit', targetUnitPrice: 90 }),
      row({ id: '7', itemKey: 'z|hour', unit: 'hour', targetUnitPrice: 210 }),
    ],
  }

  const summary = evaluateSplitWithMedianBaseline(split)
  assert.equal(summary.testCount, 3)
  assert.equal(summary.coverage.directItemUnit, 1)
  assert.equal(summary.coverage.unitFallback, 2)
  assert.equal(summary.coverage.globalFallback, 0)
  assert.ok(summary.metrics.mae >= 0)
})
