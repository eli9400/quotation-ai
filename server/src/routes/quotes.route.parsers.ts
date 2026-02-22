import { randomUUID } from 'node:crypto'
import { buildQuoteFromLineItems } from '../services/quote-breakdown.service.js'
import type {
  GeneratedQuote,
  ProjectType,
  QuoteClientRequest,
  QuoteLineItem,
  QuoteRequestedItem,
  ScopeLevel,
  UrgencyLevel,
} from '../types/quote.js'

const PROJECT_TYPES: ProjectType[] = ['renovation', 'consulting', 'installation', 'maintenance']
const SCOPES: ScopeLevel[] = ['small', 'medium', 'large']
const URGENCIES: UrgencyLevel[] = ['normal', 'fast', 'immediate']

function isEnumValue<T extends string>(value: unknown, accepted: readonly T[]): value is T {
  return typeof value === 'string' && accepted.includes(value as T)
}

function normalizeUnit(value: unknown): QuoteRequestedItem['unit'] {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === 'm2' || normalized === 'מ"ר') return 'sqm'
  if (normalized === 'יחידה' || normalized === 'יחידות') return 'unit'
  if (normalized === 'נקודה' || normalized === 'נקודות') return 'point'
  if (normalized === 'יום' || normalized === 'ימים') return 'day'
  if (normalized === 'מכולה' || normalized === 'מכולות') return 'container'
  if (normalized === 'קומפלט') return 'package'
  if (normalized === 'שעה' || normalized === 'שעות') return 'hour'
  if (normalized === 'מטר' || normalized === 'מטרים') return 'meter'
  const allowed = new Set([
    'sqm',
    'unit',
    'point',
    'day',
    'container',
    'package',
    'hour',
    'meter',
    'fixed',
    'percent',
    'unknown',
    'custom',
  ])
  return allowed.has(normalized) ? (normalized as QuoteRequestedItem['unit']) : undefined
}

function parseRequestedItems(value: unknown): QuoteRequestedItem[] {
  if (!Array.isArray(value)) return []
  const items: QuoteRequestedItem[] = []
  value.forEach((raw) => {
    const item = raw as Partial<QuoteRequestedItem>
    const sourceItemId =
      typeof item.sourceItemId === 'string' && item.sourceItemId.trim().length > 0
        ? item.sourceItemId.trim()
        : null
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    const quantity = Number(item.quantity)
    if (!label || !Number.isFinite(quantity) || quantity <= 0) return
    const nextItem: QuoteRequestedItem = { sourceItemId, label, quantity }
    const unit = normalizeUnit(item.unit)
    if (unit) nextItem.unit = unit
    items.push(nextItem)
  })
  return items
}

export function parseClientRequest(value: unknown): QuoteClientRequest | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const clientEmail = typeof candidate.clientEmail === 'string' ? candidate.clientEmail.trim() : ''
  if (
    typeof candidate.clientName !== 'string' ||
    !clientEmail.includes('@') ||
    typeof candidate.requirements !== 'string' ||
    !isEnumValue(candidate.projectType, PROJECT_TYPES) ||
    !isEnumValue(candidate.scope, SCOPES) ||
    !isEnumValue(candidate.urgency, URGENCIES)
  ) {
    return null
  }
  return {
    clientName: candidate.clientName.trim(),
    clientEmail,
    projectType: candidate.projectType,
    scope: candidate.scope,
    urgency: candidate.urgency,
    requirements: candidate.requirements.trim(),
    requestedItems: parseRequestedItems(candidate.requestedItems),
  }
}

export function parseServiceProviderCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function parseClientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  return normalized
}

function normalizeLineUnit(value: unknown): string {
  if (typeof value !== 'string') return 'custom'
  const normalized = value.trim().toLowerCase()
  if (normalized === '%' || normalized === 'pct') return 'percent'
  return normalized || 'custom'
}

function isPercentUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase()
  return normalized === 'percent' || normalized === '%' || normalized === 'pct'
}

function parseLineItems(value: unknown): QuoteLineItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const item = raw as Partial<QuoteLineItem>
      if (typeof item.description !== 'string' || item.description.trim().length === 0) {
        return null
      }
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity)) {
        return null
      }
      const unit = normalizeLineUnit(item.unit)
      if (!isPercentUnit(unit) && quantity < 0) {
        return null
      }
      const unitPrice = Number(item.unitPrice)
      return {
        id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : randomUUID(),
        sourceItemId: typeof item.sourceItemId === 'string' ? item.sourceItemId : null,
        description: item.description.trim(),
        unit: unit as QuoteLineItem['unit'],
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        lineTotal: 0,
      } satisfies QuoteLineItem
    })
    .filter((line): line is QuoteLineItem => line !== null)
}

export function parseQuoteForClientRevision(value: unknown): GeneratedQuote | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const lineItems = parseLineItems(candidate.lineItems)
  if (lineItems.length === 0) return null
  return buildQuoteFromLineItems({
    lineItems,
    customFields: candidate.customFields as GeneratedQuote['customFields'],
    pricingAdjustments: candidate.pricingAdjustments as GeneratedQuote['pricingAdjustments'],
    vatRate: Number(candidate.vatRate),
    estimatedDays: Number(candidate.estimatedDays),
    confidence: Number(candidate.confidence),
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    assumptions: Array.isArray(candidate.assumptions)
      ? candidate.assumptions.filter((item): item is string => typeof item === 'string')
      : [],
    generatedAt:
      typeof candidate.generatedAt === 'string' && candidate.generatedAt.trim().length > 0
        ? candidate.generatedAt
        : new Date().toISOString(),
  })
}
