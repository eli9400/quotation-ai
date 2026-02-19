import type { Quote, QuoteCustomField, QuoteLineItem, StoredQuoteRecord } from '../../types/quotation'
import type { EditableCustomField } from './QuoteCustomFieldsEditor'
import {
  computeCustomFieldsAdjustment,
  isPercentLikeCustomField,
} from './quoteCustomFieldMath'
import { computeLineTotals, isPercentLineUnit } from './quoteLineMath'

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
      valueType:
        field.valueType === 'number' && isPercentLikeCustomField(field.key, field.label)
          ? 'percent'
          : field.valueType,
      value: field.value === null ? '' : String(field.value),
      showInQuoteDetails: field.showInQuoteDetails,
    })),
    cpiFactor: String(cpi?.factor ?? 1),
    cpiEnabled: cpi?.enabled ?? false,
    cpiSourceYear: cpi?.sourceYear ?? null,
    cpiTargetYear: cpi?.targetYear ?? null,
    vatRate: String(record.quote.vatRate),
    summary: '',
    assumptions: '',
  }
}

function toNumber(value: string): number | null {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function computeLineTotal(quantity: number, unitPrice: number): number {
  return computeLineTotals([{ quantity, unitPrice, unit: 'custom' }])[0] ?? 0
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
    return { ...line, unitPrice: String(Math.round(next * 10_000) / 10_000) }
  })
}

function normalizeCustomFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function generateAutoCustomFieldKey(label: string, isPercent: boolean): string {
  const normalizedLabel = label.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalizedLabel) {
    return ''
  }

  const latinSlug = normalizedLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (latinSlug) {
    return isPercent ? `${latinSlug}_pct` : latinSlug
  }

  const token = [...normalizedLabel]
    .slice(0, 14)
    .map((char) => (char.codePointAt(0) ?? 0).toString(36))
    .join('_')
  const base = `field_${token}`.slice(0, 60)
  return isPercent ? `${base}_pct` : base
}

function toUniqueFieldKey(baseKey: string, usedKeys: Set<string>): string {
  if (!usedKeys.has(baseKey)) {
    usedKeys.add(baseKey)
    return baseKey
  }
  let suffix = 2
  while (usedKeys.has(`${baseKey}_${suffix}`)) {
    suffix += 1
  }
  const unique = `${baseKey}_${suffix}`
  usedKeys.add(unique)
  return unique
}

function parseCustomFieldValue(field: EditableCustomField): QuoteCustomField['value'] {
  if (field.valueType === 'number' || field.valueType === 'percent') {
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
  const parsed = lineItems
    .map((line) => {
      const isPercentLine = isPercentLineUnit(line.unit)
      const quantity = toNumber(line.quantity)
      const unitPrice = toNumber(line.unitPrice)
      if (!line.description.trim() || quantity === null || unitPrice === null) {
        return null
      }
      if (!isPercentLine && quantity < 0) {
        return null
      }
      if (!isPercentLine && !Number.isFinite(unitPrice)) {
        return null
      }
      return {
        id: line.id || crypto.randomUUID(),
        sourceItemId: line.sourceItemId,
        description: line.description.trim(),
        unit: line.unit.trim() || 'custom',
        quantity,
        unitPrice,
        lineTotal: 0,
      } satisfies QuoteLineItem
    })
    .filter((line): line is QuoteLineItem => line !== null)

  const lineTotals = computeLineTotals(
    parsed.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unit: line.unit,
    })),
  )

  return parsed.map((line, index) => ({
    ...line,
    lineTotal: lineTotals[index] ?? 0,
  }))
}

function parseCustomFields(fields: EditableCustomField[]): QuoteCustomField[] {
  const usedKeys = new Set<string>()
  return fields
    .map((field, index) => {
      const explicitKey = normalizeCustomFieldKey(field.key)
      const isPercent = field.valueType === 'percent'
      const autoKey = generateAutoCustomFieldKey(field.label, isPercent)
      const baseKey = explicitKey || autoKey || `field_${index + 1}`
      const percentReadyKey =
        isPercent && !/(^|_)(pct|percent)$/.test(baseKey) ? `${baseKey}_pct` : baseKey
      const key = toUniqueFieldKey(percentReadyKey, usedKeys)
      const persistedType: QuoteCustomField['valueType'] =
        field.valueType === 'percent' ? 'number' : field.valueType
      return {
        id: field.id || crypto.randomUUID(),
        key,
        label: field.label.trim() || key,
        valueType: persistedType,
        value: parseCustomFieldValue(field),
        showInQuoteDetails: field.showInQuoteDetails,
      } satisfies QuoteCustomField
    })
    .filter((field): field is QuoteCustomField => field !== null)
}

export function toParsedQuote(state: EditableQuoteState, baseQuote: Quote): Quote | null {
  const vatRate = toNumber(state.vatRate)
  const cpiFactor = toNumber(state.cpiFactor)
  if (vatRate === null || cpiFactor === null || cpiFactor <= 0) {
    return null
  }

  const lineItems = parseLineItems(state.lineItems)
  if (lineItems.length === 0) {
    return null
  }

  const customFields = parseCustomFields(state.customFields)
  const lineSubtotal = lineItems.reduce((sum, line) => sum + line.lineTotal, 0)
  const customAdjustment = computeCustomFieldsAdjustment(customFields, lineSubtotal)
  const subtotalBeforeVat = Math.max(0, lineSubtotal + customAdjustment)
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
