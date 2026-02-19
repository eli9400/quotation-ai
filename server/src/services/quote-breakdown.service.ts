import { randomUUID } from 'node:crypto'
import { normalizeQuoteCustomFields } from './quote-custom-fields.service.js'
import { normalizeQuotePricingAdjustments } from './quote-pricing-adjustments.service.js'
import type { GeneratedQuote, QuoteLineItem } from '../types/quote.js'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeVatRate(vatRate: number): number {
  if (!Number.isFinite(vatRate)) {
    return 17
  }
  return Math.max(0, Math.min(40, round2(vatRate)))
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return round2(Math.max(0, quantity) * Math.max(0, unitPrice))
}

export function normalizeLineItems(lineItems: QuoteLineItem[]): QuoteLineItem[] {
  return lineItems
    .filter((item) => item.description.trim().length > 0)
    .map((item) => {
      const quantity = round2(Math.max(0, item.quantity))
      const unitPrice = round2(Math.max(0, item.unitPrice))
      return {
        ...item,
        id: item.id?.trim().length > 0 ? item.id : randomUUID(),
        sourceItemId: item.sourceItemId ?? null,
        quantity,
        unitPrice,
        lineTotal: computeLineTotal(quantity, unitPrice),
      }
    })
}

export function computeTotals(lineItems: QuoteLineItem[], vatRate: number) {
  const subtotalBeforeVat = round2(lineItems.reduce((sum, line) => sum + line.lineTotal, 0))
  const normalizedVatRate = normalizeVatRate(vatRate)
  const vatAmount = round2((subtotalBeforeVat * normalizedVatRate) / 100)
  const estimatedPrice = round2(subtotalBeforeVat + vatAmount)
  return {
    subtotalBeforeVat,
    vatRate: normalizedVatRate,
    vatAmount,
    estimatedPrice,
  }
}

type BuildQuoteInput = {
  lineItems: QuoteLineItem[]
  customFields?: GeneratedQuote['customFields']
  pricingAdjustments?: GeneratedQuote['pricingAdjustments']
  vatRate: number
  estimatedDays: number
  confidence: number
  summary: string
  assumptions: string[]
  generatedAt?: string
}

export function buildQuoteFromLineItems(input: BuildQuoteInput): GeneratedQuote {
  const lineItems = normalizeLineItems(input.lineItems)
  const customFields = normalizeQuoteCustomFields(input.customFields)
  const pricingAdjustments = normalizeQuotePricingAdjustments(input.pricingAdjustments)
  const totals = computeTotals(lineItems, input.vatRate)
  const estimatedDays = Number.isFinite(input.estimatedDays) ? input.estimatedDays : 1
  const confidence = Number.isFinite(input.confidence) ? input.confidence : 60

  return {
    lineItems,
    customFields,
    pricingAdjustments,
    ...totals,
    estimatedDays: Math.max(1, Math.round(estimatedDays)),
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    summary: input.summary.trim(),
    assumptions: input.assumptions.map((item) => item.trim()).filter(Boolean),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  }
}
