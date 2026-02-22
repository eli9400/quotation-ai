import type { ProviderLineItemOption } from '../../types/quotation'

type QuantityPricePoint = {
  quantity: number
  unitPrice: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): Set<string> {
  return new Set(normalizeText(value).split(' ').filter((token) => token.length >= 2))
}

function similarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let common = 0
  left.forEach((token) => {
    if (right.has(token)) common += 1
  })
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : common / union
}

export function normalizeUnit(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === '%' || normalized === 'pct') return 'percent'
  return normalized
}

export function listProviderOnlyOptions(
  options: ProviderLineItemOption[],
): ProviderLineItemOption[] {
  return options.filter((item) => item.isProviderOnly)
}

export function findLineItemOptionById(
  options: ProviderLineItemOption[],
  id: string,
): ProviderLineItemOption | null {
  return options.find((item) => item.id === id) ?? null
}

export function findLineItemOptionByText(
  options: ProviderLineItemOption[],
  description: string,
): ProviderLineItemOption | null {
  const normalized = normalizeText(description)
  if (!normalized) return null
  const exact =
    options.find((item) => normalizeText(item.canonicalName) === normalized) ??
    options.find((item) => item.aliases.some((alias) => normalizeText(alias) === normalized)) ??
    options.find((item) => normalizeText(item.label) === normalized)
  if (exact) return exact

  const queryTokens = tokenize(description)
  const bestMatch = options
    .map((item) => {
      const canonicalScore = similarity(queryTokens, tokenize(item.canonicalName))
      const aliasScore = item.aliases.reduce((best, alias) => {
        const next = similarity(queryTokens, tokenize(alias))
        return next > best ? next : best
      }, 0)
      return { item, score: Math.max(canonicalScore, aliasScore) }
    })
    .sort((left, right) => right.score - left.score || right.item.sampleLines - left.item.sampleLines)[0]

  if (!bestMatch || bestMatch.score < 0.6) {
    return null
  }
  return bestMatch.item
}

function extractPoints(item: ProviderLineItemOption): QuantityPricePoint[] {
  const grouped = new Map<number, number[]>()
  item.quantityPriceSamples.forEach((sample) => {
    if (sample.quantity <= 0 || sample.unitPrice <= 0) return
    const key = round2(sample.quantity)
    const current = grouped.get(key) ?? []
    current.push(round2(sample.unitPrice))
    grouped.set(key, current)
  })
  return Array.from(grouped.entries())
    .map(([quantity, prices]) => ({
      quantity,
      unitPrice: round2(median(prices)),
    }))
    .sort((a, b) => a.quantity - b.quantity)
}

function estimateByBinning(points: QuantityPricePoint[], quantity: number): number | null {
  if (points.length === 0) return null
  const quantities = points.map((point) => point.quantity).sort((a, b) => a - b)
  const q33 = quantities[Math.floor((quantities.length - 1) * 0.33)] ?? quantities[0]
  const q66 = quantities[Math.floor((quantities.length - 1) * 0.66)] ?? quantities[quantities.length - 1]

  const small: number[] = []
  const medium: number[] = []
  const large: number[] = []
  points.forEach((point) => {
    if (point.quantity <= q33) small.push(point.unitPrice)
    else if (point.quantity <= q66) medium.push(point.unitPrice)
    else large.push(point.unitPrice)
  })

  const target = quantity <= q33 ? small : quantity <= q66 ? medium : large
  const fallback = medium.length > 0 ? medium : small.length > 0 ? small : large
  const prices = target.length > 0 ? target : fallback
  if (prices.length === 0) return null
  return round2(median(prices))
}

function estimateByInterpolation(points: QuantityPricePoint[], quantity: number): number {
  if (points.length === 1) return points[0].unitPrice
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index]
    const right = points[index + 1]
    if (quantity >= left.quantity && quantity <= right.quantity) {
      const ratio = (quantity - left.quantity) / (right.quantity - left.quantity)
      return round2(left.unitPrice + (right.unitPrice - left.unitPrice) * ratio)
    }
  }
  if (quantity < points[0].quantity) return points[0].unitPrice
  return points[points.length - 1].unitPrice
}

export function estimateLineItemUnitPrice(
  option: ProviderLineItemOption,
  quantity: number,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (normalizeUnit(option.unit) === 'percent') return 1
  const points = extractPoints(option)
  if (points.length === 0) return 0
  const exact = points.find((point) => Math.abs(point.quantity - quantity) <= 0.01)
  if (exact) return round2(exact.unitPrice)
  const binned = estimateByBinning(points, quantity)
  if (binned !== null && binned > 0) return binned
  return round2(estimateByInterpolation(points, quantity))
}
