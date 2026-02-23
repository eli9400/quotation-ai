import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import type { LearnedPricingItem, NumericRange, PricingUnit } from '../types/model-profile.js'

const SERVICE_PROVIDERS_COLLECTION = 'service_providers'
const FIRESTORE_IN_QUERY_LIMIT = 30
const MAX_ALIASES = 12
const MAX_SAMPLES = 180

type PricingItemSource = 'provider' | 'industry'

export type ProviderPricingItem = LearnedPricingItem & {
  sourceType: PricingItemSource
}

type AggregationBucket = {
  canonicalVotes: Map<string, number>
  aliases: Set<string>
  unit: PricingUnit
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
  pricePerUnitRanges: NumericRange[]
  quantityRanges: NumericRange[]
  lineTotalRanges: NumericRange[]
  lastUpdatedAt: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildItemKey(name: string, unit: PricingUnit): string {
  return `${normalizeText(name)}|${unit}`
}

function mergeRanges(ranges: NumericRange[]): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let weightedSum = 0
  let sampleCount = 0

  ranges.forEach((range) => {
    if (!Number.isFinite(range.avg) || !Number.isFinite(range.sampleCount)) return
    if (range.sampleCount <= 0) return
    sampleCount += range.sampleCount
    weightedSum += range.avg * range.sampleCount
    if (Number.isFinite(range.min)) min = Math.min(min, range.min)
    if (Number.isFinite(range.max)) max = Math.max(max, range.max)
  })

  if (sampleCount === 0) {
    return { min: 0, avg: 0, max: 0, sampleCount: 0 }
  }

  return {
    min: round2(min === Number.POSITIVE_INFINITY ? 0 : min),
    avg: round2(weightedSum / sampleCount),
    max: round2(max === Number.NEGATIVE_INFINITY ? 0 : max),
    sampleCount,
  }
}

function stableIndustryItemId(industry: string, itemKey: string): string {
  const digest = createHash('sha1').update(`${industry}|${itemKey}`).digest('hex').slice(0, 20)
  return `industry_${digest}`
}

function aggregateIndustryItems(
  industry: string,
  serviceProviderUid: string,
  sourceItems: LearnedPricingItem[],
): ProviderPricingItem[] {
  const grouped = new Map<string, AggregationBucket>()

  sourceItems.forEach((item) => {
    const bestName = item.aliases.find((alias) => alias.trim().length > 0) ?? item.canonicalName
    const key = buildItemKey(bestName, item.unit)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        canonicalVotes: new Map([[bestName.trim(), Math.max(1, item.sampleLines)]]),
        aliases: new Set(item.aliases.filter((alias) => alias.trim().length > 0)),
        unit: item.unit,
        sampleLines: item.sampleLines,
        quantityPriceSamples: item.quantityPriceSamples
          .filter((sample) => sample.quantity > 0 && sample.unitPrice > 0)
          .map((sample) => ({ quantity: round2(sample.quantity), unitPrice: round2(sample.unitPrice) })),
        pricePerUnitRanges: [item.pricePerUnit],
        quantityRanges: [item.quantity],
        lineTotalRanges: [item.lineTotal],
        lastUpdatedAt: item.lastUpdatedAt,
      })
      return
    }

    const voteWeight = Math.max(1, item.sampleLines)
    existing.canonicalVotes.set(bestName.trim(), (existing.canonicalVotes.get(bestName.trim()) ?? 0) + voteWeight)
    item.aliases.forEach((alias) => {
      const normalized = alias.trim()
      if (normalized) existing.aliases.add(normalized)
    })
    existing.sampleLines += item.sampleLines
    existing.quantityPriceSamples.push(
      ...item.quantityPriceSamples
        .filter((sample) => sample.quantity > 0 && sample.unitPrice > 0)
        .map((sample) => ({ quantity: round2(sample.quantity), unitPrice: round2(sample.unitPrice) })),
    )
    existing.pricePerUnitRanges.push(item.pricePerUnit)
    existing.quantityRanges.push(item.quantity)
    existing.lineTotalRanges.push(item.lineTotal)
    if (item.lastUpdatedAt.localeCompare(existing.lastUpdatedAt) > 0) {
      existing.lastUpdatedAt = item.lastUpdatedAt
    }
  })

  return Array.from(grouped.entries()).map(([itemKey, bucket]) => {
    const canonicalName =
      Array.from(bucket.canonicalVotes.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
      itemKey.split('|')[0]
    const sampleMap = new Map<string, { quantity: number; unitPrice: number }>()
    bucket.quantityPriceSamples.forEach((sample) => {
      const sampleKey = `${sample.quantity}|${sample.unitPrice}`
      if (!sampleMap.has(sampleKey)) sampleMap.set(sampleKey, sample)
    })

    return {
      id: stableIndustryItemId(industry, itemKey),
      serviceProviderUid,
      canonicalName,
      aliases: Array.from(bucket.aliases).slice(0, MAX_ALIASES),
      unit: bucket.unit,
      pricePerUnit: mergeRanges(bucket.pricePerUnitRanges),
      quantity: mergeRanges(bucket.quantityRanges),
      lineTotal: mergeRanges(bucket.lineTotalRanges),
      quantityPriceSamples: Array.from(sampleMap.values())
        .sort((left, right) => left.quantity - right.quantity)
        .slice(0, MAX_SAMPLES),
      sampleLines: bucket.sampleLines,
      lastUpdatedAt: bucket.lastUpdatedAt,
      sourceType: 'industry',
    }
  })
}

async function listProviderUidsByIndustry(industry: string, excludeUid: string): Promise<string[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(SERVICE_PROVIDERS_COLLECTION)
    .where('industry', '==', industry)
    .get()
  return snapshot.docs.map((doc) => doc.id).filter((uid) => uid !== excludeUid)
}

async function listLearnedPricingItemsByProviderUids(providerUids: string[]): Promise<LearnedPricingItem[]> {
  if (providerUids.length === 0) return []

  const db = getFirestoreDb()
  const results: LearnedPricingItem[] = []
  for (let index = 0; index < providerUids.length; index += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = providerUids.slice(index, index + FIRESTORE_IN_QUERY_LIMIT)
    const snapshot = await db
      .collection(PRICING_ITEMS_COLLECTION)
      .where('serviceProviderUid', 'in', chunk)
      .get()
    results.push(...snapshot.docs.map((doc) => doc.data() as LearnedPricingItem))
  }
  return results
}

export async function listProviderLearnedPricingItems(
  serviceProviderUid: string,
): Promise<ProviderPricingItem[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs.map((doc) => ({ ...(doc.data() as LearnedPricingItem), sourceType: 'provider' }))
}

export async function listIndustryBaselinePricingItems(
  serviceProviderUid: string,
  industry: string,
): Promise<ProviderPricingItem[]> {
  const normalizedIndustry = industry.trim()
  if (!normalizedIndustry) return []
  if (normalizedIndustry === 'general_service_provider') return []

  const peerUids = await listProviderUidsByIndustry(normalizedIndustry, serviceProviderUid)
  if (peerUids.length === 0) return []

  const peerItems = await listLearnedPricingItemsByProviderUids(peerUids)
  return aggregateIndustryItems(normalizedIndustry, serviceProviderUid, peerItems)
}

export async function listProviderPricingItemsWithIndustryBaseline(
  serviceProviderUid: string,
  industry: string,
): Promise<ProviderPricingItem[]> {
  const [providerItems, industryItems] = await Promise.all([
    listProviderLearnedPricingItems(serviceProviderUid),
    listIndustryBaselinePricingItems(serviceProviderUid, industry),
  ])
  return [...providerItems, ...industryItems]
}
