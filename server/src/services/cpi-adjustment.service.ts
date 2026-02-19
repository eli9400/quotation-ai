import type { PricingObservation } from '../types/pricing-observation.js'

type WorldBankEntry = {
  date?: string
  value?: number | string | null
}

type WorldBankDataResponse = [
  unknown,
  WorldBankEntry[] | { value?: WorldBankEntry[] } | null | undefined,
]

const CPI_WORLD_BANK_URL =
  'https://api.worldbank.org/v2/country/IL/indicator/FP.CPI.TOTL?format=json&per_page=80'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

let cachedAt = 0
let cachedIndices: Map<number, number> | null = null

function nowMs(): number {
  return Date.now()
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function parseYear(value: string | null): number | null {
  if (!value) return null
  const year = Number(value.slice(0, 4))
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return null
  }
  return year
}

export async function getYearlyCpiIndices(): Promise<Map<number, number>> {
  if (cachedIndices && nowMs() - cachedAt < CACHE_TTL_MS) {
    return cachedIndices
  }

  const response = await fetch(CPI_WORLD_BANK_URL)
  if (!response.ok) {
    throw new Error(`CPI source failed with status ${response.status}`)
  }

  const payload = (await response.json()) as WorldBankDataResponse
  const secondPart = payload?.[1]
  const rawEntries = Array.isArray(secondPart)
    ? secondPart
    : Array.isArray(secondPart?.value)
      ? secondPart.value
      : []
  const indices = new Map<number, number>()
  rawEntries.forEach((entry) => {
    const year = typeof entry.date === 'string' ? Number(entry.date) : NaN
    const indexValue =
      typeof entry.value === 'number'
        ? entry.value
        : typeof entry.value === 'string'
          ? Number(entry.value)
          : NaN
    if (!Number.isInteger(year) || !Number.isFinite(indexValue) || indexValue <= 0) {
      return
    }
    indices.set(year, indexValue)
  })

  if (indices.size === 0) {
    throw new Error('CPI source returned no usable annual index values')
  }

  cachedIndices = indices
  cachedAt = nowMs()
  return indices
}

export function latestAvailableCpiYear(indices: Map<number, number>): number {
  return Math.max(...Array.from(indices.keys()))
}

export function computeCpiFactor(
  indices: Map<number, number>,
  sourceYear: number | null,
  targetYear: number,
): number {
  if (!sourceYear) {
    return 1
  }
  const sourceIndex = indices.get(sourceYear)
  const targetIndex = indices.get(targetYear)
  if (!sourceIndex || !targetIndex || sourceIndex <= 0) {
    return 1
  }

  const rawFactor = targetIndex / sourceIndex
  return round4(Math.max(0.6, Math.min(3, rawFactor)))
}

function toObservationWithFactor(
  observation: PricingObservation,
  factor: number,
  applyToPrices: boolean,
): PricingObservation {
  if (!applyToPrices || factor === 1) {
    return {
      ...observation,
      cpiAdjustmentFactor: factor,
    }
  }

  return {
    ...observation,
    pricePerUnit: round2(observation.pricePerUnit * factor),
    lineTotal: round2(observation.lineTotal * factor),
    cpiAdjustmentFactor: factor,
  }
}

export async function adjustObservationsByCurrentCpi(
  observations: PricingObservation[],
  options?: { applyToPrices?: boolean },
): Promise<PricingObservation[]> {
  if (observations.length === 0) {
    return observations
  }

  const applyToPrices = options?.applyToPrices ?? false
  try {
    const indices = await getYearlyCpiIndices()
    const targetYear = latestAvailableCpiYear(indices)

    return observations.map((observation) => {
      const sourceYear = parseYear(observation.sourceQuoteDate)
      const factor = computeCpiFactor(indices, sourceYear, targetYear)
      return toObservationWithFactor(observation, factor, applyToPrices)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.warn(`[cpi] adjustment skipped: ${message}`)
    return observations.map((observation) => ({
      ...observation,
      cpiAdjustmentFactor: 1,
    }))
  }
}
