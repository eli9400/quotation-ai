import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import { isIgnoredDescription } from './pricing-parser-utils.service.js'
import type { LearnedPricingItem, NumericRange } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'

type LearnResult = {
  learnedItems: number
  processedObservations: number
}
const MAX_SAMPLES_PER_ITEM = 180

function nowIso(): string {
  return new Date().toISOString()
}

function toDocId(serviceProviderUid: string, key: string): string {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 18)
  return `${serviceProviderUid}_${hash}`
}

function buildKey(item: { canonicalName: string; unit: string }): string {
  return `${item.canonicalName}|${item.unit}`
}

function createRange(value: number): NumericRange {
  return { min: value, avg: value, max: value, sampleCount: 1 }
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function appendToRange(range: NumericRange, value: number): NumericRange {
  const nextCount = range.sampleCount + 1
  return {
    min: Math.min(range.min, value),
    avg: round4((range.avg * range.sampleCount + value) / nextCount),
    max: Math.max(range.max, value),
    sampleCount: nextCount,
  }
}

function mergeAliases(current: string[], nextRawName: string): string[] {
  const normalized = nextRawName.trim()
  if (!normalized) {
    return current
  }
  const merged = new Set([...current, normalized])
  return Array.from(merged).slice(0, 20)
}

function mergeSamples(
  current: Array<{ quantity: number; unitPrice: number }>,
  quantity: number,
  unitPrice: number,
): Array<{ quantity: number; unitPrice: number }> {
  const sample = {
    quantity: round2(quantity),
    unitPrice: round2(unitPrice),
  }
  const merged = [...current, sample]
  if (merged.length <= MAX_SAMPLES_PER_ITEM) {
    return merged
  }
  return merged.slice(merged.length - MAX_SAMPLES_PER_ITEM)
}

export function shouldKeepPricingObservation(observation: PricingObservation): boolean {
  if (isIgnoredDescription(observation.canonicalName) || isIgnoredDescription(observation.rawName)) {
    return false
  }
  if (
    observation.unit === 'unknown' &&
    observation.quantity <= 1.1 &&
    observation.pricePerUnit <= 1.1
  ) {
    return false
  }
  return true
}

function upsertItem(
  serviceProviderUid: string,
  existing: LearnedPricingItem | undefined,
  observation: PricingObservation,
): LearnedPricingItem {
  const timestamp = nowIso()
  if (!existing) {
    const key = buildKey(observation)
    return {
      id: toDocId(serviceProviderUid, key),
      serviceProviderUid,
      canonicalName: observation.canonicalName,
      aliases: [observation.rawName],
      unit: observation.unit,
      pricePerUnit: createRange(observation.pricePerUnit),
      quantity: createRange(observation.quantity),
      lineTotal: createRange(observation.lineTotal),
      quantityPriceSamples: [
        {
          quantity: round2(observation.quantity),
          unitPrice: round2(observation.pricePerUnit),
        },
      ],
      sampleLines: 1,
      lastUpdatedAt: timestamp,
    }
  }

  return {
    ...existing,
    aliases: mergeAliases(existing.aliases ?? [], observation.rawName),
    pricePerUnit: appendToRange(existing.pricePerUnit, observation.pricePerUnit),
    quantity: appendToRange(existing.quantity, observation.quantity),
    lineTotal: appendToRange(existing.lineTotal, observation.lineTotal),
    quantityPriceSamples: mergeSamples(
      existing.quantityPriceSamples ?? [],
      observation.quantity,
      observation.pricePerUnit,
    ),
    sampleLines: existing.sampleLines + 1,
    lastUpdatedAt: timestamp,
  }
}

async function listExistingPricingItems(
  serviceProviderUid: string,
): Promise<Map<string, LearnedPricingItem>> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  const items = snapshot.docs.map((doc) => doc.data() as LearnedPricingItem)
  return new Map(items.map((item) => [buildKey(item), item]))
}

async function persistItems(items: LearnedPricingItem[]): Promise<void> {
  if (items.length === 0) {
    return
  }

  const db = getFirestoreDb()
  const batch = db.batch()
  items.forEach((item) => {
    const ref = db.collection(PRICING_ITEMS_COLLECTION).doc(item.id)
    batch.set(ref, item, { merge: true })
  })
  await batch.commit()
}

export async function learnPricingItemsFromObservations(
  serviceProviderUid: string,
  observations: PricingObservation[],
): Promise<LearnResult> {
  const filtered = observations.filter(shouldKeepPricingObservation)
  if (filtered.length === 0) {
    return {
      learnedItems: 0,
      processedObservations: filtered.length,
    }
  }

  const existingByKey = await listExistingPricingItems(serviceProviderUid)
  const aggregated = new Map(existingByKey)

  filtered.forEach((observation) => {
    const key = buildKey(observation)
    const existing = aggregated.get(key)
    aggregated.set(key, upsertItem(serviceProviderUid, existing, observation))
  })

  await persistItems(Array.from(aggregated.values()))

  return {
    learnedItems: aggregated.size,
    processedObservations: filtered.length,
  }
}
