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
}
