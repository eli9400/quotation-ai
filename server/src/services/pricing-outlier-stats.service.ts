type Bounds = {
  low: number
  high: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2
  return sorted[middle]
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 1) return sorted[0]
  const rank = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  if (lower === upper) return sorted[lower]
  const ratio = rank - lower
  return sorted[lower] + (sorted[upper] - sorted[lower]) * ratio
}

function groupValuesByKey<T>(
  items: T[],
  toKey: (item: T) => string,
  toValue: (item: T) => number,
): Map<string, number[]> {
  const grouped = new Map<string, number[]>()
  items.forEach((item) => {
    const key = toKey(item)
    const value = toValue(item)
    const current = grouped.get(key) ?? []
    current.push(value)
    grouped.set(key, current)
  })
  return grouped
}

export function buildMedianMap<T>(
  items: T[],
  toKey: (item: T) => string,
  toValue: (item: T) => number,
): Map<string, number> {
  const grouped = groupValuesByKey(items, toKey, toValue)
  const medians = new Map<string, number>()
  grouped.forEach((values, key) => {
    medians.set(key, median(values))
  })
  return medians
}

export function buildRobustBoundsMap<T>(
  items: T[],
  toKey: (item: T) => string,
  toValue: (item: T) => number,
  minSamples: number = 8,
): Map<string, Bounds> {
  const grouped = groupValuesByKey(items, toKey, toValue)
  const boundsByKey = new Map<string, Bounds>()

  grouped.forEach((values, key) => {
    if (values.length < minSamples) return
    const q1 = percentile(values, 0.25)
    const q3 = percentile(values, 0.75)
    const iqr = Math.max(0, q3 - q1)
    const p02 = percentile(values, 0.02)
    const p98 = percentile(values, 0.98)
    const low = Math.max(p02, q1 - 1.5 * iqr)
    const high = Math.min(p98, q3 + 1.5 * iqr)
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= 0 || low >= high) return
    boundsByKey.set(key, { low, high })
  })

  return boundsByKey
}
