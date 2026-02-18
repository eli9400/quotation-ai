import { Router } from 'express'
import { getTrainingJob } from '../services/training-jobs.service.js'
import { generateQuoteWithOpenAi } from '../services/openai-quote.service.js'
import { generateFallbackQuote } from '../services/quote-fallback.service.js'
import type {
  ProjectType,
  QuoteClientRequest,
  ScopeLevel,
  UrgencyLevel,
} from '../types/quote.js'

type GenerateQuoteRequestBody = {
  trainingJobId?: unknown
  clientRequest?: unknown
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

function parseClientRequest(value: unknown): QuoteClientRequest | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.clientName !== 'string' ||
    typeof candidate.requirements !== 'string' ||
    !isEnumValue(candidate.projectType, projectTypeValues) ||
    !isEnumValue(candidate.scope, scopeValues) ||
    !isEnumValue(candidate.urgency, urgencyValues)
  ) {
    return null
  }

  return {
    clientName: candidate.clientName.trim(),
    projectType: candidate.projectType,
    scope: candidate.scope,
    urgency: candidate.urgency,
    requirements: candidate.requirements.trim(),
  }
}

export const quotesRouter = Router()

quotesRouter.post('/quotes/generate', async (req, res, next) => {
  try {
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

    const job = getTrainingJob(body.trainingJobId)
    if (!job) {
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

    try {
      const quoteFromOpenAi = await generateQuoteWithOpenAi({
        request: clientRequest,
        documentCount: job.documentIds.length,
      })

      if (quoteFromOpenAi) {
        res.status(200).json({
          ok: true,
          source: 'openai',
          quote: quoteFromOpenAi,
        })
        return
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenAI provider error.'
      console.warn(`[quotes] OpenAI fallback activated: ${message}`)
    }

    const fallbackQuote = generateFallbackQuote({
      request: clientRequest,
      documentCount: job.documentIds.length,
    })

    res.status(200).json({
      ok: true,
      source: 'fallback',
      quote: fallbackQuote,
    })
  } catch (error) {
    next(error)
  }
})
