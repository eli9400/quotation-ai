import { env } from '../config/env.js'
import type { GeneratedQuote, QuoteClientRequest } from '../types/quote.js'

type OpenAiQuoteInput = {
  request: QuoteClientRequest
  documentCount: number
}

type OpenAiRawQuote = {
  estimatedPrice: number
  estimatedDays: number
  confidence: number
  summary: string
  assumptions: string[]
}

function tryParseJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function isOpenAiRawQuote(value: unknown): value is OpenAiRawQuote {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as OpenAiRawQuote
  const validAssumptions =
    Array.isArray(candidate.assumptions) &&
    candidate.assumptions.every((item) => typeof item === 'string')

  return (
    Number.isFinite(candidate.estimatedPrice) &&
    Number.isFinite(candidate.estimatedDays) &&
    Number.isFinite(candidate.confidence) &&
    typeof candidate.summary === 'string' &&
    validAssumptions
  )
}

export async function generateQuoteWithOpenAi(
  input: OpenAiQuoteInput,
): Promise<GeneratedQuote | null> {
  if (!env.openAiApiKey) {
    return null
  }

  const prompt = [
    'Return only valid JSON with fields:',
    'estimatedPrice(number), estimatedDays(number), confidence(number 0-100), summary(string), assumptions(string[]).',
    'Context:',
    JSON.stringify(input),
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
      messages: [
        {
          role: 'system',
          content: 'You are a quoting assistant for professional service providers.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = payload.choices?.[0]?.message?.content ?? ''
  const parsed = tryParseJson<OpenAiRawQuote>(content)

  if (!isOpenAiRawQuote(parsed)) {
    throw new Error('OpenAI returned invalid JSON structure for quote.')
  }

  return {
    estimatedPrice: Math.max(0, Math.round(parsed.estimatedPrice)),
    estimatedDays: Math.max(1, Math.round(parsed.estimatedDays)),
    confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
    summary: parsed.summary.trim(),
    assumptions: parsed.assumptions.map((item) => item.trim()).filter(Boolean),
    generatedAt: new Date().toISOString(),
  }
}
