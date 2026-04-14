import {
  SERVICE_PROVIDER_INDUSTRY_CATEGORIES,
  type ServiceProviderIndustryCategory,
} from './service-provider-industries.catalog.js'

export type ServiceProviderIndustry = string

export type ServiceProviderIndustryMeta = {
  value: string
  label: string
  categoryId: string
  categoryLabel: string
}

const INDUSTRY_META_BY_VALUE = new Map<string, ServiceProviderIndustryMeta>()
const CATEGORY_BY_ID = new Map<string, ServiceProviderIndustryCategory>()

SERVICE_PROVIDER_INDUSTRY_CATEGORIES.forEach((category) => {
  CATEGORY_BY_ID.set(category.id, category)
  category.options.forEach((option) => {
    INDUSTRY_META_BY_VALUE.set(option.value.toLowerCase(), {
      value: option.value,
      label: option.label,
      categoryId: category.id,
      categoryLabel: category.label,
    })
  })
})

const DEFAULT_INDUSTRY =
  INDUSTRY_META_BY_VALUE.get('general_service_provider') ??
  Array.from(INDUSTRY_META_BY_VALUE.values())[0]

const LEGACY_INDUSTRY_ALIASES: Record<string, string> = {
  general: 'general_service_provider',
  renovation: 'renovation_contractor',
  electrical: 'electrician',
  plumbing: 'plumber',
  painting: 'painter',
  cleaning: 'cleaning_company',
  hvac: 'hvac_technician',
  gardening: 'landscape_contractor',
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function resolveIndustryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = normalizeKey(value)
  if (!normalized) return null

  if (INDUSTRY_META_BY_VALUE.has(normalized)) {
    return INDUSTRY_META_BY_VALUE.get(normalized)?.value ?? null
  }

  const legacyMapped = LEGACY_INDUSTRY_ALIASES[normalized]
  if (legacyMapped && INDUSTRY_META_BY_VALUE.has(legacyMapped)) {
    return INDUSTRY_META_BY_VALUE.get(legacyMapped)?.value ?? null
  }

  const category = CATEGORY_BY_ID.get(normalized)
  if (category && category.options.length > 0) {
    return category.options[0].value
  }

  return null
}

export function listServiceProviderIndustryCategories(): ServiceProviderIndustryCategory[] {
  return SERVICE_PROVIDER_INDUSTRY_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    options: category.options.map((option) => ({ ...option })),
  }))
}

export function isServiceProviderIndustry(value: unknown): value is ServiceProviderIndustry {
  return resolveIndustryValue(value) !== null
}

export function normalizeServiceProviderIndustry(value: unknown): ServiceProviderIndustry {
  return resolveIndustryValue(value) ?? DEFAULT_INDUSTRY.value
}

export function getServiceProviderIndustryMeta(value: unknown): ServiceProviderIndustryMeta {
  const normalizedValue = normalizeServiceProviderIndustry(value).toLowerCase()
  return INDUSTRY_META_BY_VALUE.get(normalizedValue) ?? DEFAULT_INDUSTRY
}

