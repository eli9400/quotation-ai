import { env } from '../../config/env'
import type {
  ClientRequestForm,
  FormPreviewSchema,
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
type FormPreviewResponse = {
  ok: boolean
  schema: FormPreviewSchema
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

function authHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
  }
}

function toUiDocument(document: UploadDocumentsResponse['documents'][number]): UploadedDocument {
  return {
    id: document.id,
    name: document.originalName,
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
      approvedAt: null,
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

export async function getFormPreviewSchema(idToken: string): Promise<FormPreviewSchema> {
  const payload = await requestJson<FormPreviewResponse>(apiUrl('/model/form-preview'), {
    method: 'GET',
    headers: authHeaders(idToken),
  })
  return payload.schema
}
