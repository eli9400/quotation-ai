import type {
  TrainingJob,
  TrainingStage,
  TrainingStageProgress,
} from '../types/quotation'

export const TRAINING_STAGE_ORDER: TrainingStage[] = [
  'prepare',
  'load_documents',
  'extract_text',
  'parse_pricing_lines',
  'build_dataset',
  'learn_items',
  'normalize_schema',
  'finalize',
]

const TRAINING_STAGE_LABELS: Record<TrainingStage, string> = {
  prepare: '\u05d4\u05db\u05e0\u05d4',
  load_documents: '\u05d8\u05e2\u05d9\u05e0\u05ea \u05de\u05e1\u05de\u05db\u05d9\u05dd',
  extract_text: '\u05d7\u05d9\u05dc\u05d5\u05e5 \u05d8\u05e7\u05e1\u05d8',
  parse_pricing_lines: '\u05d0\u05d9\u05ea\u05d5\u05e8 \u05e8\u05db\u05d9\u05d1\u05d9 \u05ea\u05de\u05d7\u05d5\u05e8',
  build_dataset: '\u05d1\u05e0\u05d9\u05d9\u05ea \u05de\u05d0\u05d2\u05e8 \u05d0\u05d9\u05de\u05d5\u05df',
  learn_items: '\u05dc\u05de\u05d9\u05d3\u05ea \u05e8\u05db\u05d9\u05d1\u05d9\u05dd',
  normalize_schema: '\u05e0\u05d9\u05e8\u05de\u05d5\u05dc \u05d5\u05d1\u05e0\u05d9\u05d9\u05ea \u05d8\u05d5\u05e4\u05e1',
  finalize: '\u05e1\u05d9\u05d5\u05dd',
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function createEmptyTrainingStageProgress(): TrainingStageProgress {
  return TRAINING_STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = 0
    return acc
  }, {} as TrainingStageProgress)
}

export function normalizeTrainingStageProgress(
  value: Partial<TrainingStageProgress> | null | undefined,
): TrainingStageProgress {
  const defaults = createEmptyTrainingStageProgress()
  if (!value) {
    return defaults
  }

  TRAINING_STAGE_ORDER.forEach((stage) => {
    const stageValue = value[stage]
    if (typeof stageValue === 'number') {
      defaults[stage] = clampPercent(stageValue)
    }
  })
  return defaults
}

export function normalizeTrainingStage(stage: TrainingStage | null | undefined): TrainingStage {
  if (stage && TRAINING_STAGE_ORDER.includes(stage)) {
    return stage
  }
  return 'prepare'
}

export type TrainingStageView = {
  key: TrainingStage
  label: string
  value: number
  isActive: boolean
  isCompleted: boolean
}

export function toTrainingStageView(
  job: Pick<TrainingJob, 'currentStage' | 'stageProgress'> | null,
): TrainingStageView[] {
  const currentStage = normalizeTrainingStage(job?.currentStage)
  const stageProgress = normalizeTrainingStageProgress(job?.stageProgress)
  return TRAINING_STAGE_ORDER.map((stage) => {
    const value = stageProgress[stage]
    return {
      key: stage,
      label: TRAINING_STAGE_LABELS[stage],
      value,
      isActive: stage === currentStage,
      isCompleted: value >= 100,
    }
  })
}
