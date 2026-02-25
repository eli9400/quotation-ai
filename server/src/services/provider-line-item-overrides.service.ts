import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'

export const SERVICE_PROVIDER_LINE_ITEM_OVERRIDES_COLLECTION = 'service_provider_line_item_overrides'

export type ProviderLineItemDisplayOverride = {
  id: string
  serviceProviderUid: string
  sourceItemId: string
  customLabel: string | null
  customCategoryId: string | null
  customCategoryLabel: string | null
  hiddenFromClient: boolean
  createdAt: string
  updatedAt: string
}

export type UpsertProviderLineItemDisplayOverrideInput = {
  sourceItemId: string
  customLabel: string | null
  customCategoryId?: string | null
  customCategoryLabel?: string | null
  visibleToClient: boolean
}

const BATCH_LIMIT = 400

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

function buildDocId(serviceProviderUid: string, sourceItemId: string): string {
  const digest = createHash('sha1')
    .update(`${serviceProviderUid}|${sourceItemId}`)
    .digest('hex')
    .slice(0, 24)
  return `${serviceProviderUid}_${digest}`
}

function toManualCategoryId(label: string): string {
  return `manual_${label.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48)}`
}

function normalizeInput(
  input: UpsertProviderLineItemDisplayOverrideInput,
): UpsertProviderLineItemDisplayOverrideInput | null {
  const sourceItemId = input.sourceItemId?.trim()
  if (!sourceItemId) return null
  const customCategoryLabel = normalizeLabel(input.customCategoryLabel)
  const customCategoryId = normalizeLabel(input.customCategoryId)
  return {
    sourceItemId,
    customLabel: normalizeLabel(input.customLabel),
    customCategoryId: customCategoryLabel ? customCategoryId || toManualCategoryId(customCategoryLabel) : null,
    customCategoryLabel,
    visibleToClient: input.visibleToClient,
  }
}

async function listProviderOverridesInternal(
  serviceProviderUid: string,
): Promise<ProviderLineItemDisplayOverride[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(SERVICE_PROVIDER_LINE_ITEM_OVERRIDES_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  return snapshot.docs
    .map((doc) => doc.data() as ProviderLineItemDisplayOverride)
    .sort((left, right) => left.sourceItemId.localeCompare(right.sourceItemId))
}

async function commitBatched(
  operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
): Promise<void> {
  const db = getFirestoreDb()
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = db.batch()
    operations.slice(index, index + BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

export async function listProviderLineItemDisplayOverrides(
  serviceProviderUid: string,
): Promise<ProviderLineItemDisplayOverride[]> {
  return listProviderOverridesInternal(serviceProviderUid)
}

export async function listProviderLineItemDisplayOverridesMap(
  serviceProviderUid: string,
): Promise<Map<string, ProviderLineItemDisplayOverride>> {
  const overrides = await listProviderOverridesInternal(serviceProviderUid)
  return new Map(overrides.map((override) => [override.sourceItemId, override]))
}

export async function upsertProviderLineItemDisplayOverrides(
  serviceProviderUid: string,
  inputs: UpsertProviderLineItemDisplayOverrideInput[],
): Promise<ProviderLineItemDisplayOverride[]> {
  const normalizedInputs = inputs
    .map(normalizeInput)
    .filter((input): input is UpsertProviderLineItemDisplayOverrideInput => input !== null)
  if (normalizedInputs.length === 0) {
    return listProviderOverridesInternal(serviceProviderUid)
  }

  const db = getFirestoreDb()
  const existing = await listProviderLineItemDisplayOverridesMap(serviceProviderUid)
  const timestamp = nowIso()
  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = []

  normalizedInputs.forEach((input) => {
    const existingOverride = existing.get(input.sourceItemId)
    const shouldDelete =
      !input.customLabel &&
      !input.customCategoryLabel &&
      input.visibleToClient
    const docId = existingOverride?.id ?? buildDocId(serviceProviderUid, input.sourceItemId)
    const ref = db.collection(SERVICE_PROVIDER_LINE_ITEM_OVERRIDES_COLLECTION).doc(docId)

    if (shouldDelete) {
      if (existingOverride) {
        operations.push((batch) => batch.delete(ref))
      }
      return
    }

    const next: ProviderLineItemDisplayOverride = {
      id: docId,
      serviceProviderUid,
      sourceItemId: input.sourceItemId,
      customLabel: input.customLabel,
      customCategoryId: input.customCategoryId ?? null,
      customCategoryLabel: input.customCategoryLabel ?? null,
      hiddenFromClient: !input.visibleToClient,
      createdAt: existingOverride?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    operations.push((batch) => batch.set(ref, next, { merge: true }))
  })

  if (operations.length > 0) {
    await commitBatched(operations)
  }
  return listProviderOverridesInternal(serviceProviderUid)
}
