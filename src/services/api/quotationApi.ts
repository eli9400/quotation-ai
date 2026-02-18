import { env } from '../../config/env'
import type {
  ClientRequestForm,
  Quote,
  QuoteSource,
  TrainingJob,
  UploadedDocument,
} from '../../types/quotation'
import { requestJson } from './httpClient'

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

type StartTrainingResponse = {
  ok: boolean
  message: string
  job: TrainingJob
}

type GetTrainingResponse = {
  ok: boolean
  job: TrainingJob
}

type GenerateQuoteResponse = {
  ok: boolean
  source: QuoteSource
  quote: Quote
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
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

export async function uploadDocuments(files: File[]): Promise<UploadedDocument[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('documents', file))

  const payload = await requestJson<UploadDocumentsResponse>(apiUrl('/documents'), {
    method: 'POST',
    body: formData,
  })

  return payload.documents.map(toUiDocument)
}

export async function startTraining(documentIds: string[]): Promise<TrainingJob> {
  const payload = await requestJson<StartTrainingResponse>(apiUrl('/training/start'), {
    method: 'POST',
    body: JSON.stringify({ documentIds }),
    headers: { 'Content-Type': 'application/json' },
  })
  return payload.job
}

export async function getTrainingJob(jobId: string): Promise<TrainingJob> {
  const payload = await requestJson<GetTrainingResponse>(apiUrl(`/training/${jobId}`), {
    method: 'GET',
  })
  return payload.job
}

export async function generateQuote(
  trainingJobId: string,
  clientRequest: ClientRequestForm,
): Promise<{ source: QuoteSource; quote: Quote }> {
  const payload = await requestJson<GenerateQuoteResponse>(apiUrl('/quotes/generate'), {
    method: 'POST',
    body: JSON.stringify({ trainingJobId, clientRequest }),
    headers: { 'Content-Type': 'application/json' },
  })

  return {
    source: payload.source,
    quote: payload.quote,
  }
}
