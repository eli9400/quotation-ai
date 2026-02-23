import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import {
  parseClientEmail,
  parseClientRequest,
  parseQuoteForClientRevision,
  parseServiceProviderCode,
} from './quotes.route.parsers.js'
import { buildDynamicFormSchema } from '../services/dynamic-form-schema.service.js'
import { parsePublicClientRequestFromSchema } from '../services/public-client-request.service.js'
import { generateAndStoreQuote } from '../services/quote-generation.service.js'
import { applyClientRevisionToQuote, listQuotesByClient } from '../services/client-quotes.service.js'
import { listProviderLineItemOptions } from '../services/provider-line-items.service.js'
import { listQuotesByServiceProvider } from '../services/quotes.service.js'
import { getServiceProviderByCode } from '../services/service-providers.service.js'
import {
  getLatestCompletedTrainingJobByServiceProvider,
  getTrainingJob,
} from '../services/training-jobs.service.js'

type GenerateQuoteRequestBody = {
  trainingJobId?: unknown
  clientRequest?: unknown
}

type PublicQuoteRequestBody = {
  serviceProviderCode?: unknown
  formValues?: unknown
  extraRequestedItems?: unknown
}

type PublicClientRevisionBody = {
  serviceProviderCode?: unknown
  clientEmail?: unknown
  quote?: unknown
}

function parseParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? ''
  return value?.trim() ?? ''
}

export const quotesRouter = Router()

quotesRouter.get('/quotes', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const quotes = await listQuotesByServiceProvider(authReq.authUser.uid)
    res.status(200).json({ ok: true, quotes })
  } catch (error) {
    next(error)
  }
})

quotesRouter.post('/quotes/generate', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as GenerateQuoteRequestBody
    if (typeof body.trainingJobId !== 'string' || body.trainingJobId.trim().length === 0) {
      res.status(400).json({ ok: false, message: 'trainingJobId is required.' })
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
      res.status(404).json({ ok: false, message: 'Training job not found.' })
      return
    }
    if (job.status !== 'completed') {
      res.status(409).json({ ok: false, message: 'Training job is not completed yet.' })
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
      res.status(400).json({ ok: false, message: 'serviceProviderCode is required.' })
      return
    }

    const serviceProvider = await getServiceProviderByCode(serviceProviderCode)
    if (!serviceProvider) {
      res.status(404).json({ ok: false, message: 'Service provider not found.' })
      return
    }

    const latestJob = await getLatestCompletedTrainingJobByServiceProvider(serviceProvider.uid)

    const schema = await buildDynamicFormSchema(serviceProvider.uid)
    const parsed = parsePublicClientRequestFromSchema(
      schema,
      body.formValues,
      body.extraRequestedItems,
    )
    if (!parsed.request) {
      res.status(400).json({ ok: false, message: parsed.message })
      return
    }

    const result = await generateAndStoreQuote({
      serviceProviderUid: serviceProvider.uid,
      trainingJobId: latestJob?.id ?? '',
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

quotesRouter.get('/public/provider-line-items/by-code/:serviceProviderCode', async (req, res, next) => {
  try {
    const serviceProviderCode = parseServiceProviderCode(req.params.serviceProviderCode)
    if (!serviceProviderCode) {
      res.status(400).json({ ok: false, message: 'serviceProviderCode is required.' })
      return
    }

    const serviceProvider = await getServiceProviderByCode(serviceProviderCode)
    if (!serviceProvider) {
      res.status(404).json({ ok: false, message: 'Service provider not found.' })
      return
    }

    const items = await listProviderLineItemOptions(serviceProvider.uid)
    const clientItems = items
      .filter((item) => !item.isProviderOnly && item.visibleToClient)
      .map((item) => ({
        sourceItemId: item.id,
        label: item.clientLabel || item.canonicalName || item.label,
        unit: item.unit,
        categoryId: item.categoryId,
        categoryLabel: item.categoryLabel,
      }))

    res.status(200).json({ ok: true, items: clientItems })
  } catch (error) {
    next(error)
  }
})

quotesRouter.get('/public/quotes/by-client', async (req, res, next) => {
  try {
    const serviceProviderCode = parseServiceProviderCode(req.query.serviceProviderCode)
    const clientEmail = parseClientEmail(req.query.clientEmail)
    if (!serviceProviderCode || !clientEmail) {
      res.status(400).json({
        ok: false,
        message: 'serviceProviderCode and clientEmail are required.',
      })
      return
    }

    const serviceProvider = await getServiceProviderByCode(serviceProviderCode)
    if (!serviceProvider) {
      res.status(404).json({ ok: false, message: 'Service provider not found.' })
      return
    }

    const quotes = await listQuotesByClient(serviceProvider.uid, clientEmail)
    res.status(200).json({ ok: true, quotes })
  } catch (error) {
    next(error)
  }
})

quotesRouter.post('/public/quotes/:quoteId/client-approve', async (req, res, next) => {
  try {
    const quoteId = parseParamValue(req.params.quoteId)
    const body = req.body as PublicClientRevisionBody
    const serviceProviderCode = parseServiceProviderCode(body.serviceProviderCode)
    const clientEmail = parseClientEmail(body.clientEmail)
    const quote = parseQuoteForClientRevision(body.quote)

    if (!quoteId || !serviceProviderCode || !clientEmail || !quote) {
      res.status(400).json({
        ok: false,
        message: 'quoteId, serviceProviderCode, clientEmail and quote are required.',
      })
      return
    }

    const serviceProvider = await getServiceProviderByCode(serviceProviderCode)
    if (!serviceProvider) {
      res.status(404).json({ ok: false, message: 'Service provider not found.' })
      return
    }

    const updated = await applyClientRevisionToQuote({
      quoteId,
      serviceProviderUid: serviceProvider.uid,
      clientEmail,
      quote,
    })
    if (!updated) {
      res.status(409).json({
        ok: false,
        message: 'Quote cannot be updated by client in the current status.',
      })
      return
    }

    res.status(200).json({ ok: true, quoteRecord: updated })
  } catch (error) {
    next(error)
  }
})
