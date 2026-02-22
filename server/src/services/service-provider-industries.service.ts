import type { ServiceProviderIndustry } from '../types/service-provider.js'

export const SERVICE_PROVIDER_INDUSTRIES: ServiceProviderIndustry[] = [
  'general',
  'renovation',
  'electrical',
  'plumbing',
  'painting',
  'cleaning',
  'hvac',
  'gardening',
]

export function isServiceProviderIndustry(value: unknown): value is ServiceProviderIndustry {
  return typeof value === 'string' && SERVICE_PROVIDER_INDUSTRIES.includes(value as ServiceProviderIndustry)
}

export function normalizeServiceProviderIndustry(value: unknown): ServiceProviderIndustry {
  return isServiceProviderIndustry(value) ? value : 'general'
}
