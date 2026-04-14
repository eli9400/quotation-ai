import { createHash } from 'node:crypto'
import { buildEvaluationMetricSummary } from './model-evaluation-metrics.service.js'
import type { ModelFeatureRow } from '../types/model-feature-schema.js'
import type { ModelV1MetricSummary, ModelV1Payload, ModelV1Regressor } from '../types/model-v1.js'

type FitPoint = { itemKey: string; unit: string; quantity: number; targetUnitPrice: number }
type PredictionSource = 'direct_item_unit' | 'unit_fallback' | 'global_fallback'
type TrainOptions = { minItemSamples?: number; minUnitSamples?: number; testRatio?: number; seed?: string }

const DEFAULT_MIN_ITEM_SAMPLES = 3
const DEFAULT_MIN_UNIT_SAMPLES = 5

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function xTransform(quantity: number): number {
  return Math.log1p(Math.max(0, quantity))
}

function hashToUnitInterval(value: string): number {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 8)
  return Number.parseInt(hex, 16) / 0xffffffff
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * q
  const low = Math.floor(idx)
  const high = Math.ceil(idx)
  if (low === high) return sorted[low]
  const weight = idx - low
  return sorted[low] * (1 - weight) + sorted[high] * weight
}

function fitRegressor(key: string, unit: string, points: FitPoint[]): ModelV1Regressor {
  const xs = points.map((point) => xTransform(point.quantity))
  const ys = points.map((point) => point.targetUnitPrice)
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length
  const varianceX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  const covariance = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0)
  const slope = varianceX > 0 ? covariance / varianceX : 0
  const intercept = meanY - slope * meanX
  return {
    key,
    unit,
    samples: points.length,
    intercept: round(intercept),
    slope: round(slope),
    p25: round(quantile(ys, 0.25)),
    p50: round(quantile(ys, 0.5)),
    p75: round(quantile(ys, 0.75)),
    minPrediction: round(Math.max(0.1, quantile(ys, 0.05))),
    maxPrediction: round(Math.max(0.1, quantile(ys, 0.95))),
  }
}

function groupBy<T>(rows: T[], keyBuilder: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  rows.forEach((row) => grouped.set(keyBuilder(row), [...(grouped.get(keyBuilder(row)) ?? []), row]))
  return grouped
}

function toPoints(rows: ModelFeatureRow[], targets: number[]): FitPoint[] {
  return rows.map((row, index) => ({
    itemKey: row.itemKey,
    unit: row.unit,
    quantity: row.quantity,
    targetUnitPrice: targets[index],
  }))
}

function buildPayload(points: FitPoint[], options: TrainOptions): ModelV1Payload {
  const minItemSamples = options.minItemSamples ?? DEFAULT_MIN_ITEM_SAMPLES
  const minUnitSamples = options.minUnitSamples ?? DEFAULT_MIN_UNIT_SAMPLES
  return {
    schemaVersion: 'v1',
    transform: 'log1p_quantity',
    directByItemUnit: Array.from(groupBy(points, (row) => row.itemKey).entries())
      .filter(([, group]) => group.length >= minItemSamples)
      .map(([itemKey, group]) => fitRegressor(itemKey, group[0].unit, group)),
    fallbackByUnit: Array.from(groupBy(points, (row) => row.unit).entries())
      .filter(([, group]) => group.length >= minUnitSamples)
      .map(([unit, group]) => fitRegressor(unit, unit, group)),
    globalFallback: fitRegressor('*', 'unknown', points),
  }
}

function predictWithRegressor(regressor: ModelV1Regressor, quantity: number): number {
  const raw = regressor.intercept + regressor.slope * xTransform(quantity)
  return round(Math.max(regressor.minPrediction, Math.min(regressor.maxPrediction, raw)))
}

function splitRandom(points: FitPoint[], testRatio = 0.2, seed = 'model-v1'): { train: FitPoint[]; test: FitPoint[] } {
  const train: FitPoint[] = []
  const test: FitPoint[] = []
  points.forEach((point, index) => {
    if (hashToUnitInterval(`${seed}|${index}|${point.itemKey}`) < testRatio) test.push(point)
    else train.push(point)
  })
  if (train.length === 0 && test.length > 1) train.push(test.shift() as FitPoint)
  if (test.length === 0 && train.length > 1) test.push(train.pop() as FitPoint)
  return { train, test }
}

function splitTime(points: FitPoint[], testRatio = 0.2): { train: FitPoint[]; test: FitPoint[] } {
  const testSize = Math.max(1, Math.round(points.length * testRatio))
  const train = points.slice(0, Math.max(1, points.length - testSize))
  const test = points.slice(Math.max(1, points.length - testSize))
  return { train, test }
}

export function predictModelV1(
  payload: ModelV1Payload,
  input: { itemKey: string; unit: string; quantity: number },
): {
  unitPrice: number
  p25: number
  p50: number
  p75: number
  uncertaintyScore: number
  source: PredictionSource
} {
  const toOutput = (regressor: ModelV1Regressor, source: PredictionSource) => {
    const p50Prediction = predictWithRegressor(regressor, input.quantity)
    const p25 = Math.max(regressor.minPrediction, Math.min(regressor.maxPrediction, regressor.p25))
    const p75 = Math.max(regressor.minPrediction, Math.min(regressor.maxPrediction, regressor.p75))
    const span = Math.max(0, p75 - p25)
    const uncertaintyScore = round(Math.min(1, span / Math.max(1, p50Prediction)))
    return {
      unitPrice: p50Prediction,
      p25: round(p25),
      p50: p50Prediction,
      p75: round(Math.max(p25, p75)),
      uncertaintyScore,
      source,
    }
  }
  const direct = payload.directByItemUnit.find((row) => row.key === input.itemKey)
  if (direct) return toOutput(direct, 'direct_item_unit')
  const byUnit = payload.fallbackByUnit.find((row) => row.key === input.unit)
  if (byUnit) return toOutput(byUnit, 'unit_fallback')
  return toOutput(payload.globalFallback, 'global_fallback')
}

function evaluate(payload: ModelV1Payload, points: FitPoint[], strategy: 'random' | 'time'): ModelV1MetricSummary {
  const metrics = buildEvaluationMetricSummary(
    points.map((point) => ({
      actual: point.targetUnitPrice,
      predicted: predictModelV1(payload, point).unitPrice,
    })),
  )
  return { strategy, ...metrics }
}

export function trainAndEvaluateModelV1(
  rows: ModelFeatureRow[],
  targets: number[],
  options: TrainOptions = {},
): { payload: ModelV1Payload; metrics: ModelV1MetricSummary[] } {
  if (rows.length !== targets.length || rows.length < 3) {
    throw new Error('Model v1 requires aligned feature rows and targets (minimum 3 samples).')
  }
  const points = toPoints(rows, targets)
  const payload = buildPayload(points, options)
  const random = splitRandom(points, options.testRatio ?? 0.2, options.seed ?? 'model-v1')
  const time = splitTime(points, options.testRatio ?? 0.2)
  return {
    payload,
    metrics: [evaluate(buildPayload(random.train, options), random.test, 'random'), evaluate(buildPayload(time.train, options), time.test, 'time')],
  }
}
