import { env } from '../../config/env'
import type {
  ClientRequestForm,
  Quote,
  QuoteSource,
  StoredQuoteRecord,
  TrainingJob,
  UploadedDocument,
} from '../../types/quotation'
import { requestJson } from './httpClient'
import { mapQuoteRecordPayload, type QuoteRecordPayload } from './quoteRecordMapper'

type UploadDocumentsResponse = {
  ok: boolean
  documents: Array<{
    id: string
    originalName: string
    mimeType: string
    size: number
    uploadedAt: string
  }>
}

type DeleteDocumentResponse = {
  ok: boolean
  deletedId: string
}

type StartTrainingResponse = {
  ok: boolean
  message: string
  job: TrainingJob
}

type GetTrainingResponse = {
  ok: boolean
  job: TrainingJob
}

type GetLatestTrainingResponse = {
  ok: boolean
  job: TrainingJob | null
}

type GenerateQuoteResponse = {
  ok: boolean
  source: QuoteSource
  quote: Quote
  quoteId: string
}

type ListQuotesResponse = {
  ok: boolean
  quotes: QuoteRecordPayload[]
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

function authHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
  }
}

const MOJIBAKE_MARKERS = /[ÃÂÐÑ×ØÙÚÛÜÝÞß]/g
const MOJIBAKE_TEST = /[ÃÂÐÑ×ØÙÚÛÜÝÞß]/

function decodeLikelyMojibake(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || !MOJIBAKE_TEST.test(trimmed)) return trimmed
  const bytes = Array.from(trimmed).map((char) => char.charCodeAt(0) & 0xff)
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)).trim()
    if (!decoded) return trimmed
    const originalNoise = (trimmed.match(MOJIBAKE_MARKERS) ?? []).length
    const decodedNoise = (decoded.match(MOJIBAKE_MARKERS) ?? []).length
    return decodedNoise < originalNoise ? decoded : trimmed
  } catch {
    return trimmed
  }
}

function toUiDocument(document: UploadDocumentsResponse['documents'][number]): UploadedDocument {
  return {
    id: document.id,
    name: decodeLikelyMojibake(document.originalName),
    size: document.size,
    type: document.mimeType || 'unknown',
    uploadedAt: new Date(document.uploadedAt).toLocaleString('he-IL'),
  }
}

export async function uploadDocuments(
  idToken: string,
  files: File[],
): Promise<UploadedDocument[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('documents', file))

  const payload = await requestJson<UploadDocumentsResponse>(apiUrl('/documents'), {
    method: 'POST',
    body: formData,
    headers: authHeaders(idToken),
  })

  return payload.documents.map(toUiDocument)
}

export async function listDocuments(idToken: string): Promise<UploadedDocument[]> {
  const payload = await requestJson<UploadDocumentsResponse>(apiUrl('/documents'), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.documents.map(toUiDocument)
}

export async function deleteDocument(
  idToken: string,
  documentId: string,
): Promise<string> {
  const payload = await requestJson<DeleteDocumentResponse>(
    apiUrl(`/documents/${encodeURIComponent(documentId)}`),
    {
      method: 'DELETE',
      headers: authHeaders(idToken),
    },
  )
  return payload.deletedId
}

export async function startTraining(
  idToken: string,
  documentIds: string[],
): Promise<TrainingJob> {
  const payload = await requestJson<StartTrainingResponse>(apiUrl('/training/start'), {
    method: 'POST',
    body: JSON.stringify({ documentIds }),
    headers: {
      ...authHeaders(idToken),
      'Content-Type': 'application/json',
    },
  })
  return payload.job
}

export async function getTrainingJob(idToken: string, jobId: string): Promise<TrainingJob> {
  const payload = await requestJson<GetTrainingResponse>(apiUrl(`/training/${jobId}`), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.job
}

export async function getLatestCompletedTrainingJob(
  idToken: string,
): Promise<TrainingJob | null> {
  const payload = await requestJson<GetLatestTrainingResponse>(apiUrl('/training/latest'), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.job
}
export async function generateQuote(
  idToken: string,
  trainingJobId: string,
  clientRequest: ClientRequestForm,
): Promise<{ source: QuoteSource; quote: Quote; record: StoredQuoteRecord }> {
  const payload = await requestJson<GenerateQuoteResponse>(apiUrl('/quotes/generate'), {
    method: 'POST',
    body: JSON.stringify({ trainingJobId, clientRequest }),
    headers: {
      ...authHeaders(idToken),
      'Content-Type': 'application/json',
    },
  })

  return {
    source: payload.source,
    quote: payload.quote,
    record: mapQuoteRecordPayload({
      id: payload.quoteId,
      source: payload.source,
      createdAt: payload.quote.generatedAt,
      updatedAt: payload.quote.generatedAt,
      status: 'draft',
      clientRevisionPending: false,
      approvedAt: null,
      completedAt: null,
      clientRequest,
      quote: payload.quote,
    }),
  }
}

export async function listQuotes(idToken: string): Promise<StoredQuoteRecord[]> {
  const payload = await requestJson<ListQuotesResponse>(apiUrl('/quotes'), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.quotes.map(mapQuoteRecordPayload)
}
