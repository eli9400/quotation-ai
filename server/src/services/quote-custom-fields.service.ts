import { randomUUID } from 'node:crypto'
import type { QuoteCustomField } from '../types/quote.js'
import type { CustomFeatureValueType } from '../types/custom-feature.js'

type RawQuoteCustomField = Partial<QuoteCustomField>

const ALLOWED_TYPES: CustomFeatureValueType[] = ['number', 'text', 'boolean']

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toValueType(value: unknown): CustomFeatureValueType {
  if (typeof value === 'string' && ALLOWED_TYPES.includes(value as CustomFeatureValueType)) {
    return value as CustomFeatureValueType
  }
  return 'text'
}

function parseByType(
  type: CustomFeatureValueType,
  value: unknown,
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null
  }
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return null
  }
  return String(value).trim()
}

function toSingleField(raw: RawQuoteCustomField): QuoteCustomField | null {
  const rawKey = typeof raw.key === 'string' ? raw.key : ''
  const key = normalizeKey(rawKey)
  if (!key) {
    return null
  }

  const valueType = toValueType(raw.valueType)
  const value = parseByType(valueType, raw.value)
  const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : key

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : randomUUID(),
    key,
    label,
    valueType,
    value,
    showInQuoteDetails: Boolean(raw.showInQuoteDetails),
  }
}

export function normalizeQuoteCustomFields(value: unknown): QuoteCustomField[] {
  if (!Array.isArray(value)) {
    return []
  }

  const dedup = new Map<string, QuoteCustomField>()
  value.forEach((raw) => {
    if (!raw || typeof raw !== 'object') {
      return
    }
    const field = toSingleField(raw as RawQuoteCustomField)
    if (!field) {
      return
    }
    dedup.set(field.key, field)
  })
  return Array.from(dedup.values())
}
