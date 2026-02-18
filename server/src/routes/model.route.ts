import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { buildDynamicFormSchema } from '../services/dynamic-form-schema.service.js'
import { getServiceProviderByCode } from '../services/service-providers.service.js'
import { getTrainingDatasetStats } from '../services/training-dataset.service.js'

export const modelRouter = Router()

modelRouter.get('/model/dataset-stats', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const stats = await getTrainingDatasetStats(authReq.authUser.uid)
    res.status(200).json({
      ok: true,
      stats,
    })
  } catch (error) {
    next(error)
  }
})

modelRouter.get('/model/form-preview', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const schema = await buildDynamicFormSchema(authReq.authUser.uid)
    res.status(200).json({
      ok: true,
      schema,
    })
  } catch (error) {
    next(error)
  }
})

modelRouter.get('/model/form-preview/by-code/:serviceProviderCode', async (req, res, next) => {
  try {
    const rawCode = req.params.serviceProviderCode
    const serviceProviderCode = rawCode?.trim().toUpperCase()
    if (!serviceProviderCode) {
      res.status(400).json({
        ok: false,
        message: 'serviceProviderCode is required.',
      })
      return
    }

    const serviceProvider = await getServiceProviderByCode(serviceProviderCode)
    if (!serviceProvider) {
      res.status(404).json({
        ok: false,
        message: 'Service provider not found.',
      })
      return
    }

    const schema = await buildDynamicFormSchema(serviceProvider.uid)
    res.status(200).json({
      ok: true,
      schema,
      serviceProvider,
    })
  } catch (error) {
    next(error)
  }
})
