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
  prepare: 'הכנה',
  load_documents: 'טעינת מסמכים',
  extract_text: 'חילוץ טקסט',
  parse_pricing_lines: 'איתור רכיבי תמחור',
  build_dataset: 'בניית מאגר אימון',
  learn_items: 'למידת רכיבים',
  normalize_schema: 'נרמול ובניית טופס',
  finalize: 'סיום',
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
