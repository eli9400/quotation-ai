import { Router } from 'express'
import { documentsUpload } from '../middlewares/upload.middleware.js'

type UploadedDocumentPayload = {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  uploadedAt: string
}

function mapUploadedFile(file: Express.Multer.File): UploadedDocumentPayload {
  return {
    id: file.filename,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype || 'unknown',
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

export const documentsRouter = Router()

documentsRouter.post(
  '/documents',
  documentsUpload.array('documents'),
  (req, res) => {
    const files = Array.isArray(req.files) ? req.files : []
    if (files.length === 0) {
      res.status(400).json({
        ok: false,
        message: 'No documents uploaded. Use form-data key: documents.',
      })
      return
    }

    res.status(201).json({
      ok: true,
      documents: files.map(mapUploadedFile),
    })
  },
)
