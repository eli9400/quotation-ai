import { env } from '../../config/env'
import type {
  FormPreviewSchema,
  ProviderCustomFeatureOption,
  ProviderLineItemOption,
} from '../../types/quotation'
import { requestJson } from './httpClient'

type FormPreviewResponse = {
  ok: boolean
  schema: FormPreviewSchema
}

type ProviderLineItemsResponse = {
  ok: boolean
  items: ProviderLineItemOption[]
}

type ProviderCustomFeaturesResponse = {
  ok: boolean
  features: ProviderCustomFeatureOption[]
}

type ProviderLineItemDisplayConfigsResponse = {
  ok: boolean
  configs: Array<{
    sourceItemId: string
    customLabel: string | null
    hiddenFromClient: boolean
  }>
}

type MergeProviderLineItemsResponse = {
  ok: boolean
  merged: {
    sourceItemId: string
    targetItemId: string
    updatedDatasetRows: number
    refreshedItemOptionsCount: number
    refreshedClientVisibleCount: number
  }
}

type DeleteProviderLineItemResponse = {
  ok: boolean
  deleted: {
    sourceItemId: string
    deletedDatasetRows: number
    refreshedItemOptionsCount: number
    refreshedClientVisibleCount: number
  }
}

export type ProviderLineItemDisplayConfig = {
  sourceItemId: string
  customLabel: string | null
  visibleToClient: boolean
}

export type MergeProviderLineItemsResult = MergeProviderLineItemsResponse['merged']
export type DeleteProviderLineItemResult = DeleteProviderLineItemResponse['deleted']

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

function authHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
  }
}

export async function getFormPreviewSchema(idToken: string): Promise<FormPreviewSchema> {
  const payload = await requestJson<FormPreviewResponse>(apiUrl('/model/form-preview'), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.schema
}

export async function getProviderLineItemOptions(
  idToken: string,
): Promise<ProviderLineItemOption[]> {
  const payload = await requestJson<ProviderLineItemsResponse>(
    apiUrl('/model/provider-line-items'),
    {
      method: 'GET',
      headers: authHeaders(idToken),
    },
  )
  return payload.items
}

export async function getProviderCustomFeatureOptions(
  idToken: string,
): Promise<ProviderCustomFeatureOption[]> {
  const payload = await requestJson<ProviderCustomFeaturesResponse>(
    apiUrl('/model/custom-features'),
    {
      method: 'GET',
      headers: authHeaders(idToken),
    },
  )
  return payload.features
}

export async function getProviderLineItemDisplayConfigs(
  idToken: string,
): Promise<ProviderLineItemDisplayConfig[]> {
  const payload = await requestJson<ProviderLineItemDisplayConfigsResponse>(
    apiUrl('/model/provider-line-items/client-config'),
    {
      method: 'GET',
      headers: authHeaders(idToken),
    },
  )
  return payload.configs.map((config) => ({
    sourceItemId: config.sourceItemId,
    customLabel: typeof config.customLabel === 'string' ? config.customLabel : null,
    visibleToClient: !config.hiddenFromClient,
  }))
}

export async function saveProviderLineItemDisplayConfigs(
  idToken: string,
  configs: ProviderLineItemDisplayConfig[],
): Promise<ProviderLineItemDisplayConfig[]> {
  const payload = await requestJson<ProviderLineItemDisplayConfigsResponse>(
    apiUrl('/model/provider-line-items/client-config'),
    {
      method: 'PATCH',
      body: JSON.stringify({
        configs: configs.map((config) => ({
          sourceItemId: config.sourceItemId,
          customLabel: config.customLabel,
          visibleToClient: config.visibleToClient,
        })),
      }),
      headers: {
        ...authHeaders(idToken),
        'Content-Type': 'application/json',
      },
    },
  )
  return payload.configs.map((config) => ({
    sourceItemId: config.sourceItemId,
    customLabel: typeof config.customLabel === 'string' ? config.customLabel : null,
    visibleToClient: !config.hiddenFromClient,
  }))
}

export async function mergeProviderLineItems(
  idToken: string,
  sourceItemId: string,
  targetItemId: string,
): Promise<MergeProviderLineItemsResult> {
  const payload = await requestJson<MergeProviderLineItemsResponse>(
    apiUrl('/model/provider-line-items/merge'),
    {
      method: 'POST',
      body: JSON.stringify({ sourceItemId, targetItemId }),
      headers: {
        ...authHeaders(idToken),
        'Content-Type': 'application/json',
      },
    },
  )
  return payload.merged
}

export async function deleteProviderLineItem(
  idToken: string,
  sourceItemId: string,
): Promise<DeleteProviderLineItemResult> {
  const payload = await requestJson<DeleteProviderLineItemResponse>(
    apiUrl(`/model/provider-line-items/${encodeURIComponent(sourceItemId)}`),
    {
      method: 'DELETE',
      headers: authHeaders(idToken),
    },
  )
  return payload.deleted
}
