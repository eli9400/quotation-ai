import type { LearnedPricingItem } from '../types/model-profile.js'

type QuantityPricePoint = {
  quantity: number
  unitPrice: number
  weight: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function toGroupedSamples(item: LearnedPricingItem): Map<number, number[]> {
  const grouped = new Map<number, number[]>()
  for (const sample of item.quantityPriceSamples ?? []) {
    if (!Number.isFinite(sample.quantity) || !Number.isFinite(sample.unitPrice)) continue
    if (sample.quantity <= 0 || sample.unitPrice <= 0) continue
    const key = round2(sample.quantity)
    const prices = grouped.get(key) ?? []
    prices.push(round2(sample.unitPrice))
    grouped.set(key, prices)
  }
  return grouped
}

function toSortedPoints(item: LearnedPricingItem): QuantityPricePoint[] {
  const grouped = toGroupedSamples(item)
  return Array.from(grouped.entries())
    .map(([quantity, prices]) => ({
      quantity,
      unitPrice: round2(median(prices)),
      weight: Math.max(1, prices.length),
    }))
    .sort((a, b) => a.quantity - b.quantity)
}

function interpolatePrice(
  left: QuantityPricePoint,
  right: QuantityPricePoint,
  quantity: number,
): number {
  if (right.quantity <= left.quantity) {
    return left.unitPrice
  }
  const ratio = (quantity - left.quantity) / (right.quantity - left.quantity)
  return left.unitPrice + (right.unitPrice - left.unitPrice) * ratio
}

function enforceMonotonicDecrease(points: QuantityPricePoint[]): QuantityPricePoint[] {
  if (points.length <= 1) {
    return points
  }

  const blocks: Array<{ start: number; end: number; weight: number; mean: number }> = []

  points.forEach((point, index) => {
    blocks.push({
      start: index,
      end: index,
      weight: point.weight,
      mean: point.unitPrice,
    })

    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1]
      const left = blocks[blocks.length - 2]
      if (left.mean >= right.mean) {
        break
      }
      const mergedWeight = left.weight + right.weight
      const mergedMean = (left.mean * left.weight + right.mean * right.weight) / mergedWeight
      blocks.splice(blocks.length - 2, 2, {
        start: left.start,
        end: right.end,
        weight: mergedWeight,
        mean: mergedMean,
      })
    }
  })

  const smoothed = points.map((point) => ({ ...point }))
  blocks.forEach((block) => {
    for (let index = block.start; index <= block.end; index += 1) {
      smoothed[index].unitPrice = round2(block.mean)
    }
  })

  return smoothed
}

function estimateFromPoints(points: QuantityPricePoint[], quantity: number): number {
  if (points.length === 1) {
    return points[0].unitPrice
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index]
    const right = points[index + 1]
    if (quantity >= left.quantity && quantity <= right.quantity) {
      const predicted = interpolatePrice(left, right, quantity)
      return round2(clamp(predicted, Math.min(left.unitPrice, right.unitPrice), left.unitPrice))
    }
  }

  if (quantity < points[0].quantity) {
    const predicted = interpolatePrice(points[0], points[1], quantity)
    return round2(clamp(predicted, points[1].unitPrice, points[0].unitPrice * 1.05))
  }

  const tail = points.slice(-2)
  const predicted = interpolatePrice(tail[0], tail[1], quantity)
  return round2(clamp(predicted, tail[1].unitPrice * 0.8, tail[0].unitPrice))
}

export function exactMatchUnitPrice(item: LearnedPricingItem, quantity: number): number | null {
  const grouped = toGroupedSamples(item)
  const key = Array.from(grouped.keys()).find((current) => Math.abs(current - quantity) <= 0.01)
  if (key === undefined) {
    return null
  }
  const samples = grouped.get(key) ?? []
  if (samples.length === 0) {
    return null
  }
  if (samples.length === 1) {
    return round2(samples[0])
  }
  return round2(median(samples))
}

export function estimateUnitPriceLinear(item: LearnedPricingItem, quantity: number): number {
  const exact = exactMatchUnitPrice(item, quantity)
  if (exact !== null) {
    return exact
  }

  const points = enforceMonotonicDecrease(toSortedPoints(item))
  if (points.length >= 2) {
    const estimated = estimateFromPoints(points, quantity)
    const minPrice = Math.min(...points.map((point) => point.unitPrice))
    const maxPrice = Math.max(...points.map((point) => point.unitPrice))
    return round2(clamp(estimated, minPrice * 0.8, maxPrice * 1.05))
  }

  const qMin = Math.max(1, item.quantity.min)
  const qMax = Math.max(qMin, item.quantity.max)
  const pHigh = Math.max(item.pricePerUnit.min, item.pricePerUnit.avg, item.pricePerUnit.max)
  const pLow = Math.min(item.pricePerUnit.min, item.pricePerUnit.avg, item.pricePerUnit.max)

  if (qMax <= qMin || pHigh <= 0 || pLow <= 0 || pHigh === pLow) {
    return round2(Math.max(0.1, item.pricePerUnit.avg))
  }

  const slope = (pLow - pHigh) / (qMax - qMin)
  const intercept = pHigh - slope * qMin
  const predicted = intercept + slope * quantity
  return round2(clamp(predicted, pLow * 0.85, pHigh * 1.05))
}
