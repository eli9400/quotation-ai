import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPostTrainingQualityAudit } from './post-training-quality-audit.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'
import type { TrainingJob } from '../types/training.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function buildPricingItem(input: Partial<LearnedPricingItem> & Pick<LearnedPricingItem, 'canonicalName' | 'unit'>): LearnedPricingItem {
  return {
    id: input.id ?? `${input.canonicalName}|${input.unit}`,
    serviceProviderUid: 'provider-1',
    canonicalName: input.canonicalName,
    aliases: input.aliases ?? [input.canonicalName],
    unit: input.unit,
    pricePerUnit: input.pricePerUnit ?? { min: 10, avg: 10, max: 10, sampleCount: 1 },
    quantity: input.quantity ?? { min: 1, avg: 1, max: 1, sampleCount: 1 },
    lineTotal: input.lineTotal ?? { min: 10, avg: 10, max: 10, sampleCount: 1 },
    quantityPriceSamples: input.quantityPriceSamples ?? [{ quantity: 1, unitPrice: 10 }],
    sampleLines: input.sampleLines ?? 1,
    lastUpdatedAt: input.lastUpdatedAt ?? '2026-04-14T00:00:00.000Z',
  }
}

function buildDatasetExample(input: Partial<TrainingDatasetExample> & Pick<TrainingDatasetExample, 'itemKey' | 'itemName' | 'unit'>): TrainingDatasetExample {
  return {
    id: input.id ?? input.itemKey,
    serviceProviderUid: 'provider-1',
    source: input.source ?? 'uploaded_document',
    sourceDocumentId: input.sourceDocumentId ?? 'doc-1',
    sourceQuoteDate: null,
    sourceQuoteId: null,
    sourceTrainingJobId: input.sourceTrainingJobId ?? 'job-1',
    itemKey: input.itemKey,
    itemName: input.itemName,
    unit: input.unit,
    quantity: input.quantity ?? 1,
    lineTotal: input.lineTotal ?? 10,
    targetUnitPrice: input.targetUnitPrice ?? 10,
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

function buildJob(input: Partial<TrainingJob> = {}): TrainingJob {
  return {
    id: input.id ?? 'job-1',
    serviceProviderUid: 'provider-1',
    status: input.status ?? 'completed',
    progress: input.progress ?? 100,
    currentStage: input.currentStage ?? 'finalize',
    stageProgress: input.stageProgress ?? {
      prepare: 100,
      load_documents: 100,
      extract_text: 100,
      parse_pricing_lines: 100,
      build_dataset: 100,
      learn_items: 100,
      normalize_schema: 100,
      finalize: 100,
    },
    documentIds: input.documentIds ?? ['doc-1'],
    startedAt: input.startedAt ?? '2026-04-14T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-04-14T00:00:00.000Z',
    completedAt: input.completedAt ?? '2026-04-14T00:10:00.000Z',
    errorMessage: input.errorMessage ?? null,
    datasetSnapshot: input.datasetSnapshot ?? null,
  }
}

test('post-training audit passes for clean dataset', () => {
  const report = buildPostTrainingQualityAudit({
    serviceProviderUid: 'provider-1',
    pricingItems: [buildPricingItem({ canonicalName: 'החלפת ברז', unit: 'unit' })],
    datasetExamples: [buildDatasetExample({ itemKey: 'החלפת ברז|unit', itemName: 'החלפת ברז', unit: 'unit' })],
    job: buildJob(),
  })

  assert.equal(report.ok, true)
  assert.equal(report.checks.every((check) => check.status !== 'fail'), true)
})

test('post-training audit fails on suspicious names and exact duplicates', () => {
  const report = buildPostTrainingQualityAudit({
    serviceProviderUid: 'provider-1',
    pricingItems: [
      buildPricingItem({ id: 'a', canonicalName: 'שירות callout', unit: 'point' }),
      buildPricingItem({ id: 'b', canonicalName: 'שירות callout', unit: 'point' }),
    ],
    datasetExamples: [
      buildDatasetExample({ itemKey: 'service call|point', itemName: 'שירות callout', unit: 'point' }),
    ],
    job: buildJob(),
  })

  assert.equal(report.ok, false)
  assert.equal(report.samples.suspiciousPricingItems.length > 0, true)
  assert.equal(report.samples.suspiciousDatasetItems.length > 0, true)
  assert.equal(report.checks.some((check) => check.id === 'pricing-exact-duplicates' && check.status === 'fail'), true)
})

test('post-training audit warns when job document coverage is partial', () => {
  const report = buildPostTrainingQualityAudit({
    serviceProviderUid: 'provider-1',
    pricingItems: [buildPricingItem({ canonicalName: 'החלפת ברז', unit: 'unit' })],
    datasetExamples: [buildDatasetExample({ itemKey: 'החלפת ברז|unit', itemName: 'החלפת ברז', unit: 'unit', sourceDocumentId: 'doc-1' })],
    job: buildJob({ documentIds: ['doc-1', 'doc-2'] }),
  })

  assert.equal(report.ok, true)
  assert.equal(report.samples.missingJobDocumentIds.includes('doc-2'), true)
  assert.equal(report.checks.some((check) => check.id === 'job-document-coverage' && check.status === 'warn'), true)
})

test('post-training audit enforces optional ranges', () => {
  const report = buildPostTrainingQualityAudit({
    serviceProviderUid: 'provider-1',
    pricingItems: [buildPricingItem({ canonicalName: 'החלפת ברז', unit: 'unit' })],
    datasetExamples: [buildDatasetExample({ itemKey: 'החלפת ברז|unit', itemName: 'החלפת ברז', unit: 'unit' })],
    job: buildJob(),
    expectations: {
      pricingItems: { min: 2 },
      datasetRows: { min: 2 },
      uniqueItemKeys: { min: 2 },
    },
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.some((check) => check.id === 'range-pricing-items' && check.status === 'fail'), true)
  assert.equal(report.checks.some((check) => check.id === 'range-dataset-rows' && check.status === 'fail'), true)
  assert.equal(report.checks.some((check) => check.id === 'range-unique-item-keys' && check.status === 'fail'), true)
})
