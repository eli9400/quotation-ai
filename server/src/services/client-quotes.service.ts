import { getFirestoreDb } from '../config/firebase.js'
import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { autofillQuoteLinePricesFromTraining } from './provider-quote-autofill.service.js'
import { getQuoteById, listQuotesByServiceProvider } from './quotes.service.js'
import type { GeneratedQuote, QuoteLineItem, StoredQuote } from '../types/quote.js'

const QUOTES_COLLECTION = 'quotes'

type ApplyClientRevisionInput = {
  quoteId: string
  serviceProviderUid: string
  clientEmail: string
  quote: GeneratedQuote
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isPercentUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase()
  return normalized === 'percent' || normalized === '%' || normalized === 'pct'
}

function quoteRef(quoteId: string) {
  const db = getFirestoreDb()
  return db.collection(QUOTES_COLLECTION).doc(quoteId)
}

function normalizeClientRevisionLineItems(
  existingQuote: GeneratedQuote,
  nextQuote: GeneratedQuote,
): QuoteLineItem[] {
  const byId = new Map(existingQuote.lineItems.map((line) => [line.id, line]))
  return nextQuote.lineItems
    .map((line) => {
      const quantity = Number(line.quantity)
      if (!Number.isFinite(quantity)) {
        return null
      }
      if (!isPercentUnit(line.unit) && quantity <= 0) {
        return null
      }

      const existingLine = byId.get(line.id)
      if (existingLine) {
        return {
          ...line,
          quantity,
          unitPrice: existingLine.unitPrice,
          sourceItemId: line.sourceItemId ?? existingLine.sourceItemId,
          description: line.description.trim() || existingLine.description,
          unit: ((line.unit.trim() || existingLine.unit) as QuoteLineItem['unit']),
          lineTotal: 0,
        } satisfies QuoteLineItem
      }

      return {
        ...line,
        quantity,
        unitPrice: isPercentUnit(line.unit) ? Number(line.unitPrice) || 0 : 0,
        sourceItemId: line.sourceItemId ?? null,
        lineTotal: 0,
      } satisfies QuoteLineItem
    })
    .filter((line): line is QuoteLineItem => line !== null)
}

export async function listQuotesByClient(
  serviceProviderUid: string,
  clientEmail: string,
): Promise<StoredQuote[]> {
  const normalizedEmail = normalizeEmail(clientEmail)
  if (!normalizedEmail) {
    return []
  }

  const quotes = await listQuotesByServiceProvider(serviceProviderUid)
  return quotes.filter(
    (quote) => normalizeEmail(quote.clientRequest.clientEmail) === normalizedEmail,
  )
}

export async function applyClientRevisionToQuote(
  input: ApplyClientRevisionInput,
): Promise<StoredQuote | null> {
  const existing = await getQuoteById(input.quoteId)
  if (!existing) {
    return null
  }
  if (existing.serviceProviderUid !== input.serviceProviderUid) {
    return null
  }
  if (normalizeEmail(existing.clientRequest.clientEmail) !== normalizeEmail(input.clientEmail)) {
    return null
  }
  if (existing.status !== 'approved') {
    return null
  }

  const lineItems = normalizeClientRevisionLineItems(existing.quote, input.quote)
  if (lineItems.length === 0) {
    return null
  }

  const rebuiltQuote = buildQuoteFromLineItems({
    lineItems,
    customFields: existing.quote.customFields,
    pricingAdjustments: existing.quote.pricingAdjustments,
    vatRate: existing.quote.vatRate,
    estimatedDays: existing.quote.estimatedDays,
    confidence: existing.quote.confidence,
    summary: existing.quote.summary,
    assumptions: existing.quote.assumptions,
    generatedAt: nowIso(),
  })

  const quoteWithAutofill = await autofillQuoteLinePricesFromTraining(
    input.serviceProviderUid,
    rebuiltQuote,
  )

  const updatedAt = nowIso()
  await quoteRef(input.quoteId).set(
    {
      quote: quoteWithAutofill,
      status: 'draft',
      updatedAt,
      approvedAt: null,
      completedAt: null,
      approvedByServiceProviderUid: null,
      clientRevisionPending: true,
    },
    { merge: true },
  )

  return {
    ...existing,
    quote: quoteWithAutofill,
    status: 'draft',
    updatedAt,
    approvedAt: null,
    completedAt: null,
    approvedByServiceProviderUid: null,
    clientRevisionPending: true,
  }
}
