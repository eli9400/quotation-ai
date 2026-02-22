import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import {
  isServiceProviderIndustry,
  listServiceProviderIndustryCategories,
} from '../services/service-provider-industries.service.js'
import {
  ensureServiceProviderProfile,
  getServiceProviderByCode,
  setServiceProviderIndustry,
} from '../services/service-providers.service.js'

export const serviceProvidersRouter = Router()

type UpdateServiceProviderBody = {
  industry?: unknown
}

serviceProvidersRouter.get('/service-providers/industries', (_req, res) => {
  res.status(200).json({
    ok: true,
    categories: listServiceProviderIndustryCategories(),
  })
})

serviceProvidersRouter.get(['/service-providers/me', '/contractors/me'], requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const serviceProvider = await ensureServiceProviderProfile(authReq.authUser)
    res.status(200).json({
      ok: true,
      serviceProvider,
      contractor: serviceProvider,
    })
  } catch (error) {
    next(error)
  }
})

serviceProvidersRouter.patch('/service-providers/me', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as UpdateServiceProviderBody
    if (!isServiceProviderIndustry(body.industry)) {
      res.status(400).json({ ok: false, message: 'industry is required and invalid.' })
      return
    }

    const updated = await setServiceProviderIndustry(authReq.authUser.uid, body.industry)
    if (!updated) {
      res.status(404).json({ ok: false, message: 'Service provider not found.' })
      return
    }

    res.status(200).json({ ok: true, serviceProvider: updated, contractor: updated })
  } catch (error) {
    next(error)
  }
})

serviceProvidersRouter.get(
  ['/service-providers/by-code/:serviceProviderCode', '/contractors/by-code/:contractorCode'],
  async (req, res, next) => {
    try {
      const rawCode =
        req.params.serviceProviderCode ??
        req.params.contractorCode
      const normalizedRawCode = Array.isArray(rawCode) ? rawCode[0] : rawCode
      const serviceProviderCode = normalizedRawCode?.trim().toUpperCase()

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

      res.status(200).json({
        ok: true,
        serviceProvider,
        contractor: serviceProvider,
      })
    } catch (error) {
      next(error)
    }
  },
)
