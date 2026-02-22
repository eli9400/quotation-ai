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

export type OpenAiLineAdjustment = {
  adjustmentPct: number
  reason: string
}

type OpenAiRawItem = {
  id?: unknown
  adjustmentPct?: unknown
  reason?: unknown
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

function toAdjustmentPct(value: unknown): number | null {
  const parsed = toNumber(value)
  if (parsed === null) {
    return null
  }
  if (Math.abs(parsed) <= 1) {
    return parsed
  }
  if (Math.abs(parsed) <= 100) {
    return parsed / 100
  }
  return null
}

function toReason(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildPrompt(lines: OpenAiLineCalibrationInput[], requirements: string): string {
  return [
    'Adjust line-items using the provided grounded context only.',
    'Rules:',
    '- Never replace currentUnitPrice; it is the grounded base price from historical data.',
    '- Return only a relative adjustment percentage for each line.',
    '- adjustmentPct is decimal (for example: -0.08 means -8%, 0.12 means +12%).',
    '- Keep adjustmentPct between -0.15 and 0.15.',
    '- Keep adjustmentPct conservative. If uncertain, use 0.',
    '- Prefer no change when coverageTier is low.',
    '- For larger quantities, avoid increasing unit price unless strongly justified by context.',
    '- Output strict JSON only: {"items":[{"id":"...","adjustmentPct":0.04,"reason":"short reason"}]}',
    '- Do not include any extra keys.',
    `Client requirements: ${requirements || 'none'}`,
    `Grounded lines: ${JSON.stringify(lines)}`,
  ].join('\n')
}

export async function calibrateUnitPricesWithOpenAi(
  lines: OpenAiLineCalibrationInput[],
  requirements: string,
): Promise<Map<string, OpenAiLineAdjustment> | null> {
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

  const result = new Map<string, OpenAiLineAdjustment>()
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id : ''
    const adjustmentPct = toAdjustmentPct(item.adjustmentPct)
    if (!id || adjustmentPct === null) {
      continue
    }
    result.set(id, {
      adjustmentPct,
      reason: toReason(item.reason),
    })
  }

  return result.size > 0 ? result : null
}
