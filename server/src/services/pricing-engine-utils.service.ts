import type { LearnedPricingItem } from '../types/model-profile.js'
import type { GroundedPriceExample, GroundedPriceStats } from './pricing-engine.service.js'

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function toItemKey(item: Pick<LearnedPricingItem, 'canonicalName' | 'unit'>): string {
  return `${item.canonicalName}|${item.unit}`
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2
  return sorted[middle]
}

function quantile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio)),
  )
  return sortedValues[index]
}

export function resolveExamples(
  item: LearnedPricingItem,
  quantity: number,
  limit: number,
): GroundedPriceExample[] {
  const raw = (item.quantityPriceSamples ?? [])
    .filter((sample) => sample.quantity > 0 && sample.unitPrice > 0)
    .map((sample) => ({
      quantity: round2(sample.quantity),
      unitPrice: round2(sample.unitPrice),
    }))
  return raw
    .slice()
    .sort(
      (left, right) =>
        Math.abs(left.quantity - quantity) - Math.abs(right.quantity - quantity) ||
        Math.abs(left.unitPrice - right.unitPrice),
    )
    .slice(0, limit)
}

export function resolvePriceStats(samples: GroundedPriceExample[]): GroundedPriceStats {
  const prices = samples.map((sample) => sample.unitPrice)
  if (prices.length === 0) return { min: 0, median: 0, avg: 0, max: 0 }
  const sorted = prices.slice().sort((a, b) => a - b)
  const avg = sorted.reduce((sum, price) => sum + price, 0) / sorted.length
  return {
    min: round2(sorted[0]),
    median: round2(median(sorted)),
    avg: round2(avg),
    max: round2(sorted[sorted.length - 1]),
  }
}

export function estimateBinnedMedianPrice(item: LearnedPricingItem, quantity: number): number | null {
  const samples = (item.quantityPriceSamples ?? []).filter(
    (sample) => sample.quantity > 0 && sample.unitPrice > 0,
  )
  if (samples.length === 0) return null

  const sortedQty = samples.map((sample) => sample.quantity).sort((a, b) => a - b)
  const q33 = quantile(sortedQty, 0.33)
  const q66 = quantile(sortedQty, 0.66)
  const bins = {
    small: [] as number[],
    medium: [] as number[],
    large: [] as number[],
  }

  samples.forEach((sample) => {
    if (sample.quantity <= q33) bins.small.push(sample.unitPrice)
    else if (sample.quantity <= q66) bins.medium.push(sample.unitPrice)
    else bins.large.push(sample.unitPrice)
  })

  const targetBin = quantity <= q33 ? 'small' : quantity <= q66 ? 'medium' : 'large'
  const targetSamples = bins[targetBin]
  if (targetSamples.length > 0) return round2(median(targetSamples))
  if (bins.medium.length > 0) return round2(median(bins.medium))
  if (bins.small.length > 0) return round2(median(bins.small))
  if (bins.large.length > 0) return round2(median(bins.large))
  return null
}

export function tokenize(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/["'׳³׳´]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return new Set(normalized.split(' ').filter((token) => token.length >= 2))
}

export function similarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  left.forEach((token) => {
    if (right.has(token)) intersection += 1
  })
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}
