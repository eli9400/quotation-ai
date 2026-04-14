import type { EvaluationCoverage } from '../types/model-evaluation.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

type Quantiles = { p25: number; p50: number; p75: number }

type BaselineModel = {
  byItemUnit: Map<string, Quantiles>
  byUnit: Map<string, Quantiles>
  global: Quantiles
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function buildQuantiles(values: number[]): Quantiles {
  return {
    p25: quantile(values, 0.25),
    p50: quantile(values, 0.5),
    p75: quantile(values, 0.75),
  }
}

function itemUnitKey(example: TrainingDatasetExample): string {
  return `${example.itemKey}|${example.unit}`
}

export function buildMedianBaselineModel(train: TrainingDatasetExample[]): BaselineModel {
  const itemUnitValues = new Map<string, number[]>()
  const unitValues = new Map<string, number[]>()
  const allValues: number[] = []

  train.forEach((example) => {
    allValues.push(example.targetUnitPrice)
    const itemKey = itemUnitKey(example)
    itemUnitValues.set(itemKey, [...(itemUnitValues.get(itemKey) ?? []), example.targetUnitPrice])
    unitValues.set(example.unit, [...(unitValues.get(example.unit) ?? []), example.targetUnitPrice])
  })

  const byItemUnit = new Map<string, Quantiles>()
  itemUnitValues.forEach((values, key) => byItemUnit.set(key, buildQuantiles(values)))
  const byUnit = new Map<string, Quantiles>()
  unitValues.forEach((values, key) => byUnit.set(key, buildQuantiles(values)))
  const global = buildQuantiles(allValues.length > 0 ? allValues : [0])

  return { byItemUnit, byUnit, global }
}

export function predictMedianBaseline(
  model: BaselineModel,
  example: TrainingDatasetExample,
): { predicted: number; source: keyof EvaluationCoverage } {
  const itemMatch = model.byItemUnit.get(itemUnitKey(example))
  if (itemMatch) return { predicted: itemMatch.p50, source: 'directItemUnit' }
  const unitMatch = model.byUnit.get(example.unit)
  if (unitMatch) return { predicted: unitMatch.p50, source: 'unitFallback' }
  return { predicted: model.global.p50, source: 'globalFallback' }
}
