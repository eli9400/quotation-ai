import type { TrainingDatasetDrift, TrainingDatasetSnapshot, TrainingDatasetSnapshotMetrics } from '../types/training.js'

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  if (value === null) return null
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, val]) => {
    if (typeof val === 'number' && Number.isFinite(val)) acc[key] = val
    return acc
  }, {})
}

function normalizeMetrics(raw: unknown): TrainingDatasetSnapshotMetrics | null {
  if (!raw || typeof raw !== 'object') return null
  const metrics = raw as Record<string, unknown>
  const split = (metrics.splitCounts ?? {}) as Record<string, unknown>
  const source = (metrics.sourceCounts ?? {}) as Record<string, unknown>
  return {
    totalExamples: asNumber(metrics.totalExamples, 0),
    splitCounts: {
      train: asNumber(split.train, 0),
      validation: asNumber(split.validation, 0),
      test: asNumber(split.test, 0),
    },
    uniqueItems: asNumber(metrics.uniqueItems, 0),
    sourceCounts: {
      uploaded_document: asNumber(source.uploaded_document, 0),
      approved_quote: asNumber(source.approved_quote, 0),
    },
    unitDistribution: asRecord(metrics.unitDistribution),
    generatedAt: asString(metrics.generatedAt, new Date(0).toISOString()),
  }
}

function normalizeDrift(raw: unknown): TrainingDatasetDrift {
  const drift = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>
  return {
    baselineAvailable: Boolean(drift.baselineAvailable),
    comparedToJobId: asNullableString(drift.comparedToJobId),
    comparedToDatasetVersionId: asNullableString(drift.comparedToDatasetVersionId),
    changed: Boolean(drift.changed),
    severity: (drift.severity === 'low' || drift.severity === 'medium' || drift.severity === 'high' || drift.severity === 'none')
      ? drift.severity
      : 'none',
    totalExamplesDelta: asNumber(drift.totalExamplesDelta, 0),
    totalExamplesDeltaPct:
      typeof drift.totalExamplesDeltaPct === 'number' && Number.isFinite(drift.totalExamplesDeltaPct)
        ? drift.totalExamplesDeltaPct
        : null,
    uniqueItemsDelta: asNumber(drift.uniqueItemsDelta, 0),
    uniqueItemsDeltaPct:
      typeof drift.uniqueItemsDeltaPct === 'number' && Number.isFinite(drift.uniqueItemsDeltaPct)
        ? drift.uniqueItemsDeltaPct
        : null,
    maxUnitShareDeltaPctPoints: asNumber(drift.maxUnitShareDeltaPctPoints, 0),
    unitShareDeltaPctPoints: asRecord(drift.unitShareDeltaPctPoints),
  }
}

export function normalizeTrainingDatasetSnapshot(raw: unknown): TrainingDatasetSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const snapshot = raw as Record<string, unknown>
  const datasetVersionId = asString(snapshot.datasetVersionId).trim()
  const datasetFingerprint = asString(snapshot.datasetFingerprint).trim()
  const metrics = normalizeMetrics(snapshot.metrics)
  if (!datasetVersionId || !datasetFingerprint || !metrics) return null
  return {
    datasetVersionId,
    datasetFingerprint,
    metrics,
    driftFromPreviousRun: normalizeDrift(snapshot.driftFromPreviousRun),
  }
}
