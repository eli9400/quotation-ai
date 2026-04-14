import type { EditableCustomField } from './QuoteCustomFieldsEditor'
import type { EditableLineItem } from './quoteDetailsUtils'

type AutoQuoteText = {
  summary: string
  assumptions: string
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isMeaningfulCustomField(field: EditableCustomField): boolean {
  const value = field.value.trim()
  if (!value) return false
  if (field.valueType === 'boolean' && value.toLowerCase() === 'false') return false
  if ((field.valueType === 'number' || field.valueType === 'percent') && Number(value) === 0) {
    return false
  }
  return true
}

function lineLabel(line: EditableLineItem): string {
  return normalizeLabel(line.description)
}

function customFieldLabel(field: EditableCustomField): string {
  return normalizeLabel(field.label || field.key || 'שדה פנימי')
}

export function buildAutoQuoteText(
  lineItems: EditableLineItem[],
  customFields: EditableCustomField[],
): AutoQuoteText {
  const activeLines = lineItems
    .map((line) => ({ ...line, quantityNum: Number(line.quantity) || 0 }))
    .filter((line) => lineLabel(line).length > 0 && line.quantityNum > 0)

  const lineNames = Array.from(new Set(activeLines.map((line) => lineLabel(line)))).slice(0, 6)
  const meaningfulFields = customFields.filter(isMeaningfulCustomField)
  const fieldNames = Array.from(new Set(meaningfulFields.map((field) => customFieldLabel(field)))).slice(0, 6)

  const summaryParts: string[] = []
  if (lineNames.length > 0) {
    summaryParts.push(`הצעה כוללת ${lineNames.length} רכיבים: ${lineNames.join(', ')}`)
  } else {
    summaryParts.push('הצעה זו כוללת רכיבי עבודה לפי בקשת הלקוח.')
  }
  if (fieldNames.length > 0) {
    summaryParts.push(`כולל רכיבים פנימיים: ${fieldNames.join(', ')}`)
  }

  const assumptionLines = [
    'המחיר מחושב לפי כמויות ורכיבי ההצעה המעודכנים.',
    'חריגות, עבודות נוספות ושינויים בשטח יתומחרו בנפרד.',
  ]
  if (fieldNames.length > 0) {
    assumptionLines.push(`שדות דינמיים פעילים בחישוב: ${fieldNames.join(', ')}`)
  }

  return {
    summary: summaryParts.join(' | '),
    assumptions: assumptionLines.join('\n'),
  }
}
