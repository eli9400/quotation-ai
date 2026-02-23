import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'

const PROVIDER_LINE_ITEM_EXCLUSIONS_COLLECTION = 'provider_line_item_exclusions'

type ProviderLineItemExclusion = {
  id: string
  serviceProviderUid: string
  sourceItemId: string
  excludedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function buildExclusionId(serviceProviderUid: string, sourceItemId: string): string {
  const digest = createHash('sha1')
    .update(`${serviceProviderUid}|${sourceItemId}`)
    .digest('hex')
    .slice(0, 28)
  return `${serviceProviderUid}_${digest}`
}

export async function excludeProviderLineItem(
  serviceProviderUid: string,
  sourceItemId: string,
): Promise<void> {
  const db = getFirestoreDb()
  const exclusion: ProviderLineItemExclusion = {
    id: buildExclusionId(serviceProviderUid, sourceItemId),
    serviceProviderUid,
    sourceItemId,
    excludedAt: nowIso(),
  }
  await db
    .collection(PROVIDER_LINE_ITEM_EXCLUSIONS_COLLECTION)
    .doc(exclusion.id)
    .set(exclusion, { merge: true })
}

export async function listExcludedProviderLineItemIds(
  serviceProviderUid: string,
): Promise<Set<string>> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PROVIDER_LINE_ITEM_EXCLUSIONS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  const ids = new Set<string>()
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as Partial<ProviderLineItemExclusion>
    if (typeof data.sourceItemId === 'string' && data.sourceItemId.trim().length > 0) {
      ids.add(data.sourceItemId.trim())
    }
  })
  return ids
}

