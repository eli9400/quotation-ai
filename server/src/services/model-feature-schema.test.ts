import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildModelFeatureRowFromDatasetExample,
  buildModelFeatureRowFromInferenceInput,
  getModelFeatureSchema,
  serializeModelFeatureRow,
  validateModelFeatureRow,
} from './model-feature-schema.service.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function datasetExample(): TrainingDatasetExample {
  return {
    id: 'ex-1',
    serviceProviderUid: 'uid',
    source: 'uploaded_document',
    sourceDocumentId: 'doc-1',
    sourceQuoteDate: '2026-01-01',
    sourceQuoteId: null,
    sourceTrainingJobId: 'job-1',
    itemKey: 'window install|unit',
    itemName: 'window install',
    unit: 'unit',
    quantity: 2,
    lineTotal: 2000,
    targetUnitPrice: 1000,
    featureProjectType: null,
    featureScope: null,
    featureUrgency: null,
    featureRequirements: '',
    featureInventorySurplus: null,
    featureAvailableWorkers: null,
    featureDynamicValues: {},
    featureDynamicVisibility: {},
    split: 'train',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

test('dataset feature row follows stable schema and serializes in fixed order', () => {
  const row = buildModelFeatureRowFromDatasetExample(datasetExample())
  assert.deepEqual(validateModelFeatureRow(row), [])
  const serialized = serializeModelFeatureRow(row)
  assert.equal(serialized.length, getModelFeatureSchema().fields.length)
  assert.equal(serialized[0], 'window install|unit')
  assert.equal(serialized[2], 2)
})

test('inference mapper canonicalizes item key and validates quantity', () => {
  const row = buildModelFeatureRowFromInferenceInput({
    itemName: 'התקנת חלון/בלגי',
    unit: 'unit',
    quantity: 1,
    industry: 'window_installer',
    requirements: 'עבודה דחופה',
  })
  assert.ok(row.itemKey.includes('|unit'))
  assert.equal(row.requirementsState, 'present')

  const invalid = { ...row, quantity: 0 }
  assert.deepEqual(validateModelFeatureRow(invalid), ['quantity'])
})
