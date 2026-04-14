import { getFirestoreDb } from '../config/firebase.js'
import { listQuotesByServiceProvider } from './quotes.service.js'
import type {
  CustomFeatureValue,
  CustomFeatureValueType,
  ServiceProviderCustomFeature,
} from '../types/custom-feature.js'

export const SERVICE_PROVIDER_FEATURES_COLLECTION = 'service_provider_feature_fields'

type UpsertFeatureInput = {
  key: string
  label: string
  valueType: CustomFeatureValueType
  defaultValue: CustomFeatureValue
  showInQuoteDetails: boolean
}

type DynamicFeaturePayload = {
  values: Record<string, CustomFeatureValue>
  visibility: Record<string, boolean>
}
export type ServiceProviderCustomFeatureWithSuggestion = ServiceProviderCustomFeature & {
  suggestedValue: CustomFeatureValue
  suggestedSampleCount: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeDefaultValue(
  valueType: CustomFeatureValueType,
  value: CustomFeatureValue,
): CustomFeatureValue {
  if (value === null || value === undefined) {
    return null
  }
  if (valueType === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (valueType === 'boolean') {
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
  return String(value)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function mode<T extends string | boolean>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0][0]
}

function buildHistoryFeatureMap(
  customFieldsByQuote: Array<Array<{ key: string; value: CustomFeatureValue }>>,
): Map<string, CustomFeatureValue[]> {
  const valuesByKey = new Map<string, CustomFeatureValue[]>()
  customFieldsByQuote.forEach((quoteFields) => {
    quoteFields.forEach((field) => {
      const key = normalizeKey(field.key)
      const values = valuesByKey.get(key) ?? []
      values.push(field.value)
      valuesByKey.set(key, values)
    })
  })
  return valuesByKey
}

function resolveSuggestedValue(
  valueType: CustomFeatureValueType,
  values: CustomFeatureValue[],
): CustomFeatureValue {
  const normalizedValues = values
    .map((value) => normalizeDefaultValue(valueType, value))
    .filter((value): value is Exclude<CustomFeatureValue, null> => value !== null)
  if (normalizedValues.length === 0) {
    return null
  }
  if (valueType === 'number') {
    const numbers = normalizedValues.filter((value): value is number => typeof value === 'number')
    if (numbers.length === 0) return null
    return Number((Math.round(median(numbers) * 100) / 100).toFixed(2))
  }
  if (valueType === 'boolean') {
    const booleans = normalizedValues.filter((value): value is boolean => typeof value === 'boolean')
    return mode(booleans)
  }
  const texts = normalizedValues
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
  return mode(texts)
}

function buildFeatureId(serviceProviderUid: string, key: string): string {
  return `${serviceProviderUid}_${normalizeKey(key)}`
}

export async function listServiceProviderFeatures(
  serviceProviderUid: string,
): Promise<ServiceProviderCustomFeature[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(SERVICE_PROVIDER_FEATURES_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  return snapshot.docs
    .map((doc) => doc.data() as ServiceProviderCustomFeature)
    .sort((a, b) => a.key.localeCompare(b.key))
}

export async function listServiceProviderFeaturesWithSuggestions(
  serviceProviderUid: string,
): Promise<ServiceProviderCustomFeatureWithSuggestion[]> {
  const [features, quotes] = await Promise.all([
    listServiceProviderFeatures(serviceProviderUid),
    listQuotesByServiceProvider(serviceProviderUid),
  ])
  const approvedQuotes = quotes.filter(
    (quote) => quote.status === 'approved' || quote.status === 'completed',
  )
  const valuesByKey = buildHistoryFeatureMap(
    approvedQuotes.map((quote) =>
      quote.quote.customFields.map((field) => ({ key: field.key, value: field.value })),
    ),
  )

  return features.map((feature) => {
    const historyValues = valuesByKey.get(normalizeKey(feature.key)) ?? []
    const suggested = resolveSuggestedValue(feature.valueType, historyValues)
    return {
      ...feature,
      suggestedValue: suggested ?? feature.defaultValue,
      suggestedSampleCount: historyValues.length,
    }
  })
}

export async function upsertServiceProviderFeature(
  serviceProviderUid: string,
  input: UpsertFeatureInput,
): Promise<ServiceProviderCustomFeature> {
  const key = normalizeKey(input.key)
  const timestamp = nowIso()
  const id = buildFeatureId(serviceProviderUid, key)
  const db = getFirestoreDb()
  const ref = db.collection(SERVICE_PROVIDER_FEATURES_COLLECTION).doc(id)
  const existingSnapshot = await ref.get()
  const existing = existingSnapshot.exists
    ? (existingSnapshot.data() as ServiceProviderCustomFeature)
    : null

  const next: ServiceProviderCustomFeature = {
    id,
    serviceProviderUid,
    key,
    label: input.label.trim() || key,
    valueType: input.valueType,
    defaultValue: normalizeDefaultValue(input.valueType, input.defaultValue),
    showInQuoteDetails: input.showInQuoteDetails,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  await ref.set(next, { merge: true })
  return next
}

export async function deleteServiceProviderFeature(
  serviceProviderUid: string,
  featureId: string,
): Promise<boolean> {
  const id = featureId.trim()
  if (!id) {
    return false
  }

  const db = getFirestoreDb()
  const ref = db.collection(SERVICE_PROVIDER_FEATURES_COLLECTION).doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    return false
  }

  const feature = snapshot.data() as ServiceProviderCustomFeature
  if (feature.serviceProviderUid !== serviceProviderUid) {
    return false
  }

  await ref.delete()
  return true
}

export function buildDynamicFeaturePayload(
  features: ServiceProviderCustomFeature[],
): DynamicFeaturePayload {
  const values: Record<string, CustomFeatureValue> = {}
  const visibility: Record<string, boolean> = {}

  features.forEach((feature) => {
    values[feature.key] = normalizeDefaultValue(feature.valueType, feature.defaultValue)
    visibility[feature.key] = feature.showInQuoteDetails
  })

  return { values, visibility }
}
