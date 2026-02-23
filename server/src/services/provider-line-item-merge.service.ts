import { getFirestoreDb } from '../config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import { rebuildPricingItemsFromDataset } from './pricing-items-dataset-sync.service.js'
import {
  listProviderLineItemDisplayOverridesMap,
  upsertProviderLineItemDisplayOverrides,
} from './provider-line-item-overrides.service.js'
import { listProviderLineItemOptions } from './provider-line-items.service.js'
import { refreshTrainingDatasetStatsForServiceProvider } from './training-dataset-maintenance.service.js'
import { TRAINING_DATASET_COLLECTION } from './training-dataset.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'

const BATCH_LIMIT = 400

type MergeProviderLineItemsInput = {
  serviceProviderUid: string
  sourceItemId: string
  targetItemId: string
}

export type MergeProviderLineItemsResult = {
  sourceItemId: string
  targetItemId: string
  updatedDatasetRows: number
  refreshedItemOptionsCount: number
  refreshedClientVisibleCount: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function toItemKey(item: Pick<LearnedPricingItem, 'canonicalName' | 'unit'>): string {
  return `${item.canonicalName}|${item.unit}`
}

async function getProviderPricingItem(
  serviceProviderUid: string,
  itemId: string,
): Promise<LearnedPricingItem | null> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(PRICING_ITEMS_COLLECTION).doc(itemId).get()
  if (!snapshot.exists) return null
  const item = snapshot.data() as LearnedPricingItem
  if (item.serviceProviderUid !== serviceProviderUid) return null
  return item
}

async function rewriteDatasetItemKey(
  serviceProviderUid: string,
  source: LearnedPricingItem,
  target: LearnedPricingItem,
): Promise<number> {
  const db = getFirestoreDb()
  const sourceItemKey = toItemKey(source)
  const targetItemKey = toItemKey(target)
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('itemKey', '==', sourceItemKey)
    .get()

  if (snapshot.empty) return 0

  const updatedAt = nowIso()
  let updated = 0
  for (let index = 0; index < snapshot.docs.length; index += BATCH_LIMIT) {
    const batch = db.batch()
    snapshot.docs.slice(index, index + BATCH_LIMIT).forEach((doc) => {
      batch.set(
        doc.ref,
        {
          itemKey: targetItemKey,
          itemName: target.canonicalName,
          unit: target.unit,
          updatedAt,
        },
        { merge: true },
      )
      updated += 1
    })
    await batch.commit()
  }

  return updated
}

async function syncOverridesAfterMerge(
  serviceProviderUid: string,
  sourceItemId: string,
  targetItemId: string,
): Promise<void> {
  const overrideMap = await listProviderLineItemDisplayOverridesMap(serviceProviderUid)
  const sourceOverride = overrideMap.get(sourceItemId)
  const targetOverride = overrideMap.get(targetItemId)
  if (!sourceOverride && !targetOverride) return

  const updates: Array<{
    sourceItemId: string
    customLabel: string | null
    visibleToClient: boolean
  }> = []

  if (sourceOverride) {
    updates.push({
      sourceItemId,
      customLabel: null,
      visibleToClient: true,
    })
  }

  if (!targetOverride && sourceOverride) {
    updates.push({
      sourceItemId: targetItemId,
      customLabel: sourceOverride.customLabel,
      visibleToClient: !sourceOverride.hiddenFromClient,
    })
  }

  if (updates.length === 0) return
  await upsertProviderLineItemDisplayOverrides(serviceProviderUid, updates)
}

export async function mergeProviderLineItems(
  input: MergeProviderLineItemsInput,
): Promise<MergeProviderLineItemsResult> {
  const sourceItemId = input.sourceItemId.trim()
  const targetItemId = input.targetItemId.trim()
  if (!sourceItemId || !targetItemId) {
    throw new Error('sourceItemId and targetItemId are required.')
  }
  if (sourceItemId === targetItemId) {
    throw new Error('sourceItemId and targetItemId must be different.')
  }

  const [sourceItem, targetItem] = await Promise.all([
    getProviderPricingItem(input.serviceProviderUid, sourceItemId),
    getProviderPricingItem(input.serviceProviderUid, targetItemId),
  ])
  if (!sourceItem) {
    throw new Error('Source line-item was not found in provider model.')
  }
  if (!targetItem) {
    throw new Error('Target line-item was not found in provider model.')
  }
  if (sourceItem.unit !== targetItem.unit) {
    throw new Error('Cannot merge items with different units.')
  }

  const updatedDatasetRows = await rewriteDatasetItemKey(
    input.serviceProviderUid,
    sourceItem,
    targetItem,
  )
  await syncOverridesAfterMerge(input.serviceProviderUid, sourceItemId, targetItemId)

  await refreshTrainingDatasetStatsForServiceProvider(input.serviceProviderUid)
  await rebuildPricingItemsFromDataset(input.serviceProviderUid)

  const options = await listProviderLineItemOptions(input.serviceProviderUid)
  const refreshedClientVisibleCount = options.filter(
    (option) => !option.isProviderOnly && option.visibleToClient,
  ).length

  return {
    sourceItemId,
    targetItemId,
    updatedDatasetRows,
    refreshedItemOptionsCount: options.length,
    refreshedClientVisibleCount,
  }
}
