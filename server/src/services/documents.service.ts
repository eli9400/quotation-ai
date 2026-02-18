import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import { getFirestoreDb } from '../config/firebase.js'
import type { StoredDocument } from '../types/document.js'

const DOCUMENTS_COLLECTION = 'documents'

type RawStoredDocument = StoredDocument & {
  contractorUid?: string
}

function normalizeStoredDocument(
  docId: string,
  raw: RawStoredDocument,
): StoredDocument | null {
  const serviceProviderUid = raw.serviceProviderUid ?? raw.contractorUid
  if (!serviceProviderUid) {
    return null
  }

  return {
    id: raw.id || docId,
    serviceProviderUid,
    originalName: raw.originalName,
    storedName: raw.storedName,
    mimeType: raw.mimeType,
    size: raw.size,
    uploadedAt: raw.uploadedAt,
  }
}

export async function saveUploadedDocuments(
  serviceProviderUid: string,
  documents: Omit<StoredDocument, 'serviceProviderUid'>[],
): Promise<void> {
  if (documents.length === 0) {
    return
  }

  const db = getFirestoreDb()
  const batch = db.batch()

  documents.forEach((document) => {
    const stored: StoredDocument = {
      ...document,
      serviceProviderUid,
    }
    const ref = db.collection(DOCUMENTS_COLLECTION).doc(stored.id)
    batch.set(ref, stored, { merge: true })
  })

  await batch.commit()
}

async function listDocumentIdsByField(fieldName: string, uid: string): Promise<string[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(DOCUMENTS_COLLECTION)
    .where(fieldName, '==', uid)
    .get()
  return snapshot.docs.map((doc) => doc.id)
}

export async function listStoredDocumentIds(serviceProviderUid: string): Promise<string[]> {
  const [newFieldIds, legacyFieldIds] = await Promise.all([
    listDocumentIdsByField('serviceProviderUid', serviceProviderUid),
    listDocumentIdsByField('contractorUid', serviceProviderUid),
  ])
  return Array.from(new Set([...newFieldIds, ...legacyFieldIds]))
}

export async function resolveTrainingDocumentIds(
  serviceProviderUid: string,
  requestedIds?: string[],
): Promise<string[]> {
  const availableIds = await listStoredDocumentIds(serviceProviderUid)
  if (availableIds.length === 0) {
    return []
  }

  if (!requestedIds || requestedIds.length === 0) {
    return availableIds
  }

  const availableSet = new Set(availableIds)
  return requestedIds.filter((id) => availableSet.has(id))
}

export async function listStoredDocuments(
  serviceProviderUid: string,
): Promise<StoredDocument[]> {
  const availableIds = await listStoredDocumentIds(serviceProviderUid)
  return getStoredDocumentsByIds(serviceProviderUid, availableIds)
}

export async function getStoredDocumentsByIds(
  serviceProviderUid: string,
  documentIds: string[],
): Promise<StoredDocument[]> {
  const uniqueIds = Array.from(
    new Set(documentIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  )
  if (uniqueIds.length === 0) {
    return []
  }

  const db = getFirestoreDb()
  const snapshots = await Promise.all(
    uniqueIds.map((id) => db.collection(DOCUMENTS_COLLECTION).doc(id).get()),
  )

  return snapshots
    .map((snapshot) => {
      if (!snapshot.exists) {
        return null
      }

      const normalized = normalizeStoredDocument(
        snapshot.id,
        snapshot.data() as RawStoredDocument,
      )
      if (!normalized) {
        return null
      }

      if (normalized.serviceProviderUid !== serviceProviderUid) {
        return null
      }

      return normalized
    })
    .filter((item): item is StoredDocument => item !== null)
}

export async function getStoredDocumentById(
  serviceProviderUid: string,
  documentId: string,
): Promise<StoredDocument | null> {
  const documents = await getStoredDocumentsByIds(serviceProviderUid, [documentId])
  return documents[0] ?? null
}

async function removeStoredFile(storedName: string): Promise<void> {
  const safeFileName = path.basename(storedName)
  const filePath = path.join(env.uploadsDir, safeFileName)
  try {
    await unlink(filePath)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}

export async function deleteStoredDocument(
  serviceProviderUid: string,
  documentId: string,
): Promise<boolean> {
  const existing = await getStoredDocumentById(serviceProviderUid, documentId)
  if (!existing) {
    return false
  }

  await removeStoredFile(existing.storedName)
  const db = getFirestoreDb()
  await db.collection(DOCUMENTS_COLLECTION).doc(documentId).delete()
  return true
}
