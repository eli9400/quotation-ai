import { env } from '../config/env.js'
import { parseFlexibleNumber } from './number-parser.service.js'
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
const OPENAI_TIMEOUT_MS = 45_000
const OPENAI_MAX_ATTEMPTS = 2

type OpenAiParseProgress = {
  processed: number
  total: number
  documentId: string
}

type OpenAiParseOptions = {
  onProgress?: (progress: OpenAiParseProgress) => Promise<void> | void
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseNumber(value: unknown): number | null {
  return parseFlexibleNumber(value, { allowZero: false })
}

function normalizeUnit(value: unknown, fallbackLine: string): PricingUnit {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'sqm' || normalized === 'm2' || normalized === 'm"ר') {
      return 'sqm'
    }
    if (normalized === 'point' || normalized === 'points') {
      return 'point'
    }
    if (normalized === 'day' || normalized === 'days') {
      return 'day'
    }
    if (normalized === 'container' || normalized === 'containers') {
      return 'container'
    }
    if (normalized === 'package') {
      return 'package'
    }
    if (normalized === 'percent' || normalized === '%') {
      return 'percent'
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

function toObservation(
  documentId: string,
  document: ExtractedDocumentText,
  item: OpenAiRawItem,
): PricingObservation | null {
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
  return buildObservation(documentId, sourceLine, rawName, unit, quantity, pricePerUnit, lineTotal, {
    sourceQuoteDate: document.quoteDate,
    vatMode: document.pricingContext.vatMode,
    vatRate: document.pricingContext.vatRate,
    materialsMode: document.pricingContext.materialsMode,
    discountPercent: document.pricingContext.discountPercent,
    discountAmount: document.pricingContext.discountAmount,
  })
}

async function extractForSingleDocument(
  document: ExtractedDocumentText,
): Promise<PricingObservation[]> {
  const prompt = [
    'Extract only real line-items from this quotation.',
    'Ignore VAT, totals, payment terms, headers, and metadata lines.',
    'Handle mixed number formats like 1,234.56 and 1.234,56.',
    'Keep VAT/materials clues in sourceLine if they appear in source text.',
    'Return JSON with shape: {"items":[{"rawName":"", "sourceLine":"", "unit":"sqm|point|day|container|package|unit|hour|meter|fixed|percent|unknown", "quantity":0, "pricePerUnit":0, "lineTotal":0}]}',
    'Use numeric values only for quantity/pricePerUnit/lineTotal.',
    `Document name: ${document.originalName}`,
    `Detected quote date: ${document.quoteDate ?? 'unknown'}`,
    `Detected VAT mode: ${document.pricingContext.vatMode}`,
    'Document text:',
    document.text.slice(0, MAX_DOC_TEXT_CHARS),
  ].join('\n')

  let lastError: unknown = null
  for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
    try {
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
              content: 'You extract structured pricing line-items from contractor quotations.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`OpenAI pricing parser failed with status ${response.status}`)
      }

      const payload = (await response.json()) as OpenAiPayload
      const content = payload.choices?.[0]?.message?.content ?? ''
      const parsed = tryParseJson<{ items?: OpenAiRawItem[] }>(content)
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      return items
        .map((item) => toObservation(document.documentId, document, item))
        .filter((item): item is PricingObservation => item !== null)
    } catch (error) {
      lastError = error
      if (attempt < OPENAI_MAX_ATTEMPTS) {
        continue
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('OpenAI pricing parser failed without a detailed error.')
}

export async function extractPricingObservationsWithOpenAi(
  documents: ExtractedDocumentText[],
  options: OpenAiParseOptions = {},
): Promise<PricingObservation[] | null> {
  if (!env.openAiApiKey || documents.length === 0) {
    return null
  }

  const observations: PricingObservation[] = []
  const total = documents.length
  let processed = 0
  for (const document of documents) {
    const extracted = await extractForSingleDocument(document)
    observations.push(...extracted)
    processed += 1
    await options.onProgress?.({
      processed,
      total,
      documentId: document.documentId,
    })
  }
  return observations
}
