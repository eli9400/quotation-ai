import { env } from '../../config/env'
import type { FormPreviewSchema } from '../../types/quotation'
import { requestJson } from './httpClient'

type PublicFormPreviewResponse = {
  ok: boolean
  schema: FormPreviewSchema
}

type SubmitClientRequestResponse = {
  ok: boolean
  requestId: string
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

export async function submitClientQuoteRequest(
  serviceProviderCode: string,
  formValues: Record<string, string>,
): Promise<string> {
  const payload = await requestJson<SubmitClientRequestResponse>(
    apiUrl('/public/quotes/request'),
    {
      method: 'POST',
      body: JSON.stringify({ serviceProviderCode, formValues }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )

  return payload.requestId
}
