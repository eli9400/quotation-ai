export type TrainingStatus = 'running' | 'completed' | 'failed'

export type TrainingStage =
  | 'prepare'
  | 'load_documents'
  | 'extract_text'
  | 'parse_pricing_lines'
  | 'build_dataset'
  | 'learn_items'
  | 'normalize_schema'
  | 'finalize'

export const TRAINING_STAGES: TrainingStage[] = [
  'prepare',
  'load_documents',
  'extract_text',
  'parse_pricing_lines',
  'build_dataset',
  'learn_items',
  'normalize_schema',
  'finalize',
]

export type TrainingStageProgress = Record<TrainingStage, number>

export type TrainingDatasetSnapshotMetrics = {
  totalExamples: number
  splitCounts: { train: number; validation: number; test: number }
  uniqueItems: number
  sourceCounts: { uploaded_document: number; approved_quote: number }
  unitDistribution: Record<string, number>
  generatedAt: string
}

export type TrainingDatasetDrift = {
  baselineAvailable: boolean
  comparedToJobId: string | null
  comparedToDatasetVersionId: string | null
  changed: boolean
  severity: 'none' | 'low' | 'medium' | 'high'
  totalExamplesDelta: number
  totalExamplesDeltaPct: number | null
  uniqueItemsDelta: number
  uniqueItemsDeltaPct: number | null
  maxUnitShareDeltaPctPoints: number
  unitShareDeltaPctPoints: Record<string, number>
}

export type TrainingDatasetSnapshot = {
  datasetVersionId: string
  datasetFingerprint: string
  metrics: TrainingDatasetSnapshotMetrics
  driftFromPreviousRun: TrainingDatasetDrift
}

export type TrainingJob = {
  id: string
  serviceProviderUid: string
  status: TrainingStatus
  progress: number
  currentStage: TrainingStage
  stageProgress: TrainingStageProgress
  documentIds: string[]
  startedAt: string
  updatedAt: string
  completedAt: string | null
  errorMessage: string | null
  datasetSnapshot: TrainingDatasetSnapshot | null
}
