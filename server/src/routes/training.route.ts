import { Router } from 'express'
import { resolveTrainingDocumentIds } from '../services/documents.service.js'
import { createTrainingJob, getTrainingJob } from '../services/training-jobs.service.js'

type StartTrainingRequest = {
  documentIds?: unknown
}

function parseDocumentIds(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return normalized
}

export const trainingRouter = Router()

trainingRouter.post('/training/start', (req, res) => {
  const body = req.body as StartTrainingRequest
  const requestedDocumentIds = parseDocumentIds(body.documentIds)

  if (requestedDocumentIds === null) {
    res.status(400).json({
      ok: false,
      message: 'documentIds must be an array of strings.',
    })
    return
  }

  const selectedDocumentIds = resolveTrainingDocumentIds(requestedDocumentIds)

  if (selectedDocumentIds.length === 0) {
    res.status(400).json({
      ok: false,
      message: 'No valid documents available for training. Upload documents first.',
    })
    return
  }

  if (requestedDocumentIds.length > 0 && requestedDocumentIds.length !== selectedDocumentIds.length) {
    res.status(400).json({
      ok: false,
      message: 'Some documentIds are missing or invalid.',
    })
    return
  }

  const job = createTrainingJob(selectedDocumentIds)

  res.status(202).json({
    ok: true,
    message: 'Training job started.',
    job,
  })
})

trainingRouter.get('/training/:jobId', (req, res) => {
  const job = getTrainingJob(req.params.jobId)
  if (!job) {
    res.status(404).json({
      ok: false,
      message: 'Training job not found.',
    })
    return
  }

  res.status(200).json({
    ok: true,
    job,
  })
})
