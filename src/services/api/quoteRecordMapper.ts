import type { ClientRequestForm, Quote, QuoteSource, StoredQuoteRecord } from '../../types/quotation'

export type QuoteRecordPayload = {
  id: string
  source: QuoteSource
  createdAt: string
  updatedAt?: string
  status?: 'draft' | 'approved'
  approvedAt?: string | null
  clientRequest: ClientRequestForm
  quote: Quote
}

function normalizeLineItems(quote: Quote) {
  if (!Array.isArray(quote?.lineItems)) {
    return []
  }

  return quote.lineItems
    .filter((item) => item && typeof item.description === 'string')
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      sourceItemId: item.sourceItemId ?? null,
      description: item.description,
      unit: item.unit ?? 'custom',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      lineTotal: Number(item.lineTotal) || 0,
    }))
}

function normalizeCustomFields(quote: Quote) {
  if (!Array.isArray(quote?.customFields)) {
    return []
  }

  return quote.customFields
    .filter((item) => item && typeof item.key === 'string')
    .map((item) => {
      const valueType: 'number' | 'text' | 'boolean' =
        item.valueType === 'number' || item.valueType === 'boolean' ? item.valueType : 'text'
      return {
        id: item.id ?? crypto.randomUUID(),
        key: item.key.trim().toLowerCase(),
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.key,
        valueType,
        value: item.value ?? null,
        showInQuoteDetails: Boolean(item.showInQuoteDetails),
      }
    })
}

function normalizePricingAdjustments(quote: Quote) {
  const rawCpi = quote?.pricingAdjustments?.cpi
  if (!rawCpi || typeof rawCpi !== 'object') {
    return { cpi: null }
  }

  const factor = Number(rawCpi.factor)
  const sourceYear = Number(rawCpi.sourceYear)
  const targetYear = Number(rawCpi.targetYear)
  return {
    cpi: {
      enabled: Boolean(rawCpi.enabled),
      factor: Number.isFinite(factor) && factor > 0 ? factor : 1,
      sourceYear: Number.isInteger(sourceYear) ? sourceYear : null,
      targetYear: Number.isInteger(targetYear) ? targetYear : null,
    },
  }
}

export function mapQuoteRecordPayload(payload: QuoteRecordPayload): StoredQuoteRecord {
  const clientRequest: ClientRequestForm = {
    clientName: payload.clientRequest?.clientName ?? '',
    clientEmail: payload.clientRequest?.clientEmail ?? '',
    projectType: payload.clientRequest?.projectType ?? 'renovation',
    scope: payload.clientRequest?.scope ?? 'medium',
    urgency: payload.clientRequest?.urgency ?? 'normal',
    requirements: payload.clientRequest?.requirements ?? '',
    requestedItems: Array.isArray(payload.clientRequest?.requestedItems)
      ? payload.clientRequest.requestedItems
      : [],
  }

  const lineItems = normalizeLineItems(payload.quote)
  const customFields = normalizeCustomFields(payload.quote)
  const pricingAdjustments = normalizePricingAdjustments(payload.quote)
  const subtotalBeforeVat =
    Number(payload.quote?.subtotalBeforeVat) ||
    lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const vatRate = Number(payload.quote?.vatRate)
  const safeVatRate = Number.isFinite(vatRate) ? vatRate : 17
  const vatAmount =
    Number(payload.quote?.vatAmount) ||
    Math.round(((subtotalBeforeVat * safeVatRate) / 100) * 100) / 100
  const estimatedPrice =
    Number(payload.quote?.estimatedPrice) || subtotalBeforeVat + vatAmount

  return {
    id: payload.id,
    source: payload.source,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt ?? payload.createdAt,
    status: payload.status === 'approved' ? 'approved' : 'draft',
    approvedAt:
      typeof payload.approvedAt === 'string' && payload.approvedAt.length > 0
        ? payload.approvedAt
        : null,
    clientRequest,
    quote: {
      ...payload.quote,
      lineItems,
      customFields,
      pricingAdjustments,
      subtotalBeforeVat,
      vatRate: safeVatRate,
      vatAmount,
      estimatedPrice,
      estimatedDays: Math.max(1, Number(payload.quote?.estimatedDays) || 1),
      confidence: Math.max(0, Math.min(100, Number(payload.quote?.confidence) || 60)),
      summary: payload.quote?.summary ?? '',
      assumptions: Array.isArray(payload.quote?.assumptions)
        ? payload.quote.assumptions
        : [],
      generatedAt: payload.quote?.generatedAt ?? payload.createdAt,
    },
  }
}
