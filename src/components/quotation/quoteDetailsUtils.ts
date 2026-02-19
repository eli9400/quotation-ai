import type { Quote, QuoteCustomField, QuoteLineItem, StoredQuoteRecord } from '../../types/quotation'
import type { EditableCustomField } from './QuoteCustomFieldsEditor'

export type EditableLineItem = {
  id: string
  sourceItemId: string | null
  description: string
  unit: string
  quantity: string
  unitPrice: string
}

export type EditableQuoteState = {
  lineItems: EditableLineItem[]
  customFields: EditableCustomField[]
  cpiFactor: string
  cpiEnabled: boolean
  cpiSourceYear: number | null
  cpiTargetYear: number | null
  vatRate: string
  summary: string
  assumptions: string
}

export function toEditableState(record: StoredQuoteRecord): EditableQuoteState {
  const cpi = record.quote.pricingAdjustments.cpi
  return {
    lineItems: record.quote.lineItems.map((item) => ({
      id: item.id,
      sourceItemId: item.sourceItemId,
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
    customFields: record.quote.customFields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      valueType: field.valueType,
      value: field.value === null ? '' : String(field.value),
      showInQuoteDetails: field.showInQuoteDetails,
    })),
    cpiFactor: String(cpi?.factor ?? 1),
    cpiEnabled: cpi?.enabled ?? false,
    cpiSourceYear: cpi?.sourceYear ?? null,
    cpiTargetYear: cpi?.targetYear ?? null,
    vatRate: String(record.quote.vatRate),
    summary: record.quote.summary,
    assumptions: record.quote.assumptions.join('\n'),
  }
}

function toNumber(value: string): number | null {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

export function applyCpiFactorToLineItems(
  lineItems: EditableLineItem[],
  ratio: number,
): EditableLineItem[] {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) {
    return lineItems
  }
  return lineItems.map((line) => {
    const value = Number(line.unitPrice)
    const next = Number.isFinite(value) ? value * ratio : 0
    return {
      ...line,
      unitPrice: String(Math.round(next * 10_000) / 10_000),
    }
  })
}

function normalizeCustomFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseCustomFieldValue(field: EditableCustomField): QuoteCustomField['value'] {
  if (field.valueType === 'number') {
    const parsed = Number(field.value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (field.valueType === 'boolean') {
    const normalized = field.value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    return null
  }
  return field.value.trim()
}

function parseLineItems(lineItems: EditableLineItem[]): QuoteLineItem[] {
  return lineItems
    .map((line) => {
      const quantity = toNumber(line.quantity)
      const unitPrice = toNumber(line.unitPrice)
      if (!line.description.trim() || quantity === null || unitPrice === null) {
        return null
      }
      if (quantity < 0 || unitPrice < 0) {
        return null
      }
      return {
        id: line.id || crypto.randomUUID(),
        sourceItemId: line.sourceItemId,
        description: line.description.trim(),
        unit: line.unit || 'custom',
        quantity,
        unitPrice,
        lineTotal: computeLineTotal(quantity, unitPrice),
      } satisfies QuoteLineItem
    })
    .filter((line): line is QuoteLineItem => line !== null)
}

function parseCustomFields(fields: EditableCustomField[]): QuoteCustomField[] {
  return fields
    .map((field) => {
      const key = normalizeCustomFieldKey(field.key)
      if (!key) {
        return null
      }
      return {
        id: field.id || crypto.randomUUID(),
        key,
        label: field.label.trim() || key,
        valueType: field.valueType,
        value: parseCustomFieldValue(field),
        showInQuoteDetails: field.showInQuoteDetails,
      } satisfies QuoteCustomField
    })
    .filter((field): field is QuoteCustomField => field !== null)
}

export function toParsedQuote(state: EditableQuoteState, baseQuote: Quote): Quote | null {
  const vatRate = toNumber(state.vatRate)
  const cpiFactor = toNumber(state.cpiFactor)
  if (vatRate === null) {
    return null
  }
  if (cpiFactor === null || cpiFactor <= 0) {
    return null
  }

  const lineItems = parseLineItems(state.lineItems)
  if (lineItems.length === 0) {
    return null
  }

  const customFields = parseCustomFields(state.customFields)
  const subtotalBeforeVat = lineItems.reduce((sum, line) => sum + line.lineTotal, 0)
  const vatAmount = Math.round(((subtotalBeforeVat * vatRate) / 100) * 100) / 100
  const estimatedPrice = Math.round((subtotalBeforeVat + vatAmount) * 100) / 100
  const assumptions = state.assumptions.split('\n').map((item) => item.trim()).filter(Boolean)

  return {
    ...baseQuote,
    lineItems,
    customFields,
    pricingAdjustments: {
      cpi: {
        enabled: state.cpiEnabled,
        factor: cpiFactor,
        sourceYear: state.cpiSourceYear,
        targetYear: state.cpiTargetYear,
      },
    },
    subtotalBeforeVat: Math.round(subtotalBeforeVat * 100) / 100,
    vatRate: Math.max(0, Math.min(40, vatRate)),
    vatAmount: Math.round(vatAmount * 100) / 100,
    estimatedPrice,
    estimatedDays: Math.max(1, Math.round(baseQuote.estimatedDays || 1)),
    confidence: Math.max(0, Math.min(100, Math.round(baseQuote.confidence || 0))),
    summary: state.summary.trim(),
    assumptions,
  }
}
