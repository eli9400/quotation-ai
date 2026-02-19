import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import {
  findDuplicateDocumentsByHash,
  resolveTrainingDocumentIds,
} from '../services/documents.service.js'
import { runLearningTrainingJob } from '../services/training-learning.service.js'
import {
  createTrainingJob,
  getLatestCompletedTrainingJobByServiceProvider,
  getTrainingJob,
} from '../services/training-jobs.service.js'
import { listUploadedDocumentIdsInDataset } from '../services/training-dataset.service.js'

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

trainingRouter.post('/training/start', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as StartTrainingRequest
    const requestedDocumentIds = parseDocumentIds(body.documentIds)

    if (requestedDocumentIds === null) {
      res.status(400).json({
        ok: false,
        message: 'documentIds must be an array of strings.',
      })
      return
    }

    const selectedDocumentIds = await resolveTrainingDocumentIds(
      authReq.authUser.uid,
      requestedDocumentIds,
    )

    if (selectedDocumentIds.length === 0) {
      res.status(400).json({
        ok: false,
        message: 'No valid documents available for training. Upload documents first.',
      })
      return
    }

    if (
      requestedDocumentIds.length > 0 &&
      requestedDocumentIds.length !== selectedDocumentIds.length
    ) {
      res.status(400).json({
        ok: false,
        message: 'Some documentIds are missing or invalid.',
      })
      return
    }

    const [latestCompleted, trainedDocumentIdsFromDataset] = await Promise.all([
      getLatestCompletedTrainingJobByServiceProvider(authReq.authUser.uid),
      listUploadedDocumentIdsInDataset(authReq.authUser.uid),
    ])

    const baselineTrainedDocumentIds =
      trainedDocumentIdsFromDataset.length > 0
        ? trainedDocumentIdsFromDataset
        : latestCompleted?.documentIds ?? []
    const alreadyTrainedSet = new Set(baselineTrainedDocumentIds)
    const incrementalDocumentIds = selectedDocumentIds.filter((id) => !alreadyTrainedSet.has(id))
    if (incrementalDocumentIds.length === 0) {
      res.status(200).json({
        ok: true,
        message: 'No new documents to train. The model is already up to date.',
        job: latestCompleted,
      })
      return
    }

    const fullTrainedDocumentIds = Array.from(
      new Set([...baselineTrainedDocumentIds, ...selectedDocumentIds]),
    )

    const duplicateGroups = await findDuplicateDocumentsByHash(
      authReq.authUser.uid,
      incrementalDocumentIds,
    )
    if (duplicateGroups.length > 0) {
      res.status(409).json({
        ok: false,
        message:
          'Training blocked: duplicate files detected in the selected repository documents. Remove duplicates and try again.',
        duplicates: duplicateGroups,
      })
      return
    }

    const job = await createTrainingJob(authReq.authUser.uid, fullTrainedDocumentIds)
    void runLearningTrainingJob({
      jobId: job.id,
      serviceProviderUid: authReq.authUser.uid,
      documentIds: fullTrainedDocumentIds,
      processingDocumentIds: incrementalDocumentIds,
    })

    res.status(202).json({
      ok: true,
      message: `Training job started for ${incrementalDocumentIds.length} new documents.`,
      job,
    })
  } catch (error) {
    next(error)
  }
})

trainingRouter.get('/training/latest', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const job = await getLatestCompletedTrainingJobByServiceProvider(authReq.authUser.uid)
    res.status(200).json({
      ok: true,
      job,
    })
  } catch (error) {
    next(error)
  }
})

trainingRouter.get('/training/:jobId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId
    if (!jobId) {
      res.status(400).json({
        ok: false,
        message: 'jobId is required.',
      })
      return
    }

    const job = await getTrainingJob(jobId)
    if (!job || job.serviceProviderUid !== authReq.authUser.uid) {
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
  } catch (error) {
    next(error)
  }
})
