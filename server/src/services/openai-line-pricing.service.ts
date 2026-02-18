import { env } from '../config/env.js'
import type { QuoteLineItem } from '../types/quote.js'

type CalibrationLine = {
  id: string
  description: string
  unit: string
  quantity: number
  currentUnitPrice: number
  samplePairs: Array<{ quantity: number; unitPrice: number }>
}

type OpenAiRawItem = {
  id?: unknown
  unitPrice?: unknown
}

type OpenAiRawPayload = {
  items?: OpenAiRawItem[]
}

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

function toJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function buildPrompt(lines: CalibrationLine[], requirements: string): string {
  return [
    'Adjust unit prices for quote line-items.',
    'Important:',
    '- If quantity exactly matches past samples, use almost the same unit price.',
    '- For larger quantities, unit price should not increase.',
    '- Return only JSON: {"items":[{"id":"...","unitPrice":123.45}]}',
    '- Do not add extra fields.',
    `Client requirements: ${requirements || 'none'}`,
    `Lines: ${JSON.stringify(lines)}`,
  ].join('\n')
}

export async function calibrateUnitPricesWithOpenAi(
  lineItems: QuoteLineItem[],
  lineSamples: Map<string, Array<{ quantity: number; unitPrice: number }>>,
  requirements: string,
): Promise<Map<string, number> | null> {
  if (!env.openAiApiKey || lineItems.length === 0) {
    return null
  }

  const lines: CalibrationLine[] = lineItems.map((line) => ({
    id: line.id,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    currentUnitPrice: line.unitPrice,
    samplePairs: line.sourceItemId ? (lineSamples.get(line.sourceItemId) ?? []).slice(0, 18) : [],
  }))

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
          content: 'You are a pricing model that returns strict JSON only.',
        },
        {
          role: 'user',
          content: buildPrompt(lines, requirements),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI line pricing failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenAiResponse
  const content = payload.choices?.[0]?.message?.content ?? ''
  const parsed = toJson<OpenAiRawPayload>(content)
  const items = Array.isArray(parsed?.items) ? parsed.items : []

  const result = new Map<string, number>()
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id : ''
    const unitPrice = toNumber(item.unitPrice)
    if (!id || unitPrice === null || unitPrice < 0) {
      continue
    }
    result.set(id, unitPrice)
  }

  return result.size > 0 ? result : null
}
