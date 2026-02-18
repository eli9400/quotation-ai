import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { buildDynamicFormSchema } from '../services/dynamic-form-schema.service.js'
import { parsePublicClientRequestFromSchema } from '../services/public-client-request.service.js'
import { generateAndStoreQuote } from '../services/quote-generation.service.js'
import { listQuotesByServiceProvider } from '../services/quotes.service.js'
import { getServiceProviderByCode } from '../services/service-providers.service.js'
import {
  getLatestCompletedTrainingJobByServiceProvider,
  getTrainingJob,
} from '../services/training-jobs.service.js'
import type {
  ProjectType,
  QuoteClientRequest,
  QuoteRequestedItem,
  ScopeLevel,
  UrgencyLevel,
} from '../types/quote.js'

type GenerateQuoteRequestBody = {
  trainingJobId?: unknown
  clientRequest?: unknown
}

type PublicQuoteRequestBody = {
  serviceProviderCode?: unknown
  formValues?: unknown
}

const projectTypeValues: ProjectType[] = [
  'renovation',
  'consulting',
  'installation',
  'maintenance',
]
const scopeValues: ScopeLevel[] = ['small', 'medium', 'large']
const urgencyValues: UrgencyLevel[] = ['normal', 'fast', 'immediate']

function isEnumValue<T extends string>(value: unknown, accepted: readonly T[]): value is T {
  return typeof value === 'string' && accepted.includes(value as T)
}

function parseServiceProviderCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function parseRequestedItems(value: unknown): QuoteRequestedItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((raw) => {
      const item = raw as Partial<QuoteRequestedItem>
      const sourceItemId = typeof item.sourceItemId === 'string' ? item.sourceItemId.trim() : ''
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      const quantity = Number(item.quantity)
      if (!sourceItemId || !label || !Number.isFinite(quantity) || quantity <= 0) {
        return null
      }
      return {
        sourceItemId,
        label,
        quantity,
      }
    })
    .filter((item): item is QuoteRequestedItem => item !== null)
}

function parseClientRequest(value: unknown): QuoteClientRequest | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const clientEmail = typeof candidate.clientEmail === 'string' ? candidate.clientEmail.trim() : ''
  if (
    typeof candidate.clientName !== 'string' ||
    clientEmail.length === 0 ||
    !clientEmail.includes('@') ||
    typeof candidate.requirements !== 'string' ||
    !isEnumValue(candidate.projectType, projectTypeValues) ||
    !isEnumValue(candidate.scope, scopeValues) ||
    !isEnumValue(candidate.urgency, urgencyValues)
  ) {
    return null
  }

  return {
    clientName: candidate.clientName.trim(),
    clientEmail,
    projectType: candidate.projectType,
    scope: candidate.scope,
    urgency: candidate.urgency,
    requirements: candidate.requirements.trim(),
    requestedItems: parseRequestedItems(candidate.requestedItems),
  }
}

export const quotesRouter = Router()

quotesRouter.get('/quotes', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const quotes = await listQuotesByServiceProvider(authReq.authUser.uid)
    res.status(200).json({
      ok: true,
      quotes,
    })
  } catch (error) {
    next(error)
  }
})

quotesRouter.post('/quotes/generate', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as GenerateQuoteRequestBody
    if (typeof body.trainingJobId !== 'string' || body.trainingJobId.trim().length === 0) {
      res.status(400).json({
        ok: false,
        message: 'trainingJobId is required.',
      })
      return
    }

    const clientRequest = parseClientRequest(body.clientRequest)
    if (!clientRequest) {
      res.status(400).json({
        ok: false,
        message: 'clientRequest is invalid or missing required fields.',
      })
      return
    }

    const job = await getTrainingJob(body.trainingJobId)
    if (!job || job.serviceProviderUid !== authReq.authUser.uid) {
      res.status(404).json({
        ok: false,
        message: 'Training job not found.',
      })
      return
    }

    if (job.status !== 'completed') {
      res.status(409).json({
        ok: false,
        message: 'Training job is not completed yet.',
      })
      return
    }

    const result = await generateAndStoreQuote({
      serviceProviderUid: authReq.authUser.uid,
      trainingJobId: job.id,
      clientRequest,
    })

    res.status(200).json({
      ok: true,
      source: result.source,
      quote: result.savedQuote.quote,
      quoteId: result.savedQuote.id,
    })
  } catch (error) {
    next(error)
  }
})

quotesRouter.post('/public/quotes/request', async (req, res, next) => {
  try {
    const body = req.body as PublicQuoteRequestBody
    const serviceProviderCode = parseServiceProviderCode(body.serviceProviderCode)
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

    const latestJob = await getLatestCompletedTrainingJobByServiceProvider(serviceProvider.uid)
    if (!latestJob) {
      res.status(409).json({
        ok: false,
        message: 'No completed training model found for this service provider.',
      })
      return
    }

    const schema = await buildDynamicFormSchema(serviceProvider.uid)
    const parsed = parsePublicClientRequestFromSchema(schema, body.formValues)
    if (!parsed.request) {
      res.status(400).json({
        ok: false,
        message: parsed.message,
      })
      return
    }

    const result = await generateAndStoreQuote({
      serviceProviderUid: serviceProvider.uid,
      trainingJobId: latestJob.id,
      clientRequest: parsed.request,
    })

    res.status(201).json({
      ok: true,
      requestId: result.savedQuote.id,
      source: result.source,
      message: 'Client request was created and sent to the service provider dashboard.',
    })
  } catch (error) {
    next(error)
  }
})
