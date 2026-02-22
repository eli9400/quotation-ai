import type { ProviderCustomFeatureOption } from '../../types/quotation'
import { isPercentLikeCustomField } from './quoteCustomFieldMath'
import type { EditableCustomField } from './QuoteCustomFieldsEditor'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toEditableValue(value: ProviderCustomFeatureOption['defaultValue']): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function findProviderCustomFeatureByText(
  options: ProviderCustomFeatureOption[],
  text: string,
): ProviderCustomFeatureOption | null {
  const normalized = normalizeText(text)
  if (!normalized) return null
  return (
    options.find((option) => normalizeText(option.label) === normalized) ??
    options.find((option) => normalizeText(option.key) === normalized) ??
    null
  )
}

export function toEditableCustomFieldFromFeature(
  feature: ProviderCustomFeatureOption,
): EditableCustomField {
  const isPercent = feature.valueType === 'number' && isPercentLikeCustomField(feature.key, feature.label)
  const resolvedValue = feature.suggestedValue ?? feature.defaultValue
  return {
    id: crypto.randomUUID(),
    key: feature.key,
    label: feature.label,
    valueType: isPercent ? 'percent' : feature.valueType,
    value: toEditableValue(resolvedValue),
    showInQuoteDetails: feature.showInQuoteDetails,
  }
}
