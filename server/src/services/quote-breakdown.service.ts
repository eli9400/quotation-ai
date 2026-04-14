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
  return round2(Math.max(0, quantity) * unitPrice)
}

function isPercentLikeUnit(unit: QuoteLineItem['unit']): boolean {
  const normalized = String(unit).trim().toLowerCase()
  return normalized === 'percent' || normalized === '%' || normalized === 'pct'
}

function computeNormalizedLineTotals(lineItems: QuoteLineItem[]): number[] {
  const baseSubtotal = round2(
    lineItems.reduce((sum, item) => {
      if (isPercentLikeUnit(item.unit)) {
        return sum
      }
      return sum + computeLineTotal(item.quantity, item.unitPrice)
    }, 0),
  )

  return lineItems.map((item) => {
    if (isPercentLikeUnit(item.unit)) {
      return round2((baseSubtotal * item.quantity * item.unitPrice) / 100)
    }
    return computeLineTotal(item.quantity, item.unitPrice)
  })
}

function isPercentLikeCustomField(
  field: GeneratedQuote['customFields'][number],
): boolean {
  const normalizedKey = field.key.trim().toLowerCase()
  if (/(^|_)(pct|percent)$/.test(normalizedKey)) {
    return true
  }
  const normalizedLabel = field.label.trim().toLowerCase()
  return normalizedLabel.includes('%') || normalizedLabel.includes('אחוז')
}

function computeCustomFieldsAdjustment(
  customFields: GeneratedQuote['customFields'],
  lineSubtotal: number,
): number {
  return round2(
    customFields.reduce((sum, field) => {
      if (
        field.valueType !== 'number' ||
        typeof field.value !== 'number' ||
        !Number.isFinite(field.value)
      ) {
        return sum
      }
      if (isPercentLikeCustomField(field)) {
        return sum + (lineSubtotal * field.value) / 100
      }
      return sum + field.value
    }, 0),
  )
}

export function normalizeLineItems(lineItems: QuoteLineItem[]): QuoteLineItem[] {
  const prepared = lineItems
    .filter((item) => item.description.trim().length > 0)
    .map((item) => {
      const quantity = round2(
        isPercentLikeUnit(item.unit) ? item.quantity : Math.max(0, item.quantity),
      )
      const unitPrice = round2(Number.isFinite(item.unitPrice) ? item.unitPrice : 0)
      return {
        ...item,
        id: item.id?.trim().length > 0 ? item.id : randomUUID(),
        sourceItemId: item.sourceItemId ?? null,
        quantity,
        unitPrice,
        lineTotal: 0,
      }
    })

  const lineTotals = computeNormalizedLineTotals(prepared)
  return prepared.map((item, index) => ({
    ...item,
    lineTotal: lineTotals[index] ?? 0,
  }))
}

export function computeTotals(
  lineItems: QuoteLineItem[],
  vatRate: number,
  customFields: GeneratedQuote['customFields'] = [],
) {
  const lineSubtotal = round2(lineItems.reduce((sum, line) => sum + line.lineTotal, 0))
  const customAdjustment = computeCustomFieldsAdjustment(customFields, lineSubtotal)
  const subtotalBeforeVat = round2(Math.max(0, lineSubtotal + customAdjustment))
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
  const totals = computeTotals(lineItems, input.vatRate, customFields)
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
