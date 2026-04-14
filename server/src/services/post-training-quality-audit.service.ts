import { isNoisePricingItemName, pricingCanonicalKey } from './pricing-items-normalization-utils.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'
import type { TrainingJob } from '../types/training.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'
const SAMPLE_LIMIT = 12
const WEAK_SIGNATURE_TOKENS = new Set([
  'service',
  'work',
  'item',
  'install',
  'installation',
  'transport',
  'callout',
  'retem',
  '\u05E9\u05D9\u05E8\u05D5\u05EA',
  '\u05E2\u05D1\u05D5\u05D3\u05D4',
  '\u05E4\u05E8\u05D9\u05D8',
  '\u05D4\u05EA\u05E7\u05E0\u05D4',
  '\u05D4\u05EA\u05E7\u05E0\u05EA',
  '\u05DB\u05D5\u05DC\u05DC',
  '\u05E2\u05D5\u05D3\u05D9',
  '\u05D0\u05DC',
])
const SUSPICIOUS_TOKENS = new Set([
  'callout',
  'servicecall',
  'service_call',
  'retem',
  'transport',
  '\u05E2\u05D5\u05D3\u05D9',
  '\u05E8\u05D5\u05E7\u05D9\u05D1',
  '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
])
type AuditStatus = 'pass' | 'warn' | 'fail'
type RangeExpectation = { min?: number; max?: number }
export type TrainingQualityExpectations = {
  uniqueItemKeys?: RangeExpectation
  datasetRows?: RangeExpectation
  pricingItems?: RangeExpectation
}
export type TrainingQualityCheck = {
  id: string
  status: AuditStatus
  message: string
}

export type TrainingQualityAuditReport = {
  ok: boolean
  serviceProviderUid: string
  jobId: string | null
  generatedAt: string
  checks: TrainingQualityCheck[]
  metrics: {
    pricingItems: number
    pricingItemsUnitDistribution: Record<string, number>
    datasetRows: number
    datasetRowsForJob: number
    datasetUnitDistribution: Record<string, number>
    uniqueItemKeys: number
    jobDocuments: number
    coveredJobDocuments: number
    datasetVersionId: string | null
    datasetFingerprint: string | null
  }
  samples: {
    suspiciousPricingItems: string[]
    suspiciousDatasetItems: string[]
    nearDuplicatePairs: string[]
    missingJobDocumentIds: string[]
  }
}
type AuditInput = {
  serviceProviderUid: string
  pricingItems: LearnedPricingItem[]
  datasetExamples: TrainingDatasetExample[]
  job: TrainingJob | null
  expectations?: TrainingQualityExpectations
}
const nowIso = (): string => new Date().toISOString()
const buildDistribution = (values: string[]): Record<string, number> =>
  values.reduce<Record<string, number>>((acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }), {})

function buildSignature(value: string): string {
  const tokens = pricingCanonicalKey(value).split(' ').filter(Boolean)
  const reduced = tokens.filter((token) => !WEAK_SIGNATURE_TOKENS.has(token))
  const source = reduced.length > 0 ? reduced : tokens
  return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b)).join(' ')
}
function isSuspiciousName(value: string): boolean {
  const normalized = pricingCanonicalKey(value)
  if (!normalized) return true
  if (isNoisePricingItemName(value)) return true
  return normalized.split(' ').some((token) => SUSPICIOUS_TOKENS.has(token))
}
function buildNearDuplicatePairs(items: LearnedPricingItem[]): string[] {
  const pairs = new Set<string>()
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].unit !== items[j].unit) continue
      const left = pricingCanonicalKey(items[i].canonicalName)
      const right = pricingCanonicalKey(items[j].canonicalName)
      if (!left || !right || left === right) continue
      const sameSignature = buildSignature(left) === buildSignature(right)
      const containment = left.includes(right) || right.includes(left)
      if (!sameSignature && !containment) continue
      pairs.add(`${items[i].canonicalName} | ${items[j].canonicalName} | ${items[i].unit}`)
    }
  }
  return Array.from(pairs).slice(0, SAMPLE_LIMIT)
}
function exactDuplicateCount(items: LearnedPricingItem[]): number {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  items.forEach((item) => {
    const key = `${pricingCanonicalKey(item.canonicalName)}|${item.unit}`
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  })
  return duplicates.size
}
function addRangeCheck(checks: TrainingQualityCheck[], id: string, label: string, value: number, range?: RangeExpectation): void {
  if (!range) return
  const tooLow = range.min !== undefined && value < range.min
  const tooHigh = range.max !== undefined && value > range.max
  const expected = `${range.min ?? '-'}..${range.max ?? '-'}`
  checks.push({ id, status: tooLow || tooHigh ? 'fail' : 'pass', message: `${label}: ${value} (expected ${expected})` })
}
export function buildPostTrainingQualityAudit(input: AuditInput): TrainingQualityAuditReport {
  const datasetRowsForJob = input.job
    ? input.datasetExamples.filter((example) => example.sourceTrainingJobId === input.job?.id)
    : []
  const coveredJobDocuments = new Set(
    datasetRowsForJob.map((example) => example.sourceDocumentId).filter((id): id is string => Boolean(id)),
  )
  const missingJobDocumentIds = input.job
    ? input.job.documentIds.filter((id) => !coveredJobDocuments.has(id)).slice(0, SAMPLE_LIMIT)
    : []
  const suspiciousPricingItems = input.pricingItems
    .filter((item) => isSuspiciousName(item.canonicalName))
    .map((item) => item.canonicalName)
    .slice(0, SAMPLE_LIMIT)
  const suspiciousDatasetItems = input.datasetExamples
    .filter((example) => isSuspiciousName(example.itemName))
    .map((example) => example.itemName)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, SAMPLE_LIMIT)
  const nearDuplicatePairs = buildNearDuplicatePairs(input.pricingItems)
  const datasetVersionId = input.job?.datasetSnapshot?.datasetVersionId ?? null
  const datasetFingerprint = input.job?.datasetSnapshot?.datasetFingerprint ?? null
  const checks: TrainingQualityCheck[] = [
    { id: 'job-status', status: !input.job || input.job.status === 'completed' ? 'pass' : 'fail', message: input.job ? `Training job status: ${input.job.status}` : 'No training job provided; provider-level audit only.' },
    { id: 'pricing-unknown-unit', status: input.pricingItems.some((item) => item.unit === 'unknown') ? 'fail' : 'pass', message: `Pricing items with unknown unit: ${input.pricingItems.filter((item) => item.unit === 'unknown').length}` },
    { id: 'dataset-unknown-unit', status: input.datasetExamples.some((example) => example.unit === 'unknown') ? 'fail' : 'pass', message: `Dataset rows with unknown unit: ${input.datasetExamples.filter((example) => example.unit === 'unknown').length}` },
    { id: 'pricing-exact-duplicates', status: exactDuplicateCount(input.pricingItems) > 0 ? 'fail' : 'pass', message: `Exact pricing-item duplicates: ${exactDuplicateCount(input.pricingItems)}` },
    { id: 'pricing-suspicious-names', status: suspiciousPricingItems.length > 0 ? 'fail' : 'pass', message: `Suspicious pricing-item names: ${suspiciousPricingItems.length}` },
    { id: 'dataset-suspicious-names', status: suspiciousDatasetItems.length > 0 ? 'fail' : 'pass', message: `Suspicious dataset item names: ${suspiciousDatasetItems.length}` },
    { id: 'pricing-near-duplicates', status: nearDuplicatePairs.length > 0 ? 'warn' : 'pass', message: `Possible near-duplicate pricing items: ${nearDuplicatePairs.length}` },
    { id: 'job-document-coverage', status: input.job && coveredJobDocuments.size === 0 ? 'fail' : missingJobDocumentIds.length > 0 ? 'warn' : 'pass', message: `Covered job documents: ${coveredJobDocuments.size}/${input.job?.documentIds.length ?? 0}` },
    { id: 'job-dataset-snapshot', status: input.job ? (datasetVersionId && datasetFingerprint ? 'pass' : 'warn') : 'pass', message: input.job ? `Dataset snapshot attached: ${Boolean(datasetVersionId && datasetFingerprint)}` : 'No training job provided; dataset snapshot check skipped.' },
  ]

  addRangeCheck(checks, 'range-pricing-items', 'Pricing items', input.pricingItems.length, input.expectations?.pricingItems)
  addRangeCheck(checks, 'range-dataset-rows', 'Dataset rows', input.datasetExamples.length, input.expectations?.datasetRows)
  addRangeCheck(checks, 'range-unique-item-keys', 'Unique item keys', new Set(input.datasetExamples.map((example) => example.itemKey)).size, input.expectations?.uniqueItemKeys)
  return {
    ok: checks.every((check) => check.status !== 'fail'),
    serviceProviderUid: input.serviceProviderUid,
    jobId: input.job?.id ?? null,
    generatedAt: nowIso(),
    checks,
    metrics: {
      pricingItems: input.pricingItems.length,
      pricingItemsUnitDistribution: buildDistribution(input.pricingItems.map((item) => item.unit)),
      datasetRows: input.datasetExamples.length,
      datasetRowsForJob: datasetRowsForJob.length,
      datasetUnitDistribution: buildDistribution(input.datasetExamples.map((example) => example.unit)),
      uniqueItemKeys: new Set(input.datasetExamples.map((example) => example.itemKey)).size,
      jobDocuments: input.job?.documentIds.length ?? 0,
      coveredJobDocuments: coveredJobDocuments.size,
      datasetVersionId,
      datasetFingerprint,
    },
    samples: {
      suspiciousPricingItems,
      suspiciousDatasetItems,
      nearDuplicatePairs,
      missingJobDocumentIds,
    },
  }
}
