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
  return isClientVisibleField(field) && role === 'input_qty' && field.sourceItemId !== null && field.type === 'number'
}

function isEnumValue<T extends string>(value: unknown, accepted: readonly T[]): value is T {
  return typeof value === 'string' && accepted.includes(value as T)
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return ''
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) {
      return null
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function validateRequiredFields(schema: DynamicFormSchema, formValues: FormValues): string | null {
  for (const field of schema.fields.filter(isClientVisibleField)) {
    if (!field.required) {
      continue
    }

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

    if (field.type === 'select' && field.options.length > 0 && !field.options.includes(stringValue)) {
      return `ערך לא חוקי בשדה: ${field.label}.`
    }
  }

  return null
}

function buildRequestedItems(
  schema: DynamicFormSchema,
  formValues: FormValues,
): QuoteRequestedItem[] {
  return schema.fields
    .filter(isQuantityInputField)
    .map((field) => {
      const quantity = toNumberValue(formValues[field.id]) ?? 0
      return {
        sourceItemId: field.sourceItemId ?? '',
        label: field.label,
        quantity,
      }
    })
    .filter((item) => item.sourceItemId.length > 0 && item.quantity > 0)
}

function buildDynamicDetails(requestedItems: QuoteRequestedItem[]): string[] {
  return requestedItems.map((item) => `${item.label}: ${item.quantity}`)
}

export function parsePublicClientRequestFromSchema(
  schema: DynamicFormSchema,
  formValues: unknown,
): ParsePublicClientRequestResult {
  if (!formValues || typeof formValues !== 'object') {
    return {
      request: null,
      message: 'formValues is required.',
    }
  }

  const values = formValues as FormValues
  const requiredError = validateRequiredFields(schema, values)
  if (requiredError) {
    return {
      request: null,
      message: requiredError,
    }
  }

  const clientName = toStringValue(values.clientName)
  const clientEmail = toStringValue(values.clientEmail)
  if (!clientName) {
    return { request: null, message: 'שם לקוח חסר.' }
  }
  if (!clientEmail || !clientEmail.includes('@')) {
    return { request: null, message: 'אימייל לקוח לא תקין.' }
  }

  const requestedItems = buildRequestedItems(schema, values)
  const freeTextRequirements = toStringValue(values.requirements)
  const dynamicDetails = buildDynamicDetails(requestedItems)
  const requirements = [
    freeTextRequirements,
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
