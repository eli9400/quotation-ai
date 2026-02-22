import type { DynamicFormField, DynamicFieldType } from '../types/model-profile.js'
import type { IntakeFieldTemplate } from './service-provider-intake-templates.types.js'

function normalizeFieldId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '_')
}

function mapFieldType(type: IntakeFieldTemplate['type']): DynamicFieldType {
  if (type === 'date') return 'date'
  if (type === 'textarea') return 'textarea'
  if (type === 'select') return 'select'
  if (type === 'number') return 'number'
  return 'text'
}

function normalizeOptions(options: IntakeFieldTemplate['options']): string[] {
  if (!options || options.length === 0) return []
  return Array.from(
    new Set(options.map((value) => value.trim()).filter((value) => value.length > 0)),
  )
}

function normalizePlaceholder(field: IntakeFieldTemplate): string | null {
  if (typeof field.placeholder === 'string' && field.placeholder.trim().length > 0) {
    return field.placeholder.trim()
  }
  switch (field.type) {
    case 'number':
      return 'הזינו מספר'
    case 'textarea':
      return 'הזינו פירוט'
    case 'date':
      return 'בחרו תאריך'
    case 'select':
      return 'בחרו ערך'
    default:
      return 'הזינו ערך'
  }
}

export function buildIntakeDynamicFields(
  intakeFields: IntakeFieldTemplate[],
  startOrder: number,
): DynamicFormField[] {
  return intakeFields.map((field, index) => {
    const type = mapFieldType(field.type)
    const options = type === 'select' ? normalizeOptions(field.options) : []
    const fallbackType = type === 'select' && options.length === 0 ? 'text' : type
    return {
      id: `intake_${normalizeFieldId(field.key)}`,
      label: field.label.trim(),
      type: fallbackType,
      role: 'internal_meta',
      visibleTo: 'client',
      editableBy: 'client',
      required: Boolean(field.required),
      order: startOrder + index,
      sourceItemId: null,
      placeholder: normalizePlaceholder(field),
      hint:
        typeof field.hint === 'string' && field.hint.trim().length > 0
          ? field.hint.trim()
          : null,
      options,
    }
  })
}
