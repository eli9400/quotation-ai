import { getFirestoreDb } from '../config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import type { LearnedPricingItem, NumericRange, PricingUnit } from '../types/model-profile.js'
import {
  UNIT_PRIORITY,
  cleanPricingItemName,
  detectPricingUnitHint,
  isNoisePricingItemName,
  pricingCanonicalKey,
} from './pricing-items-normalization-utils.service.js'

const BATCH_LIMIT = 400
const MAX_ALIAS_COUNT = 40
const MAX_SAMPLE_COUNT = 160

type PricingItemDoc = LearnedPricingItem & { id: string }
type NormalizeResult = {
  before: number
  after: number
  removedDuplicates: number
  mergedGroups: number
  removedNoise: number
}

function resolveUnit(item: PricingItemDoc): PricingUnit {
  const hint = detectPricingUnitHint(`${item.canonicalName} ${(item.aliases ?? []).join(' ')}`)
  if (hint) return hint
  return item.unit
}

function isNoiseName(name: string): boolean {
  return isNoisePricingItemName(name)
}

function toRange(value: NumericRange): NumericRange {
  return {
    min: value.min,
    max: value.max,
    avg: value.avg,
    sampleCount: Math.max(0, value.sampleCount ?? 0),
  }
}

function mergeRange(a: NumericRange, b: NumericRange): NumericRange {
  const left = toRange(a)
  const right = toRange(b)
  const samples = left.sampleCount + right.sampleCount
  if (samples === 0) {
    return { min: 0, max: 0, avg: 0, sampleCount: 0 }
  }
  const avg = (left.avg * left.sampleCount + right.avg * right.sampleCount) / samples
  return {
    min: Math.min(left.min, right.min),
    max: Math.max(left.max, right.max),
    avg: Math.round(avg * 10_000) / 10_000,
    sampleCount: samples,
  }
}

function mergeAliases(items: PricingItemDoc[]): string[] {
  const set = new Set<string>()
  items.forEach((item) => {
    set.add(cleanPricingItemName(item.canonicalName, resolveUnit(item)))
    ;(item.aliases ?? []).forEach((alias) => {
      const cleaned = cleanPricingItemName(alias, resolveUnit(item))
      if (cleaned) set.add(cleaned)
    })
  })
  return Array.from(set).slice(0, MAX_ALIAS_COUNT)
}

function mergeSamples(items: PricingItemDoc[]): Array<{ quantity: number; unitPrice: number }> {
  const set = new Set<string>()
  const result: Array<{ quantity: number; unitPrice: number }> = []
  items.forEach((item) => {
    ;(item.quantityPriceSamples ?? []).forEach((sample) => {
      if (!Number.isFinite(sample.quantity) || !Number.isFinite(sample.unitPrice)) return
      if (sample.quantity <= 0 || sample.unitPrice <= 0) return
      const key = `${sample.quantity.toFixed(3)}|${sample.unitPrice.toFixed(3)}`
      if (set.has(key)) return
      set.add(key)
      result.push({
        quantity: Math.round(sample.quantity * 100) / 100,
        unitPrice: Math.round(sample.unitPrice * 100) / 100,
      })
    })
  })
  return result.slice(0, MAX_SAMPLE_COUNT)
}

function pickPrimary(items: PricingItemDoc[]): PricingItemDoc {
  return items.slice().sort((a, b) => {
    if (b.sampleLines !== a.sampleLines) return b.sampleLines - a.sampleLines
    return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)
  })[0]
}

function chooseGroupUnit(items: PricingItemDoc[]): PricingUnit {
  const fullText = items.map((item) => `${item.canonicalName} ${(item.aliases ?? []).join(' ')}`).join(' ')
  const hinted = detectPricingUnitHint(fullText)
  if (hinted) return hinted

  const counters = new Map<PricingUnit, number>()
  items.forEach((item) => {
    const current = counters.get(item.unit) ?? 0
    counters.set(item.unit, current + Math.max(1, item.sampleLines ?? 0))
  })

  return Array.from(counters.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1]
    return UNIT_PRIORITY[left[0]] - UNIT_PRIORITY[right[0]]
  })[0]?.[0] ?? 'unit'
}

function mergeGroup(items: PricingItemDoc[]): PricingItemDoc {
  const primary = pickPrimary(items)
  const unit = chooseGroupUnit(items)
  const canonicalName = cleanPricingItemName(primary.canonicalName, unit)
  return {
    ...primary,
    canonicalName,
    unit,
    aliases: mergeAliases(items),
    pricePerUnit: items.map((item) => item.pricePerUnit).reduce(mergeRange),
    quantity: items.map((item) => item.quantity).reduce(mergeRange),
    lineTotal: items.map((item) => item.lineTotal).reduce(mergeRange),
    quantityPriceSamples: mergeSamples(items),
    sampleLines: items.reduce((sum, item) => sum + Math.max(0, item.sampleLines ?? 0), 0),
    lastUpdatedAt: new Date().toISOString(),
  }
}

async function commitBatches(operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>): Promise<void> {
  const db = getFirestoreDb()
  for (let offset = 0; offset < operations.length; offset += BATCH_LIMIT) {
    const batch = db.batch()
    operations.slice(offset, offset + BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

export async function normalizePricingItemsForServiceProvider(
  serviceProviderUid: string,
): Promise<NormalizeResult> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  const items = snapshot.docs.map((doc) => {
    const data = doc.data() as LearnedPricingItem
    return { ...data, id: doc.id }
  })
  if (items.length === 0) {
    return { before: 0, after: 0, removedDuplicates: 0, mergedGroups: 0, removedNoise: 0 }
  }

  const byName = new Map<string, PricingItemDoc[]>()
  const noiseIds = new Set<string>()
  items.forEach((item) => {
    const unit = resolveUnit(item)
    const cleanedName = cleanPricingItemName(item.canonicalName, unit)
    if (isNoiseName(cleanedName)) {
      noiseIds.add(item.id)
      return
    }
    const key = pricingCanonicalKey(cleanedName)
    const current = byName.get(key) ?? []
    current.push({ ...item, canonicalName: cleanedName, unit })
    byName.set(key, current)
  })

  const mergedByItem = new Map<string, PricingItemDoc[]>()
  byName.forEach((group) => {
    const unit = chooseGroupUnit(group)
    const key = `${pricingCanonicalKey(group[0].canonicalName)}|${unit}`
    const current = mergedByItem.get(key) ?? []
    group.forEach((item) => current.push({ ...item, unit }))
    mergedByItem.set(key, current)
  })

  const mergedItems = Array.from(mergedByItem.values()).map(mergeGroup)
  const keptIds = new Set(mergedItems.map((item) => item.id))
  const duplicateIds = items.map((item) => item.id).filter((id) => !keptIds.has(id) && !noiseIds.has(id))
  const deleteIds = new Set([...duplicateIds, ...noiseIds])
  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = []

  mergedItems.forEach((item) => {
    operations.push((batch) => {
      const ref = db.collection(PRICING_ITEMS_COLLECTION).doc(item.id)
      batch.set(ref, item)
    })
  })
  deleteIds.forEach((id) => {
    operations.push((batch) => {
      const ref = db.collection(PRICING_ITEMS_COLLECTION).doc(id)
      batch.delete(ref)
    })
  })
  await commitBatches(operations)

  return {
    before: items.length,
    after: mergedItems.length,
    removedDuplicates: duplicateIds.length,
    mergedGroups: Array.from(mergedByItem.values()).filter((group) => group.length > 1).length,
    removedNoise: noiseIds.size,
  }
}
