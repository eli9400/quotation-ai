import { createHash } from 'node:crypto'
import type { TrainingDatasetSnapshot, TrainingDatasetSnapshotMetrics, TrainingDatasetDrift } from '../types/training.js'
import type { RebuildTrainingDatasetResult, TrainingDatasetExample } from '../types/training-dataset.js'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function deltaPct(current: number, baseline: number): number | null {
  if (baseline === 0) return current === 0 ? 0 : null
  return round2(((current - baseline) / baseline) * 100)
}

function distributionDelta(
  current: Record<string, number>,
  baseline: Record<string, number>,
  currentTotal: number,
  baselineTotal: number,
): { byUnit: Record<string, number>; maxDelta: number } {
  const units = new Set([...Object.keys(current), ...Object.keys(baseline)])
  const byUnit: Record<string, number> = {}
  let maxDelta = 0
  units.forEach((unit) => {
    const currentShare = currentTotal > 0 ? ((current[unit] ?? 0) / currentTotal) * 100 : 0
    const baselineShare = baselineTotal > 0 ? ((baseline[unit] ?? 0) / baselineTotal) * 100 : 0
    const delta = round2(currentShare - baselineShare)
    if (Math.abs(delta) > 0.01) byUnit[unit] = delta
    maxDelta = Math.max(maxDelta, Math.abs(delta))
  })
  return { byUnit, maxDelta: round2(maxDelta) }
}

function resolveDriftSeverity(totalPct: number | null, uniquePct: number | null, maxUnitDelta: number): TrainingDatasetDrift['severity'] {
  const maxAbs = Math.max(Math.abs(totalPct ?? 0), Math.abs(uniquePct ?? 0))
  if (maxAbs >= 30 || maxUnitDelta >= 20) return 'high'
  if (maxAbs >= 15 || maxUnitDelta >= 10) return 'medium'
  if (maxAbs > 0 || maxUnitDelta > 0) return 'low'
  return 'none'
}

export function buildDatasetFingerprint(examples: TrainingDatasetExample[]): string {
  const rows = examples
    .map((example) =>
      [
        example.itemKey.trim(),
        example.unit,
        example.split,
        example.source,
        example.sourceDocumentId ?? '',
        round2(example.quantity),
        round2(example.targetUnitPrice),
        round2(example.lineTotal),
      ].join('|'),
    )
    .sort((a, b) => a.localeCompare(b))
  return createHash('sha1').update(rows.join('\n')).digest('hex')
}

export function buildDatasetVersionId(fingerprint: string): string {
  return `ds_${fingerprint.slice(0, 16)}`
}

export function createTrainingDatasetDrift(
  current: TrainingDatasetSnapshotMetrics,
  previousSnapshot: TrainingDatasetSnapshot | null,
  previousJobId: string | null,
): TrainingDatasetDrift {
  if (!previousSnapshot) {
    return {
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
    }
  }
  const previous = previousSnapshot.metrics
  const totalExamplesDelta = current.totalExamples - previous.totalExamples
  const uniqueItemsDelta = current.uniqueItems - previous.uniqueItems
  const totalExamplesDeltaPct = deltaPct(current.totalExamples, previous.totalExamples)
  const uniqueItemsDeltaPct = deltaPct(current.uniqueItems, previous.uniqueItems)
  const unitDelta = distributionDelta(
    current.unitDistribution,
    previous.unitDistribution,
    current.totalExamples,
    previous.totalExamples,
  )
  const changed = totalExamplesDelta !== 0 || uniqueItemsDelta !== 0 || unitDelta.maxDelta > 0
  return {
    baselineAvailable: true,
    comparedToJobId: previousJobId,
    comparedToDatasetVersionId: previousSnapshot.datasetVersionId,
    changed,
    severity: resolveDriftSeverity(totalExamplesDeltaPct, uniqueItemsDeltaPct, unitDelta.maxDelta),
    totalExamplesDelta,
    totalExamplesDeltaPct,
    uniqueItemsDelta,
    uniqueItemsDeltaPct,
    maxUnitShareDeltaPctPoints: unitDelta.maxDelta,
    unitShareDeltaPctPoints: unitDelta.byUnit,
  }
}

export function createTrainingDatasetSnapshot(params: {
  result: RebuildTrainingDatasetResult
  previousSnapshot: TrainingDatasetSnapshot | null
  previousJobId: string | null
}): TrainingDatasetSnapshot {
  const metrics: TrainingDatasetSnapshotMetrics = {
    totalExamples: params.result.totalExamples,
    splitCounts: params.result.splitCounts,
    uniqueItems: params.result.uniqueItems,
    sourceCounts: params.result.sourceCounts,
    unitDistribution: params.result.unitDistribution,
    generatedAt: params.result.generatedAt,
  }
  return {
    datasetVersionId: params.result.datasetVersionId,
    datasetFingerprint: params.result.datasetFingerprint,
    metrics,
    driftFromPreviousRun: createTrainingDatasetDrift(
      metrics,
      params.previousSnapshot,
      params.previousJobId,
    ),
  }
}
