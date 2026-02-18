import { env } from '../../config/env'
import type { Quote, StoredQuoteRecord } from '../../types/quotation'
import { requestJson } from './httpClient'
import { mapQuoteRecordPayload, type QuoteRecordPayload } from './quoteRecordMapper'

type UpdateQuoteResponse = {
  ok: boolean
  quoteRecord: QuoteRecordPayload
}

type DeleteQuoteResponse = {
  ok: boolean
  deletedId: string
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

function authHeaders(idToken: string): HeadersInit {
  return { Authorization: `Bearer ${idToken}` }
}

export async function updateQuoteRecord(
  idToken: string,
  quoteId: string,
  quote: Quote,
): Promise<StoredQuoteRecord> {
  const payload = await requestJson<UpdateQuoteResponse>(
    apiUrl(`/quotes/${encodeURIComponent(quoteId)}`),
    {
      method: 'PATCH',
      body: JSON.stringify({ quote }),
      headers: {
        ...authHeaders(idToken),
        'Content-Type': 'application/json',
      },
    },
  )
  return mapQuoteRecordPayload(payload.quoteRecord)
}

export async function approveQuoteRecord(
  idToken: string,
  quoteId: string,
): Promise<StoredQuoteRecord> {
  const payload = await requestJson<UpdateQuoteResponse>(
    apiUrl(`/quotes/${encodeURIComponent(quoteId)}/approve`),
    {
      method: 'POST',
      headers: authHeaders(idToken),
    },
  )
  return mapQuoteRecordPayload(payload.quoteRecord)
}

export async function deleteQuoteRecord(
  idToken: string,
  quoteId: string,
): Promise<string> {
  const payload = await requestJson<DeleteQuoteResponse>(
    apiUrl(`/quotes/${encodeURIComponent(quoteId)}`),
    {
      method: 'DELETE',
      headers: authHeaders(idToken),
    },
  )
  return payload.deletedId
}
