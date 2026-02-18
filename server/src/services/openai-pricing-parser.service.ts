import { env } from '../config/env.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type { ExtractedDocumentText } from './document-text-extractor.service.js'
import { buildObservation, detectUnit } from './pricing-parser-utils.service.js'

type OpenAiRawItem = {
  rawName?: unknown
  sourceLine?: unknown
  unit?: unknown
  quantity?: unknown
  pricePerUnit?: unknown
  lineTotal?: unknown
}

type OpenAiPayload = {
  choices?: Array<{ message?: { content?: string | null } }>
}

const MAX_DOC_TEXT_CHARS = 14_000

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.replace(/[₪,\s]/g, '').replace(/[^\d.-]/g, '')
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function normalizeUnit(value: unknown, fallbackLine: string): PricingUnit {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'sqm' || normalized === 'm2' || normalized === 'm"ר') {
      return 'sqm'
    }
    if (normalized === 'unit' || normalized === 'pcs') {
      return 'unit'
    }
    if (normalized === 'hour') {
      return 'hour'
    }
    if (normalized === 'meter') {
      return 'meter'
    }
    if (normalized === 'fixed') {
      return 'fixed'
    }
    return detectUnit(value)
  }
  return detectUnit(fallbackLine)
}

function toObservation(documentId: string, item: OpenAiRawItem): PricingObservation | null {
  const rawName = typeof item.rawName === 'string' ? item.rawName.trim() : ''
  const sourceLine =
    typeof item.sourceLine === 'string' && item.sourceLine.trim().length > 0
      ? item.sourceLine.trim()
      : rawName

  const quantity = parseNumber(item.quantity)
  const pricePerUnit = parseNumber(item.pricePerUnit)
  const lineTotalRaw = parseNumber(item.lineTotal)
  if (!rawName || quantity === null || pricePerUnit === null) {
    return null
  }

  const lineTotal = lineTotalRaw ?? Number((quantity * pricePerUnit).toFixed(2))
  const unit = normalizeUnit(item.unit, sourceLine)
  return buildObservation(
    documentId,
    sourceLine,
    rawName,
    unit,
    quantity,
    pricePerUnit,
    lineTotal,
  )
}

async function extractForSingleDocument(
  document: ExtractedDocumentText,
): Promise<PricingObservation[]> {
  const prompt = [
    'Extract only real line-items from this quotation.',
    'Ignore VAT, totals, payment terms, headers, and metadata.',
    'Return JSON with shape: {"items":[{"rawName":"", "sourceLine":"", "unit":"sqm|unit|hour|meter|fixed|unknown", "quantity":0, "pricePerUnit":0, "lineTotal":0}]}',
    'Use numeric values only for quantity/pricePerUnit/lineTotal.',
    `Document name: ${document.originalName}`,
    'Document text:',
    document.text.slice(0, MAX_DOC_TEXT_CHARS),
  ].join('\n')

  const response = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.openAiModel,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You extract structured pricing line-items from contractor quotations.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI pricing parser failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenAiPayload
  const content = payload.choices?.[0]?.message?.content ?? ''
  const parsed = tryParseJson<{ items?: OpenAiRawItem[] }>(content)
  const items = Array.isArray(parsed?.items) ? parsed.items : []

  return items
    .map((item) => toObservation(document.documentId, item))
    .filter((item): item is PricingObservation => item !== null)
}

export async function extractPricingObservationsWithOpenAi(
  documents: ExtractedDocumentText[],
): Promise<PricingObservation[] | null> {
  if (!env.openAiApiKey || documents.length === 0) {
    return null
  }

  const observations: PricingObservation[] = []
  for (const document of documents) {
    const extracted = await extractForSingleDocument(document)
    observations.push(...extracted)
  }

  return observations
}
