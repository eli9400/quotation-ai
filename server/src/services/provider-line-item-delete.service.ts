import { getFirestoreDb } from '../config/firebase.js'
import { PRICING_ITEMS_COLLECTION } from './model-profile.service.js'
import { rebuildPricingItemsFromDataset } from './pricing-items-dataset-sync.service.js'
import { excludeProviderLineItem } from './provider-line-item-exclusions.service.js'
import { upsertProviderLineItemDisplayOverrides } from './provider-line-item-overrides.service.js'
import { listProviderLineItemOptions } from './provider-line-items.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import { refreshTrainingDatasetStatsForServiceProvider } from './training-dataset-maintenance.service.js'
import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'
import { TRAINING_DATASET_COLLECTION } from './training-dataset.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'

const BATCH_LIMIT = 400

export type DeleteProviderLineItemResult = {
  sourceItemId: string
  deletedDatasetRows: number
  refreshedItemOptionsCount: number
  refreshedClientVisibleCount: number
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳´׳³]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getProviderPricingItem(
  serviceProviderUid: string,
  sourceItemId: string,
): Promise<LearnedPricingItem | null> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(PRICING_ITEMS_COLLECTION).doc(sourceItemId).get()
  if (!snapshot.exists) return null
  const item = snapshot.data() as LearnedPricingItem
  if (item.serviceProviderUid !== serviceProviderUid) return null
  return item
}

async function deleteTrainingRowsForItem(
  serviceProviderUid: string,
  canonical: { itemKey: string; itemName: string; unit: string },
): Promise<number> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  const canonicalName = normalizeName(canonical.itemName)
  const docsToDelete = snapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>
    const rowItemKey = typeof data.itemKey === 'string' ? data.itemKey : ''
    if (rowItemKey === canonical.itemKey) return true
    const rowUnit = typeof data.unit === 'string' ? data.unit : ''
    if (rowUnit !== canonical.unit) return false
    const rowName = typeof data.itemName === 'string' ? data.itemName : ''
    return normalizeName(rowName) === canonicalName
  })

  let deleted = 0
  for (let index = 0; index < docsToDelete.length; index += BATCH_LIMIT) {
    const batch = db.batch()
    docsToDelete.slice(index, index + BATCH_LIMIT).forEach((doc) => {
      batch.delete(doc.ref)
      deleted += 1
    })
    await batch.commit()
  }

  return deleted
}

export async function deleteProviderLineItem(
  serviceProviderUid: string,
  sourceItemId: string,
): Promise<DeleteProviderLineItemResult> {
  const itemId = sourceItemId.trim()
  if (!itemId) throw new Error('sourceItemId is required.')

  const existingItems = await listProviderLineItemOptions(serviceProviderUid)
  const requestedItem = existingItems.find((item) => item.id === itemId)
  if (!requestedItem) {
    throw new Error('Line-item was not found in provider model.')
  }

  const item = await getProviderPricingItem(serviceProviderUid, itemId)
  if (!item) {
    await excludeProviderLineItem(serviceProviderUid, itemId)
    const refreshed = await listProviderLineItemOptions(serviceProviderUid)
    return {
      sourceItemId: itemId,
      deletedDatasetRows: 0,
      refreshedItemOptionsCount: refreshed.length,
      refreshedClientVisibleCount: refreshed.filter((option) => !option.isProviderOnly && option.visibleToClient).length,
    }
  }

  const serviceProvider = await getServiceProviderByUid(serviceProviderUid)
  const canonical = canonicalizeTrainingItemForIndustry(
    item.canonicalName,
    item.unit,
    serviceProvider?.industry ?? null,
  )

  const deletedDatasetRows = await deleteTrainingRowsForItem(serviceProviderUid, canonical)
  const db = getFirestoreDb()
  await db.collection(PRICING_ITEMS_COLLECTION).doc(itemId).delete()

  await upsertProviderLineItemDisplayOverrides(serviceProviderUid, [
    { sourceItemId: itemId, customLabel: null, visibleToClient: true },
  ])

  await refreshTrainingDatasetStatsForServiceProvider(serviceProviderUid)
  await rebuildPricingItemsFromDataset(serviceProviderUid)

  const options = await listProviderLineItemOptions(serviceProviderUid)
  return {
    sourceItemId: itemId,
    deletedDatasetRows,
    refreshedItemOptionsCount: options.length,
    refreshedClientVisibleCount: options.filter((option) => !option.isProviderOnly && option.visibleToClient).length,
  }
}
