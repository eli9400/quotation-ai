import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveExampleWeight,
  toExampleTimestamp,
} from './pricing-items-dataset-weighting.service.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function makeExample(input: Partial<TrainingDatasetExample>): TrainingDatasetExample {
  return {
    id: input.id ?? 'example-1',
    serviceProviderUid: input.serviceProviderUid ?? 'provider-1',
    source: input.source ?? 'uploaded_document',
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceQuoteDate: input.sourceQuoteDate ?? null,
    sourceQuoteId: input.sourceQuoteId ?? null,
    sourceTrainingJobId: input.sourceTrainingJobId ?? null,
    itemKey: input.itemKey ?? 'item|sqm',
    itemName: input.itemName ?? 'item',
    unit: input.unit ?? 'sqm',
    quantity: input.quantity ?? 1,
    lineTotal: input.lineTotal ?? 1,
    targetUnitPrice: input.targetUnitPrice ?? 1,
    featureProjectType: input.featureProjectType ?? null,
    featureScope: input.featureScope ?? null,
    featureUrgency: input.featureUrgency ?? null,
    featureRequirements: input.featureRequirements ?? null,
    featureInventorySurplus: input.featureInventorySurplus ?? null,
    featureAvailableWorkers: input.featureAvailableWorkers ?? null,
    featureDynamicValues: input.featureDynamicValues ?? {},
    featureDynamicVisibility: input.featureDynamicVisibility ?? {},
    split: input.split ?? 'train',
    createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
  }
}

test('toExampleTimestamp prefers createdAt and falls back to sourceQuoteDate', () => {
  const withSourceDate = makeExample({
    sourceQuoteDate: '2026-02-10',
    createdAt: '2025-01-01T00:00:00.000Z',
  })
  const fallbackToCreated = makeExample({
    sourceQuoteDate: '2026-03-01',
    createdAt: '2026-03-01T00:00:00.000Z',
  })
  const fallbackToSourceDate = makeExample({
    sourceQuoteDate: '2026-04-02',
    createdAt: '',
  })

  assert.equal(toExampleTimestamp(withSourceDate), Date.parse('2025-01-01T00:00:00.000Z'))
  assert.equal(toExampleTimestamp(fallbackToCreated), Date.parse('2026-03-01T00:00:00.000Z'))
  assert.equal(toExampleTimestamp(fallbackToSourceDate), Date.parse('2026-04-02'))
})

test('resolveExampleWeight boosts recent approved quotes above older uploaded rows', () => {
  const latestTimestamp = Date.parse('2026-04-15T00:00:00.000Z')
  const recentApproved = makeExample({
    source: 'approved_quote',
    sourceQuoteDate: '2026-04-10',
  })
  const oldUploaded = makeExample({
    source: 'uploaded_document',
    sourceQuoteDate: '2025-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
  })

  const approvedWeight = resolveExampleWeight(recentApproved, latestTimestamp)
  const uploadedWeight = resolveExampleWeight(oldUploaded, latestTimestamp)

  assert.ok(approvedWeight > uploadedWeight)
  assert.ok(approvedWeight >= 12)
  assert.equal(uploadedWeight, 1)
})
