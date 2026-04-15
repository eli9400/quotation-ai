import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { getLatestActiveModelV1Artifact, rollbackToPreviousModelV1Artifact } from '../services/model-artifacts.service.js'
import { listActiveModelAlerts } from '../services/model-alerts.service.js'
import { getModelPredictionMetrics } from '../services/model-performance-tracking.service.js'
import {
  getActiveModelV1CanaryRollout,
  promoteActiveModelV1CanaryRollout,
  rollbackActiveModelV1CanaryRollout,
} from '../services/model-rollout.service.js'
import { trainAndPersistModelV1 } from '../services/model-v1-training.service.js'

type TrainModelBody = {
  mode?: unknown
  canaryTrafficPercent?: unknown
}

type RollbackBody = {
  reason?: unknown
}

export const modelRolloutRouter = Router()

modelRolloutRouter.get('/model/monitoring', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const [metrics, alerts, rollout, activeArtifact] = await Promise.all([
      getModelPredictionMetrics(authReq.authUser.uid),
      listActiveModelAlerts(authReq.authUser.uid),
      getActiveModelV1CanaryRollout(authReq.authUser.uid),
      getLatestActiveModelV1Artifact(authReq.authUser.uid),
    ])
    res.status(200).json({
      ok: true,
      monitoring: {
        metrics,
        alerts,
        rollout,
        activeArtifactId: activeArtifact?.id ?? null,
      },
    })
  } catch (error) {
    next(error)
  }
})

modelRolloutRouter.get('/model/rollout', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const rollout = await getActiveModelV1CanaryRollout(authReq.authUser.uid)
    res.status(200).json({ ok: true, rollout })
  } catch (error) {
    next(error)
  }
})

modelRolloutRouter.post('/model/train-v1', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = (req.body ?? {}) as TrainModelBody
    const mode = body.mode === 'canary' ? 'canary' : 'activate'
    const canaryTrafficPercent =
      typeof body.canaryTrafficPercent === 'number' && Number.isFinite(body.canaryTrafficPercent)
        ? body.canaryTrafficPercent
        : undefined
    const result = await trainAndPersistModelV1(authReq.authUser.uid, {
      rolloutMode: mode,
      canaryTrafficPercent,
    })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    next(error)
  }
})

modelRolloutRouter.post('/model/rollout/promote', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const rollout = await promoteActiveModelV1CanaryRollout(authReq.authUser.uid)
    if (!rollout) {
      res.status(404).json({ ok: false, message: 'No active canary rollout found.' })
      return
    }
    res.status(200).json({ ok: true, rollout })
  } catch (error) {
    next(error)
  }
})

modelRolloutRouter.post('/model/rollout/rollback', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = (req.body ?? {}) as RollbackBody
    const reason = typeof body.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim()
      : 'Manual rollback requested.'
    const rollout = await rollbackActiveModelV1CanaryRollout(authReq.authUser.uid, reason)
    if (!rollout) {
      res.status(404).json({ ok: false, message: 'No active canary rollout found.' })
      return
    }
    res.status(200).json({ ok: true, rollout })
  } catch (error) {
    next(error)
  }
})

modelRolloutRouter.post('/model/rollback-previous', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const artifact = await rollbackToPreviousModelV1Artifact(authReq.authUser.uid)
    if (!artifact) {
      res.status(404).json({
        ok: false,
        message: 'No previous model artifact available for rollback.',
      })
      return
    }
    res.status(200).json({ ok: true, artifact })
  } catch (error) {
    next(error)
  }
})
