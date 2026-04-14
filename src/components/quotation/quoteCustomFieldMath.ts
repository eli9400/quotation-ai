import type { QuoteCustomField } from '../../types/quotation'

export function isPercentLikeCustomField(key: string, label: string): boolean {
  const normalizedKey = key.trim().toLowerCase()
  if (/(^|_)(pct|percent)$/.test(normalizedKey)) {
    return true
  }
  const normalizedLabel = label.trim().toLowerCase()
  return normalizedLabel.includes('%') || normalizedLabel.includes('אחוז')
}

export function computeCustomFieldsAdjustment(
  fields: QuoteCustomField[],
  lineSubtotal: number,
): number {
  return fields.reduce((sum, field) => {
    if (
      field.valueType !== 'number' ||
      typeof field.value !== 'number' ||
      !Number.isFinite(field.value)
    ) {
      return sum
    }
    if (isPercentLikeCustomField(field.key, field.label)) {
      return sum + (lineSubtotal * field.value) / 100
    }
    return sum + field.value
  }, 0)
}
