import { calculateFileHashFromPath, deleteFileIfExists } from './document-hash.service.js'
import {
  deleteDocumentObjectIfExists,
  uploadTempDocumentFileToStorage,
} from './document-storage.service.js'
import { listStoredDocuments, saveUploadedDocuments } from './documents.service.js'
import type { StoredDocument } from '../types/document.js'
import { normalizeOriginalFileName } from '../utils/file-name-normalizer.js'

type UploadedDocumentCandidate = Omit<StoredDocument, 'serviceProviderUid'>

type UploadedFileWithMetadata = {
  document: UploadedDocumentCandidate
  tempPath: string
}

export type UploadDocumentsResult = {
  documents: UploadedDocumentCandidate[]
  duplicates: Array<{
    originalName: string
    duplicatedWithDocumentId: string
  }>
  hasNewDocuments: boolean
}

async function mapUploadedFile(file: Express.Multer.File): Promise<UploadedFileWithMetadata> {
  const fileHash = await calculateFileHashFromPath(file.path)
  const originalName = normalizeOriginalFileName(file.originalname)
  return {
    document: {
      id: file.filename,
      originalName,
      storedName: file.filename,
      mimeType: file.mimetype || 'unknown',
      size: file.size,
      fileHash,
      uploadedAt: new Date().toISOString(),
    },
    tempPath: file.path,
  }
}

async function cleanupTempFiles(files: UploadedFileWithMetadata[]): Promise<void> {
  await Promise.all(files.map((file) => deleteFileIfExists(file.tempPath)))
}

async function uploadAcceptedFiles(
  serviceProviderUid: string,
  files: UploadedFileWithMetadata[],
): Promise<void> {
  const uploadedStoredNames: string[] = []
  try {
    for (const candidate of files) {
      await uploadTempDocumentFileToStorage({
        serviceProviderUid,
        storedName: candidate.document.storedName,
        tempPath: candidate.tempPath,
        mimeType: candidate.document.mimeType,
      })
      uploadedStoredNames.push(candidate.document.storedName)
    }
  } catch (error) {
    await Promise.all(
      uploadedStoredNames.map((storedName) =>
        deleteDocumentObjectIfExists(serviceProviderUid, storedName),
      ),
    )
    throw error
  }
}

export async function processUploadedDocuments(
  serviceProviderUid: string,
  files: Express.Multer.File[],
): Promise<UploadDocumentsResult> {
  const existingDocuments = await listStoredDocuments(serviceProviderUid)
  const existingByHash = new Map(
    existingDocuments
      .filter((document) => document.fileHash.trim().length > 0)
      .map((document) => [document.fileHash, document]),
  )

  const mappedFiles = await Promise.all(files.map((file) => mapUploadedFile(file)))
  const acceptedDocuments: UploadedDocumentCandidate[] = []
  const acceptedFiles: UploadedFileWithMetadata[] = []
  const duplicates: Array<{
    originalName: string
    duplicatedWithDocumentId: string
  }> = []

  for (const candidate of mappedFiles) {
    const existing = existingByHash.get(candidate.document.fileHash)
    if (existing) {
      duplicates.push({
        originalName: candidate.document.originalName,
        duplicatedWithDocumentId: existing.id,
      })
      continue
    }

    acceptedDocuments.push(candidate.document)
    acceptedFiles.push(candidate)
    existingByHash.set(candidate.document.fileHash, {
      ...candidate.document,
      serviceProviderUid,
    })
  }

  try {
    if (acceptedDocuments.length > 0) {
      await uploadAcceptedFiles(serviceProviderUid, acceptedFiles)
      await saveUploadedDocuments(serviceProviderUid, acceptedDocuments)
    }
  } finally {
    await cleanupTempFiles(mappedFiles)
  }

  return {
    documents: acceptedDocuments,
    duplicates,
    hasNewDocuments: acceptedDocuments.length > 0,
  }
}
