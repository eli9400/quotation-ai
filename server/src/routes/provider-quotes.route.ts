import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { buildQuoteFromLineItems } from '../services/quote-breakdown.service.js'
import {
  approveQuoteForServiceProvider,
  deleteQuoteForServiceProvider,
  updateQuoteForServiceProvider,
} from '../services/quotes.service.js'
import type { GeneratedQuote, QuoteLineItem } from '../types/quote.js'

type UpdateQuoteBody = {
  quote?: unknown
}

function parseParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? ''
  }
  return value?.trim() ?? ''
}

function parseLineItems(value: unknown): QuoteLineItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((raw) => {
      const item = raw as Partial<QuoteLineItem>
      if (typeof item.description !== 'string' || item.description.trim().length === 0) {
        return null
      }

      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)
      const normalizedUnit = typeof item.unit === 'string' ? item.unit.trim().toLowerCase() : ''
      const isPercentUnit =
        normalizedUnit === 'percent' || normalizedUnit === '%' || normalizedUnit === 'pct'
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        return null
      }
      if (!isPercentUnit && quantity < 0) {
        return null
      }

      return {
        id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : randomUUID(),
        sourceItemId: typeof item.sourceItemId === 'string' ? item.sourceItemId : null,
        description: item.description.trim(),
        unit: (item.unit as QuoteLineItem['unit']) ?? 'custom',
        quantity,
        unitPrice,
        lineTotal: 0,
      }
    })
    .filter((item): item is QuoteLineItem => item !== null)
}

function parseGeneratedQuote(value: unknown): GeneratedQuote | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const lineItems = parseLineItems(candidate.lineItems)
  if (lineItems.length === 0) {
    return null
  }

  const assumptions = Array.isArray(candidate.assumptions)
    ? candidate.assumptions.filter((item): item is string => typeof item === 'string')
    : []

  return buildQuoteFromLineItems({
    lineItems,
    customFields: candidate.customFields as GeneratedQuote['customFields'],
    pricingAdjustments: candidate.pricingAdjustments as GeneratedQuote['pricingAdjustments'],
    vatRate: Number(candidate.vatRate),
    estimatedDays: Number(candidate.estimatedDays),
    confidence: Number(candidate.confidence),
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    assumptions,
    generatedAt:
      typeof candidate.generatedAt === 'string' && candidate.generatedAt.trim().length > 0
        ? candidate.generatedAt
        : new Date().toISOString(),
  })
}

export const providerQuotesRouter = Router()

providerQuotesRouter.patch('/quotes/:quoteId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const quoteId = parseParamValue(req.params.quoteId)
    const body = req.body as UpdateQuoteBody
    const quote = parseGeneratedQuote(body.quote)

    if (!quoteId) {
      res.status(400).json({ ok: false, message: 'quoteId is required.' })
      return
    }
    if (!quote) {
      res.status(400).json({ ok: false, message: 'quote payload must include valid lineItems.' })
      return
    }

    const updated = await updateQuoteForServiceProvider(quoteId, authReq.authUser.uid, quote)
    if (!updated) {
      res.status(404).json({ ok: false, message: 'Quote not found.' })
      return
    }

    res.status(200).json({ ok: true, quoteRecord: updated })
  } catch (error) {
    next(error)
  }
})

providerQuotesRouter.post('/quotes/:quoteId/approve', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const quoteId = parseParamValue(req.params.quoteId)
    if (!quoteId) {
      res.status(400).json({ ok: false, message: 'quoteId is required.' })
      return
    }

    const approved = await approveQuoteForServiceProvider(quoteId, authReq.authUser.uid)
    if (!approved) {
      res.status(404).json({ ok: false, message: 'Quote not found.' })
      return
    }

    res.status(200).json({ ok: true, quoteRecord: approved })
  } catch (error) {
    next(error)
  }
})

providerQuotesRouter.delete('/quotes/:quoteId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const quoteId = parseParamValue(req.params.quoteId)
    if (!quoteId) {
      res.status(400).json({ ok: false, message: 'quoteId is required.' })
      return
    }

    const deleted = await deleteQuoteForServiceProvider(quoteId, authReq.authUser.uid)
    if (!deleted) {
      res.status(404).json({ ok: false, message: 'Quote not found.' })
      return
    }

    res.status(200).json({ ok: true, deletedId: quoteId })
  } catch (error) {
    next(error)
  }
})
