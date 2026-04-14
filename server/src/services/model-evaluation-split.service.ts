import { createHash } from 'node:crypto'
import type { EvaluationSplit } from '../types/model-evaluation.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.2
  return Math.max(0.05, Math.min(0.5, value))
}

function parseComparableTime(example: TrainingDatasetExample): number {
  const dateSource = example.sourceQuoteDate ?? example.createdAt
  const parsed = Date.parse(dateSource)
  return Number.isNaN(parsed) ? 0 : parsed
}

function hashToUnitInterval(input: string): number {
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 8)
  const int = Number.parseInt(hex, 16)
  return int / 0xffffffff
}

function ensureNonEmptySplit(
  train: TrainingDatasetExample[],
  test: TrainingDatasetExample[],
): void {
  if (train.length > 0 && test.length > 0) return
  if (train.length === 0 && test.length > 1) {
    train.push(test.shift() as TrainingDatasetExample)
    return
  }
  if (test.length === 0 && train.length > 1) {
    test.push(train.pop() as TrainingDatasetExample)
  }
}

export function buildRandomEvaluationSplit(
  examples: TrainingDatasetExample[],
  testRatioInput = 0.2,
  seed = 'quotation-ai-eval',
): EvaluationSplit {
  const testRatio = clampRatio(testRatioInput)
  const train: TrainingDatasetExample[] = []
  const test: TrainingDatasetExample[] = []
  examples.forEach((example) => {
    const bucket = hashToUnitInterval(`${seed}|${example.id}`)
    if (bucket < testRatio) {
      test.push(example)
    } else {
      train.push(example)
    }
  })
  ensureNonEmptySplit(train, test)
  return { strategy: 'random', train, test }
}

export function buildTimeEvaluationSplit(
  examples: TrainingDatasetExample[],
  testRatioInput = 0.2,
): EvaluationSplit {
  const testRatio = clampRatio(testRatioInput)
  const sorted = [...examples].sort(
    (left, right) => parseComparableTime(left) - parseComparableTime(right),
  )
  const requestedTestSize = Math.max(1, Math.round(sorted.length * testRatio))
  const test = sorted.slice(-requestedTestSize)
  const train = sorted.slice(0, Math.max(0, sorted.length - requestedTestSize))
  ensureNonEmptySplit(train, test)
  return { strategy: 'time', train, test }
}
