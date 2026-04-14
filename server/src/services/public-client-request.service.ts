import type { DynamicFormSchema } from '../types/model-profile.js'
import type {
  ProjectType,
  QuoteClientRequest,
  QuoteRequestedItem,
  ScopeLevel,
  UrgencyLevel,
} from '../types/quote.js'

const projectTypeValues: ProjectType[] = [
  'renovation',
  'consulting',
  'installation',
  'maintenance',
]
const scopeValues: ScopeLevel[] = ['small', 'medium', 'large']
const urgencyValues: UrgencyLevel[] = ['normal', 'fast', 'immediate']

type ParsePublicClientRequestResult =
  | { request: QuoteClientRequest; message: null }
  | { request: null; message: string }

type FormValues = Record<string, unknown>

function isClientVisibleField(field: DynamicFormSchema['fields'][number]): boolean {
  return !field.visibleTo || field.visibleTo === 'client'
}

function isQuantityInputField(field: DynamicFormSchema['fields'][number]): boolean {
  const role = field.role ?? 'input_qty'
  return (
    isClientVisibleField(field) &&
    role === 'input_qty' &&
    field.sourceItemId !== null &&
    field.type === 'number'
  )
}

function isEnumValue<T extends string>(value: unknown, accepted: readonly T[]): value is T {
  return typeof value === 'string' && accepted.includes(value as T)
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toRequestedUnit(value: unknown): QuoteRequestedItem['unit'] {
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

function validateRequiredFields(schema: DynamicFormSchema, formValues: FormValues): string | null {
  for (const field of schema.fields.filter(isClientVisibleField)) {
    if (!field.required) continue

    const rawValue = formValues[field.id]
    if (field.type === 'number') {
      const numericValue = toNumberValue(rawValue)
      if (numericValue === null || numericValue <= 0) {
        return `שדה חובה חסר או לא תקין: ${field.label}.`
      }
      continue
    }

    const stringValue = toStringValue(rawValue)
    if (stringValue.length === 0) {
      return `שדה חובה חסר: ${field.label}.`
    }

    if (
      field.type === 'select' &&
      field.options.length > 0 &&
      !field.options.includes(stringValue)
    ) {
      return `ערך לא חוקי בשדה: ${field.label}.`
    }
  }
  return null
}

function buildRequestedItems(schema: DynamicFormSchema, formValues: FormValues): QuoteRequestedItem[] {
  return schema.fields
    .filter(isQuantityInputField)
    .map((field) => ({
      sourceItemId: field.sourceItemId ?? null,
      label: field.label,
      quantity: toNumberValue(formValues[field.id]) ?? 0,
    }))
    .filter((item) => item.quantity > 0 && !!item.sourceItemId)
}

function parseExtraRequestedItems(value: unknown): QuoteRequestedItem[] {
  if (!Array.isArray(value)) return []

  const parsedItems: QuoteRequestedItem[] = []
  value.forEach((raw) => {
    const item = raw as Partial<QuoteRequestedItem>
    const label = toStringValue(item.label)
    const quantity = toNumberValue(item.quantity)
    if (!label || quantity === null || quantity <= 0) return

    const sourceItemId =
      typeof item.sourceItemId === 'string' && item.sourceItemId.trim().length > 0
        ? item.sourceItemId.trim()
        : null
    const nextItem: QuoteRequestedItem = { sourceItemId, label, quantity }
    const unit = toRequestedUnit(item.unit)
    if (unit) nextItem.unit = unit
    parsedItems.push(nextItem)
  })

  return parsedItems
}

function mergeRequestedItems(items: QuoteRequestedItem[]): QuoteRequestedItem[] {
  const merged = new Map<string, QuoteRequestedItem>()
  items.forEach((item) => {
    const unitKey = item.unit ?? 'custom'
    const key = item.sourceItemId
      ? `src:${item.sourceItemId}`
      : `custom:${item.label.trim().toLowerCase()}|${unitKey}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, item)
      return
    }
    merged.set(key, { ...existing, quantity: existing.quantity + item.quantity })
  })
  return Array.from(merged.values())
}

function buildDynamicDetails(requestedItems: QuoteRequestedItem[]): string[] {
  return requestedItems.map((item) => `${item.label}: ${item.quantity}`)
}

function buildIntakeDetails(schema: DynamicFormSchema, formValues: FormValues): string[] {
  return schema.fields
    .filter((field) => isClientVisibleField(field))
    .filter((field) => field.id !== 'clientName' && field.id !== 'clientEmail')
    .filter((field) => field.id !== 'requirements' && field.role !== 'input_qty')
    .map((field) => {
      const value = toStringValue(formValues[field.id])
      if (!value) return null
      return `${field.label}: ${value}`
    })
    .filter((line): line is string => line !== null)
}

export function parsePublicClientRequestFromSchema(
  schema: DynamicFormSchema,
  formValues: unknown,
  extraRequestedItems?: unknown,
): ParsePublicClientRequestResult {
  if (!formValues || typeof formValues !== 'object') {
    return { request: null, message: 'formValues is required.' }
  }

  const values = formValues as FormValues
  const requiredError = validateRequiredFields(schema, values)
  if (requiredError) return { request: null, message: requiredError }

  const clientName = toStringValue(values.clientName)
  const clientEmail = toStringValue(values.clientEmail)
  if (!clientName) return { request: null, message: 'שם לקוח חסר.' }
  if (!clientEmail || !clientEmail.includes('@')) {
    return { request: null, message: 'אימייל לקוח לא תקין.' }
  }

  const requestedItems = mergeRequestedItems([
    ...buildRequestedItems(schema, values),
    ...parseExtraRequestedItems(extraRequestedItems),
  ])

  const freeTextRequirements = toStringValue(values.requirements)
  const intakeDetails = buildIntakeDetails(schema, values)
  const dynamicDetails = buildDynamicDetails(requestedItems)
  const requirements = [
    freeTextRequirements,
    intakeDetails.length > 0 ? `פרטים ראשוניים:\n${intakeDetails.join('\n')}` : '',
    dynamicDetails.length > 0 ? `נתוני כמויות:\n${dynamicDetails.join('\n')}` : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n\n')

  return {
    request: {
      clientName,
      clientEmail,
      projectType: isEnumValue(values.projectType, projectTypeValues)
        ? values.projectType
        : 'renovation',
      scope: isEnumValue(values.scope, scopeValues) ? values.scope : 'medium',
      urgency: isEnumValue(values.urgency, urgencyValues) ? values.urgency : 'normal',
      requirements: requirements || 'פנייה חדשה מטופס לקוח דינמי.',
      requestedItems,
    },
    message: null,
  }
}
