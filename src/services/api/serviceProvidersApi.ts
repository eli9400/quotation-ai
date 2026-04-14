import { env } from '../../config/env'
import type {
  ServiceProviderIndustryCategory,
  ServiceProviderProfile,
  ServiceProviderPublicProfile,
} from '../../types/serviceProvider'
import { requestJson } from './httpClient'

type GetServiceProviderMeResponse = {
  ok: boolean
  serviceProvider?: ServiceProviderProfile
  contractor?: ServiceProviderProfile
}

type GetServiceProviderByCodeResponse = {
  ok: boolean
  serviceProvider?: ServiceProviderPublicProfile
  contractor?: ServiceProviderPublicProfile
}

type UpdateServiceProviderResponse = {
  ok: boolean
  serviceProvider?: ServiceProviderProfile
  contractor?: ServiceProviderProfile
}

type ListIndustriesResponse = {
  ok: boolean
  categories: ServiceProviderIndustryCategory[]
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

export async function fetchServiceProviderMe(idToken: string): Promise<ServiceProviderProfile> {
  const payload = await requestJson<GetServiceProviderMeResponse>(apiUrl('/service-providers/me'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  })
  const profile = payload.serviceProvider ?? payload.contractor
  if (!profile) {
    throw new Error('Service provider profile is missing from API response.')
  }
  return profile
}

export async function fetchServiceProviderByCode(
  serviceProviderCode: string,
): Promise<ServiceProviderPublicProfile> {
  const payload = await requestJson<GetServiceProviderByCodeResponse>(
    apiUrl(`/service-providers/by-code/${encodeURIComponent(serviceProviderCode.trim().toUpperCase())}`),
    { method: 'GET' },
  )
  const profile = payload.serviceProvider ?? payload.contractor
  if (!profile) {
    throw new Error('נותן שירות לא נמצא עבור הקוד שסופק.')
  }
  return profile
}

export async function updateServiceProviderIndustry(
  idToken: string,
  industry: string,
): Promise<ServiceProviderProfile> {
  const payload = await requestJson<UpdateServiceProviderResponse>(apiUrl('/service-providers/me'), {
    method: 'PATCH',
    body: JSON.stringify({ industry }),
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  })
  const profile = payload.serviceProvider ?? payload.contractor
  if (!profile) {
    throw new Error('Service provider profile is missing from API response.')
  }
  return profile
}

export async function fetchServiceProviderIndustryCatalog(): Promise<ServiceProviderIndustryCategory[]> {
  const payload = await requestJson<ListIndustriesResponse>(apiUrl('/service-providers/industries'), {
    method: 'GET',
  })
  return payload.categories ?? []
}
