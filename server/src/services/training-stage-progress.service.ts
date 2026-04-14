import {
  TRAINING_STAGES,
  type TrainingStage,
  type TrainingStageProgress,
} from '../types/training.js'

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function isTrainingStage(value: string): value is TrainingStage {
  return TRAINING_STAGES.includes(value as TrainingStage)
}

export function createEmptyStageProgress(): TrainingStageProgress {
  return TRAINING_STAGES.reduce((acc, stage) => {
    acc[stage] = 0
    return acc
  }, {} as TrainingStageProgress)
}

export function createCompletedStageProgress(): TrainingStageProgress {
  return TRAINING_STAGES.reduce((acc, stage) => {
    acc[stage] = 100
    return acc
  }, {} as TrainingStageProgress)
}

export function normalizeTrainingStage(
  value: unknown,
  fallback: TrainingStage = 'prepare',
): TrainingStage {
  return typeof value === 'string' && isTrainingStage(value) ? value : fallback
}

export function normalizeTrainingStageProgress(
  value: unknown,
): TrainingStageProgress {
  const empty = createEmptyStageProgress()
  if (!value || typeof value !== 'object') {
    return empty
  }

  const raw = value as Partial<Record<TrainingStage, unknown>>
  TRAINING_STAGES.forEach((stage) => {
    const stageValue = raw[stage]
    if (typeof stageValue === 'number') {
      empty[stage] = clampPercent(stageValue)
    }
  })

  return empty
}

export function mergeTrainingStageProgress(
  current: TrainingStageProgress,
  patch: Partial<TrainingStageProgress>,
): TrainingStageProgress {
  const merged: TrainingStageProgress = { ...current }
  TRAINING_STAGES.forEach((stage) => {
    if (patch[stage] === undefined) {
      return
    }
    const nextValue = clampPercent(patch[stage] as number)
    merged[stage] = Math.max(current[stage], nextValue)
  })
  return merged
}

export function isEmptyStageProgress(value: TrainingStageProgress): boolean {
  return TRAINING_STAGES.every((stage) => value[stage] === 0)
}
