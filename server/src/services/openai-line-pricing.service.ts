import { env } from '../config/env.js'

export type OpenAiLineCalibrationInput = {
  id: string
  itemKey: string
  description: string
  unit: string
  quantity: number
  currentUnitPrice: number
  pricingMethod: string
  coverageTier: 'high' | 'medium' | 'low'
  priceStats: {
    min: number
    median: number
    avg: number
    max: number
  }
  sourceExamples: Array<{ quantity: number; unitPrice: number }>
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

function buildPrompt(lines: OpenAiLineCalibrationInput[], requirements: string): string {
  return [
    'Adjust unit prices for line-items using the provided grounded context only.',
    'Rules:',
    '- Never ignore currentUnitPrice; it is the grounded base price from historical data.',
    '- Prefer no change when coverageTier is low.',
    '- For larger quantities, avoid increasing unit price unless strongly justified by context.',
    '- Output strict JSON only: {"items":[{"id":"...","unitPrice":123.45}]}',
    '- Do not include any extra keys.',
    `Client requirements: ${requirements || 'none'}`,
    `Grounded lines: ${JSON.stringify(lines)}`,
  ].join('\n')
}

export async function calibrateUnitPricesWithOpenAi(
  lines: OpenAiLineCalibrationInput[],
  requirements: string,
): Promise<Map<string, number> | null> {
  if (!env.openAiApiKey || lines.length === 0) {
    return null
  }

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
          content: 'You are a pricing calibration assistant and must return JSON only.',
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
