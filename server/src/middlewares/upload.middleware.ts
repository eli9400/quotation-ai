import { mkdirSync } from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { allowedFileExtensions, allowedMimeTypes, uploadLimits } from '../config/upload.js'

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

mkdirSync(env.uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadsDir),
  filename: (_req, file, callback) => {
    const timestamp = Date.now()
    const randomSuffix = Math.floor(Math.random() * 1_000_000)
    callback(null, `${timestamp}-${randomSuffix}-${sanitizeFileName(file.originalname)}`)
  },
})

const uploadFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase()
  const hasAllowedExtension = allowedFileExtensions.has(extension)
  const hasAllowedMimeType = !file.mimetype || allowedMimeTypes.has(file.mimetype)
  const isValid = hasAllowedExtension && hasAllowedMimeType
  if (!isValid) {
    callback(new Error('Only PDF, DOC, and DOCX files are allowed.'))
    return
  }
  callback(null, true)
}

export const documentsUpload = multer({
  storage,
  fileFilter: uploadFilter,
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
    files: uploadLimits.maxFiles,
  },
})
