import { readdirSync } from 'node:fs'
import { env } from '../config/env.js'

function readUploadFileNames(): string[] {
  try {
    return readdirSync(env.uploadsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export function listUploadedDocumentIds(): string[] {
  return readUploadFileNames()
}

export function resolveTrainingDocumentIds(requestedIds?: string[]): string[] {
  const availableIds = readUploadFileNames()
  if (availableIds.length === 0) {
    return []
  }

  if (!requestedIds || requestedIds.length === 0) {
    return availableIds
  }

  const allowedIds = new Set(availableIds)
  return requestedIds.filter((id) => allowedIds.has(id))
}
