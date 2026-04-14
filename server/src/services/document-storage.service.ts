import path from 'node:path'
import { getStorageBucket } from '../config/firebase.js'

type UploadDocumentFileInput = {
  serviceProviderUid: string
  storedName: string
  tempPath: string
  mimeType: string
}

function sanitizeStoredName(storedName: string): string {
  const normalized = storedName.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = normalized
    .split('/')
    .map((part) => path.posix.basename(part))
    .filter((part) => part.length > 0)
  if (parts.length === 0) {
    throw new Error('Invalid stored file name.')
  }
  return parts.join('/')
}

export function buildDocumentStorageObjectPath(
  serviceProviderUid: string,
  storedName: string,
): string {
  const safeStoredName = sanitizeStoredName(storedName)
  if (safeStoredName.includes('/')) {
    return safeStoredName
  }
  return `${serviceProviderUid}/${safeStoredName}`
}

export async function uploadTempDocumentFileToStorage(
  input: UploadDocumentFileInput,
): Promise<string> {
  const destinationPath = buildDocumentStorageObjectPath(
    input.serviceProviderUid,
    input.storedName,
  )
  const bucket = getStorageBucket()
  await bucket.upload(input.tempPath, {
    destination: destinationPath,
    metadata: {
      contentType: input.mimeType || 'application/octet-stream',
      cacheControl: 'private, max-age=0, no-transform',
    },
  })
  return destinationPath
}

export async function downloadDocumentBufferFromStorage(
  serviceProviderUid: string,
  storedName: string,
): Promise<Buffer> {
  const bucket = getStorageBucket()
  const objectPath = buildDocumentStorageObjectPath(serviceProviderUid, storedName)
  const [buffer] = await bucket.file(objectPath).download()
  return buffer
}

export async function deleteDocumentObjectIfExists(
  serviceProviderUid: string,
  storedName: string,
): Promise<void> {
  const bucket = getStorageBucket()
  const objectPath = buildDocumentStorageObjectPath(serviceProviderUid, storedName)
  try {
    await bucket.file(objectPath).delete()
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      Number((error as { code?: number }).code) === 404
    ) {
      return
    }
    throw error
  }
}
