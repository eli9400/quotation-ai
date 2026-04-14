import type { Quote, QuoteSource, StoredQuoteRecord } from '../../types/quotation'
import type { EditableCustomField } from './QuoteCustomFieldsEditor'
import type { EditableLineItem } from './quoteDetailsUtils'

export const QUOTE_SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  learned: 'מודל נלמד',
  fallback: 'Fallback',
}

export const QUOTE_UNIT_OPTIONS = [
  { value: 'custom', label: 'מותאם אישית' },
  { value: 'sqm', label: 'מ"ר' },
  { value: 'unit', label: 'יחידה' },
  { value: 'point', label: 'יחידה (ביקור)' },
  { value: 'day', label: 'יום' },
  { value: 'hour', label: 'שעה' },
  { value: 'meter', label: 'מטר' },
  { value: 'container', label: 'מכולה' },
  { value: 'package', label: 'קומפלט' },
  { value: 'percent', label: 'אחוז (%)' },
]

export function quoteStatusLabel(record: StoredQuoteRecord): string {
  if (record.status === 'completed') return 'בוצעה'
  if (record.status === 'approved') return 'מאושר'
  if (record.clientRevisionPending) return 'מחכה לאישור מחדש'
  return 'מחכה לאישור'
}

export function toFactor(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return parsed
}

export function emptyLineItem(): EditableLineItem {
  return {
    id: crypto.randomUUID(),
    sourceItemId: null,
    description: '',
    unit: 'custom',
    quantity: '0',
    unitPrice: '0',
    autoPriced: false,
  }
}

export function emptyCustomField(): EditableCustomField {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    valueType: 'text',
    value: '',
    showInQuoteDetails: false,
  }
}

export function serializeQuote(quote: Quote): string {
  return JSON.stringify(quote)
}
