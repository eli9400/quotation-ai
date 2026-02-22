import { env } from '../../config/env'
import type { FormPreviewSchema, Quote, StoredQuoteRecord } from '../../types/quotation'
import { requestJson } from './httpClient'
import { mapQuoteRecordPayload, type QuoteRecordPayload } from './quoteRecordMapper'

type PublicFormPreviewResponse = {
  ok: boolean
  schema: FormPreviewSchema
}

type SubmitClientRequestResponse = {
  ok: boolean
  requestId: string
}

type ListClientQuotesResponse = {
  ok: boolean
  quotes: QuoteRecordPayload[]
}

type ClientRevisionResponse = {
  ok: boolean
  quoteRecord: QuoteRecordPayload
}

type ClientLineItemsResponse = {
  ok: boolean
  items: Array<{
    sourceItemId: string
    label: string
    unit: string
  }>
}

type VehicleCatalogResponse = {
  ok: boolean
  items: Array<{
    value: string
    label: string
  }>
}
export type ClientExtraRequestedItem = {
  sourceItemId: string | null
  label: string
  quantity: number
  unit?: string
}

export type ClientLineItemOption = {
  sourceItemId: string
  label: string
  unit?: string
}

export type VehicleCatalogOption = {
  value: string
  label: string
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

export async function fetchClientFormSchema(
  serviceProviderCode: string,
): Promise<FormPreviewSchema> {
  const payload = await requestJson<PublicFormPreviewResponse>(
    apiUrl(
      `/model/form-preview/by-code/${encodeURIComponent(serviceProviderCode.trim().toUpperCase())}`,
    ),
    {
      method: 'GET',
    },
  )

  return payload.schema
}

export async function fetchClientLineItemOptions(
  serviceProviderCode: string,
): Promise<ClientLineItemOption[]> {
  const payload = await requestJson<ClientLineItemsResponse>(
    apiUrl(
      `/public/provider-line-items/by-code/${encodeURIComponent(serviceProviderCode.trim().toUpperCase())}`,
    ),
    { method: 'GET' },
  )
  return payload.items
}

export async function submitClientQuoteRequest(
  serviceProviderCode: string,
  formValues: Record<string, string>,
  extraRequestedItems: ClientExtraRequestedItem[] = [],
): Promise<string> {
  const payload = await requestJson<SubmitClientRequestResponse>(
    apiUrl('/public/quotes/request'),
    {
      method: 'POST',
      body: JSON.stringify({ serviceProviderCode, formValues, extraRequestedItems }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )

  return payload.requestId
}

export async function listClientQuotes(
  serviceProviderCode: string,
  clientEmail: string,
): Promise<StoredQuoteRecord[]> {
  const query = new URLSearchParams({
    serviceProviderCode: serviceProviderCode.trim().toUpperCase(),
    clientEmail: clientEmail.trim().toLowerCase(),
  })
  const payload = await requestJson<ListClientQuotesResponse>(
    apiUrl(`/public/quotes/by-client?${query.toString()}`),
    { method: 'GET' },
  )
  return payload.quotes.map(mapQuoteRecordPayload)
}

export async function submitClientQuoteRevision(
  serviceProviderCode: string,
  clientEmail: string,
  quoteId: string,
  quote: Quote,
): Promise<StoredQuoteRecord> {
  const payload = await requestJson<ClientRevisionResponse>(
    apiUrl(`/public/quotes/${encodeURIComponent(quoteId)}/client-approve`),
    {
      method: 'POST',
      body: JSON.stringify({
        serviceProviderCode: serviceProviderCode.trim().toUpperCase(),
        clientEmail: clientEmail.trim().toLowerCase(),
        quote,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  return mapQuoteRecordPayload(payload.quoteRecord)
}

export async function fetchVehicleManufacturers(
  vehicleTypes?: string[],
): Promise<VehicleCatalogOption[]> {
  const query = new URLSearchParams()
  if (Array.isArray(vehicleTypes) && vehicleTypes.length > 0) {
    query.set('vehicleType', vehicleTypes.join(','))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const payload = await requestJson<VehicleCatalogResponse>(
    apiUrl(`/public/vehicle-catalog/manufacturers${suffix}`),
    { method: 'GET' },
  )
  return payload.items ?? []
}

export async function fetchVehicleModels(
  make: string,
  year?: string | number | null,
): Promise<VehicleCatalogOption[]> {
  const query = new URLSearchParams({ make: make.trim() })
  if (year !== undefined && year !== null && String(year).trim().length > 0) {
    query.set('year', String(year).trim())
  }
  const payload = await requestJson<VehicleCatalogResponse>(
    apiUrl(`/public/vehicle-catalog/models?${query.toString()}`),
    { method: 'GET' },
  )
  return payload.items ?? []
}

export async function fetchVehicleTrims(
  make?: string | null,
): Promise<VehicleCatalogOption[]> {
  const query = new URLSearchParams()
  if (typeof make === 'string' && make.trim().length > 0) {
    query.set('make', make.trim())
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const payload = await requestJson<VehicleCatalogResponse>(
    apiUrl(`/public/vehicle-catalog/trims${suffix}`),
    { method: 'GET' },
  )
  return payload.items ?? []
}
