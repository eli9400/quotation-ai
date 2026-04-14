import type { TrainingDatasetExample } from './training-dataset.js'

export type EvaluationMetricSummary = {
  samples: number
  mae: number
  mape: number | null
  smape: number | null
  medianAe: number
}

export type EvaluationCoverage = {
  directItemUnit: number
  unitFallback: number
  globalFallback: number
}

export type EvaluationSplit = {
  strategy: 'random' | 'time'
  train: TrainingDatasetExample[]
  test: TrainingDatasetExample[]
}

export type EvaluationSplitSummary = {
  strategy: 'random' | 'time'
  trainCount: number
  testCount: number
  metrics: EvaluationMetricSummary
  coverage: EvaluationCoverage
}

export type TrainingEvaluationReport = {
  serviceProviderUid: string
  generatedAt: string
  totalExamples: number
  datasetVersionId: string | null
  datasetFingerprint: string | null
  summaries: EvaluationSplitSummary[]
}
