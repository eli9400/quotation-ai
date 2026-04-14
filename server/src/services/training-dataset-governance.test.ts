import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDatasetFingerprint,
  buildDatasetVersionId,
  createTrainingDatasetSnapshot,
} from './training-dataset-governance.service.js'
import type { RebuildTrainingDatasetResult, TrainingDatasetExample } from '../types/training-dataset.js'
import type { TrainingDatasetSnapshot } from '../types/training.js'

function buildExample(
  input: Partial<TrainingDatasetExample> & Pick<TrainingDatasetExample, 'id' | 'itemKey' | 'itemName' | 'unit'>,
): TrainingDatasetExample {
  return {
    id: input.id,
    serviceProviderUid: 'provider-1',
    source: 'uploaded_document',
    sourceDocumentId: input.sourceDocumentId ?? 'doc-1',
    sourceQuoteDate: null,
    sourceQuoteId: null,
    sourceTrainingJobId: 'job-current',
    itemKey: input.itemKey,
    itemName: input.itemName,
    unit: input.unit,
    quantity: input.quantity ?? 1,
    lineTotal: input.lineTotal ?? 100,
    targetUnitPrice: input.targetUnitPrice ?? 100,
    featureProjectType: null,
    featureScope: null,
    featureUrgency: null,
    featureRequirements: null,
    featureInventorySurplus: null,
    featureAvailableWorkers: null,
    featureDynamicValues: {},
    featureDynamicVisibility: {},
    split: input.split ?? 'train',
    createdAt: '2026-04-14T00:00:00.000Z',
    updatedAt: '2026-04-14T00:00:00.000Z',
  }
}

function buildResult(overrides: Partial<RebuildTrainingDatasetResult> = {}): RebuildTrainingDatasetResult {
  return {
    totalExamples: 10,
    splitCounts: { train: 8, validation: 1, test: 1 },
    uniqueItems: 3,
    sourceCounts: { uploaded_document: 10, approved_quote: 0 },
    unitDistribution: { unit: 5, sqm: 5 },
    datasetFingerprint: 'abc123abc123abc123abc123abc123abc123abcd',
    datasetVersionId: 'ds_abc123abc123abc1',
    generatedAt: '2026-04-14T00:00:00.000Z',
    ...overrides,
  }
}

test('dataset fingerprint is deterministic regardless of order', () => {
  const one = buildExample({ id: '1', itemKey: 'a|unit', itemName: 'a', unit: 'unit' })
  const two = buildExample({ id: '2', itemKey: 'b|sqm', itemName: 'b', unit: 'sqm' })
  const fingerprintA = buildDatasetFingerprint([one, two])
  const fingerprintB = buildDatasetFingerprint([two, one])
  assert.equal(fingerprintA, fingerprintB)
  assert.equal(buildDatasetVersionId(fingerprintA).startsWith('ds_'), true)
})

test('dataset snapshot computes medium/high drift from previous run', () => {
  const previousSnapshot: TrainingDatasetSnapshot = {
    datasetVersionId: 'ds_prev',
    datasetFingerprint: 'prevfingerprint',
    metrics: {
      totalExamples: 100,
      splitCounts: { train: 80, validation: 10, test: 10 },
      uniqueItems: 20,
      sourceCounts: { uploaded_document: 100, approved_quote: 0 },
      unitDistribution: { unit: 50, sqm: 50 },
      generatedAt: '2026-04-13T00:00:00.000Z',
    },
    driftFromPreviousRun: {
      baselineAvailable: false,
      comparedToJobId: null,
      comparedToDatasetVersionId: null,
      changed: false,
      severity: 'none',
      totalExamplesDelta: 0,
      totalExamplesDeltaPct: null,
      uniqueItemsDelta: 0,
      uniqueItemsDeltaPct: null,
      maxUnitShareDeltaPctPoints: 0,
      unitShareDeltaPctPoints: {},
    },
  }
  const current = buildResult({
    totalExamples: 140,
    uniqueItems: 24,
    unitDistribution: { unit: 98, sqm: 42 },
  })
  const snapshot = createTrainingDatasetSnapshot({
    result: current,
    previousSnapshot,
    previousJobId: 'job-prev',
  })
  assert.equal(snapshot.driftFromPreviousRun.baselineAvailable, true)
  assert.equal(snapshot.driftFromPreviousRun.comparedToJobId, 'job-prev')
  assert.equal(snapshot.driftFromPreviousRun.changed, true)
  assert.equal(['medium', 'high'].includes(snapshot.driftFromPreviousRun.severity), true)
})
