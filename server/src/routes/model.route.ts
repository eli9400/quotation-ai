import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { buildDynamicFormSchema } from '../services/dynamic-form-schema.service.js'
import {
  deleteServiceProviderFeature,
  listServiceProviderFeaturesWithSuggestions,
  upsertServiceProviderFeature,
} from '../services/service-provider-features.service.js'
import { getServiceProviderByCode } from '../services/service-providers.service.js'
import { getTrainingDatasetStats } from '../services/training-dataset.service.js'
import type { CustomFeatureValueType } from '../types/custom-feature.js'

type UpsertCustomFeatureBody = {
  key?: unknown
  label?: unknown
  valueType?: unknown
  defaultValue?: unknown
  showInQuoteDetails?: unknown
}

type ParsedCustomFeatureInput = {
  key: string
  label: string
  valueType: CustomFeatureValueType
  defaultValue: string | number | boolean | null
  showInQuoteDetails: boolean
}

const ALLOWED_VALUE_TYPES: CustomFeatureValueType[] = ['number', 'text', 'boolean']

function parseCustomFeatureInput(body: UpsertCustomFeatureBody): ParsedCustomFeatureInput | null {
  if (typeof body.key !== 'string' || body.key.trim().length < 2) {
    return null
  }

  const valueType = body.valueType
  if (typeof valueType !== 'string' || !ALLOWED_VALUE_TYPES.includes(valueType as CustomFeatureValueType)) {
    return null
  }

  const label = typeof body.label === 'string' ? body.label.trim() : body.key.trim()
  const showInQuoteDetails =
    typeof body.showInQuoteDetails === 'boolean' ? body.showInQuoteDetails : false
  const rawDefaultValue =
    body.defaultValue === undefined ? null : body.defaultValue
  const isDefaultValueValid =
    rawDefaultValue === null ||
    typeof rawDefaultValue === 'string' ||
    typeof rawDefaultValue === 'number' ||
    typeof rawDefaultValue === 'boolean'
  if (!isDefaultValueValid) {
    return null
  }

  return {
    key: body.key.trim(),
    label: label || body.key.trim(),
    valueType: valueType as CustomFeatureValueType,
    defaultValue: rawDefaultValue,
    showInQuoteDetails,
  }
}

function parseFeatureId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? ''
  }
  return value?.trim() ?? ''
}

export const modelRouter = Router()

modelRouter.get('/model/custom-features', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const features = await listServiceProviderFeaturesWithSuggestions(authReq.authUser.uid)
    res.status(200).json({
      ok: true,
      features,
    })
  } catch (error) {
    next(error)
  }
})

modelRouter.post('/model/custom-features', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as UpsertCustomFeatureBody
    const input = parseCustomFeatureInput(body)
    if (!input) {
      res.status(400).json({
        ok: false,
        message:
          'Invalid feature payload. Required: key, valueType(number|text|boolean).',
      })
      return
    }

    const feature = await upsertServiceProviderFeature(authReq.authUser.uid, input)
    res.status(201).json({
      ok: true,
      feature,
    })
  } catch (error) {
    next(error)
  }
})

modelRouter.patch('/model/custom-features/:featureId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const featureId = parseFeatureId(req.params.featureId)
    const body = req.body as UpsertCustomFeatureBody
    const input = parseCustomFeatureInput({
      ...body,
      key: body.key ?? featureId,
    })
    if (!input) {
      res.status(400).json({
        ok: false,
        message:
          'Invalid feature payload. Required: key, valueType(number|text|boolean).',
      })
      return
    }

    const feature = await upsertServiceProviderFeature(authReq.authUser.uid, input)
    res.status(200).json({
      ok: true,
      feature,
    })
  } catch (error) {
    next(error)
  }
})

modelRouter.delete('/model/custom-features/:featureId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const featureId = parseFeatureId(req.params.featureId)
    if (!featureId) {
      res.status(400).json({
        ok: false,
        message: 'featureId is required.',
      })
      return
    }

    const deleted = await deleteServiceProviderFeature(authReq.authUser.uid, featureId)
    if (!deleted) {
      res.status(404).json({
        ok: false,
        message: 'Feature not found.',
      })
      return
    }

    res.status(200).json({
      ok: true,
      deletedId: featureId,
    })
  } catch (error) {
    next(error)
  }
})

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
