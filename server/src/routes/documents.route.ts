import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { documentsUpload } from '../middlewares/upload.middleware.js'
import { processUploadedDocuments } from '../services/document-upload.service.js'
import { extractTextFromDocuments } from '../services/document-text-extractor.service.js'
import { assessExtractedDocumentIntegrity } from '../services/document-integrity.service.js'
import {
  deleteStoredDocument,
  getStoredDocumentsByIds,
  listStoredDocuments,
  resolveTrainingDocumentIds,
} from '../services/documents.service.js'
import { normalizeOriginalFileName } from '../utils/file-name-normalizer.js'

type ExtractTextRequestBody = {
  documentIds?: unknown
}

function parseDocumentIds(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export const documentsRouter = Router()

documentsRouter.get('/documents', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const documents = await listStoredDocuments(authReq.authUser.uid)
    const responseDocuments = documents
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map((item) => ({
        id: item.id,
        originalName: normalizeOriginalFileName(item.originalName),
        storedName: item.storedName,
        mimeType: item.mimeType,
        size: item.size,
        uploadedAt: item.uploadedAt,
      }))

    res.status(200).json({
      ok: true,
      documents: responseDocuments,
    })
  } catch (error) {
    next(error)
  }
})

documentsRouter.post(
  '/documents',
  requireAuth,
  documentsUpload.array('documents'),
  async (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files : []
    if (files.length === 0) {
      res.status(400).json({
        ok: false,
        message: 'No documents uploaded. Use form-data key: documents.',
      })
      return
    }

    try {
      const authReq = req as AuthenticatedRequest
      const result = await processUploadedDocuments(authReq.authUser.uid, files)
      if (!result.hasNewDocuments) {
        res.status(200).json({
          ok: true,
          message: 'No new files were added. All uploaded files already exist.',
          documents: [],
          duplicates: result.duplicates,
        })
        return
      }

      res.status(201).json({
        ok: true,
        documents: result.documents,
        duplicates: result.duplicates,
      })
    } catch (error) {
      next(error)
    }
  },
)

documentsRouter.post('/documents/extract-text', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as ExtractTextRequestBody
    const requestedIds = parseDocumentIds(body.documentIds)

    if (requestedIds === null) {
      res.status(400).json({
        ok: false,
        message: 'documentIds must be an array of strings.',
      })
      return
    }

    if (requestedIds.length > 25) {
      res.status(400).json({
        ok: false,
        message: 'Maximum 25 documents per extraction request.',
      })
      return
    }

    const resolvedIds = await resolveTrainingDocumentIds(authReq.authUser.uid, requestedIds)
    if (requestedIds.length > 0 && resolvedIds.length !== requestedIds.length) {
      res.status(400).json({
        ok: false,
        message: 'Some documentIds are missing or not accessible.',
      })
      return
    }

    if (resolvedIds.length === 0) {
      res.status(400).json({
        ok: false,
        message: 'No accessible documents found for extraction.',
      })
      return
    }

    const storedDocuments = await getStoredDocumentsByIds(authReq.authUser.uid, resolvedIds)
    const extracted = await extractTextFromDocuments(storedDocuments)
    const integrityById = new Map(
      extracted.map((item) => [item.documentId, assessExtractedDocumentIntegrity(item)]),
    )
    const responseDocuments = extracted.map((item) => {
      const integrity = integrityById.get(item.documentId)
      return {
        id: item.documentId,
        originalName: normalizeOriginalFileName(item.originalName),
        format: item.detectedFormat,
        quoteDate: item.quoteDate,
        pricingContext: item.pricingContext,
        textChars: item.text.length,
        preview: item.text.slice(0, 260),
        validationStatus: integrity?.status ?? 'valid',
        validationReason: integrity?.reason ?? null,
        heuristicLineItems: integrity?.heuristicLineItems ?? 0,
        signalScore: integrity?.signalScore ?? 0,
      }
    })

    res.status(200).json({
      ok: true,
      documents: responseDocuments,
    })
  } catch (error) {
    next(error)
  }
})

documentsRouter.delete('/documents/:documentId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const documentId = Array.isArray(req.params.documentId)
      ? req.params.documentId[0]
      : req.params.documentId

    if (!documentId || documentId.trim().length === 0) {
      res.status(400).json({
        ok: false,
        message: 'documentId is required.',
      })
      return
    }

    const deleted = await deleteStoredDocument(authReq.authUser.uid, documentId.trim())
    if (!deleted) {
      res.status(404).json({
        ok: false,
        message: 'Document not found.',
      })
      return
    }

    res.status(200).json({
      ok: true,
      deletedId: documentId.trim(),
    })
  } catch (error) {
    next(error)
  }
})
