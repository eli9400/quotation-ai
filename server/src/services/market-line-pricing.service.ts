import { env } from '../config/env.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { ProjectType, ScopeLevel, UrgencyLevel } from '../types/quote.js'

export type MarketLineInput = {
  id: string
  label: string
  quantity: number
  unit: PricingUnit | 'custom'
}

export type MarketLineEstimate = {
  unitPrice: number
  reason: string
}

type OpenAiRawItem = {
  id?: unknown
  unitPrice?: unknown
  reason?: unknown
}

type OpenAiRawPayload = {
  items?: OpenAiRawItem[]
}

function toJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function toReason(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function maxUnitPrice(unit: MarketLineInput['unit']): number {
  if (unit === 'sqm') return 2_000
  if (unit === 'point') return 5_000
  if (unit === 'day') return 8_000
  if (unit === 'container') return 30_000
  if (unit === 'package') return 500_000
  if (unit === 'hour') return 1_000
  if (unit === 'meter') return 5_000
  return 60_000
}

function buildPrompt(input: {
  lines: MarketLineInput[]
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
}): string {
  return [
    'Estimate market-average unit prices in ILS for requested service lines in Israel.',
    'Use practical market pricing, conservative and realistic.',
    'Return strict JSON only: {"items":[{"id":"...","unitPrice":123.45,"reason":"..."}]}',
    'Rules:',
    '- unitPrice must be > 0',
    '- price should be for one unit of the line unit',
    '- if uncertain, return best practical market average with short reason',
    `Project type: ${input.projectType}`,
    `Scope: ${input.scope}`,
    `Urgency: ${input.urgency}`,
    `Requirements: ${input.requirements || 'none'}`,
    `Lines: ${JSON.stringify(input.lines)}`,
  ].join('\n')
}

export async function estimateMarketUnitPricesWithOpenAi(input: {
  lines: MarketLineInput[]
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
}): Promise<Map<string, MarketLineEstimate> | null> {
  if (!env.openAiApiKey || input.lines.length === 0) return null

  const response = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.openAiModel,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are a market pricing assistant and must return JSON only.' },
        { role: 'user', content: buildPrompt(input) },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI market pricing failed with status ${response.status}`)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
  const parsed = toJson<OpenAiRawPayload>(payload.choices?.[0]?.message?.content ?? '')
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : []

  const linesById = new Map(input.lines.map((line) => [line.id, line]))
  const estimates = new Map<string, MarketLineEstimate>()
  rawItems.forEach((rawItem) => {
    const id = typeof rawItem.id === 'string' ? rawItem.id : ''
    const line = linesById.get(id)
    const rawPrice = toNumber(rawItem.unitPrice)
    if (!id || !line || rawPrice === null || rawPrice <= 0) return
    const safeUnitPrice = Math.max(0.1, Math.min(rawPrice, maxUnitPrice(line.unit)))
    estimates.set(id, {
      unitPrice: Math.round(safeUnitPrice * 100) / 100,
      reason: toReason(rawItem.reason),
    })
  })

  return estimates.size > 0 ? estimates : null
}
