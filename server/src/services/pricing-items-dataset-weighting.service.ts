import type { TrainingDatasetExample } from '../types/training-dataset.js'

const APPROVED_QUOTE_BASE_WEIGHT = 12
const UPLOADED_DOCUMENT_BASE_WEIGHT = 1
const MAX_WEIGHT_PER_EXAMPLE = 24

export function toExampleTimestamp(example: TrainingDatasetExample): number {
  const createdAt = typeof example.createdAt === 'string' ? Date.parse(example.createdAt) : Number.NaN
  if (Number.isFinite(createdAt)) return createdAt
  const sourceDate = typeof example.sourceQuoteDate === 'string' ? Date.parse(example.sourceQuoteDate) : Number.NaN
  if (Number.isFinite(sourceDate)) return sourceDate
  return 0
}

function resolveRecencyMultiplier(exampleTimestamp: number, latestTimestamp: number): number {
  if (!Number.isFinite(exampleTimestamp) || exampleTimestamp <= 0) return 1
  if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return 1
  const gapMs = Math.max(0, latestTimestamp - exampleTimestamp)
  const gapDays = gapMs / (1000 * 60 * 60 * 24)
  if (gapDays <= 90) return 4
  if (gapDays <= 180) return 3
  if (gapDays <= 365) return 2
  return 1
}

export function resolveExampleWeight(
  example: TrainingDatasetExample,
  latestTimestamp: number,
): number {
  const baseWeight =
    example.source === 'approved_quote'
      ? APPROVED_QUOTE_BASE_WEIGHT
      : UPLOADED_DOCUMENT_BASE_WEIGHT
  const recencyMultiplier = resolveRecencyMultiplier(
    toExampleTimestamp(example),
    latestTimestamp,
  )
  return Math.max(1, Math.min(MAX_WEIGHT_PER_EXAMPLE, Math.round(baseWeight * recencyMultiplier)))
}
