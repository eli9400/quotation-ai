import { randomUUID } from 'node:crypto'
import { estimateMarketUnitPricesWithOpenAi } from './market-line-pricing.service.js'
import { normalizeRequestedUnit, round2 } from './learned-quote-utils.service.js'
import type { QuoteClientRequest, QuoteLineItem, QuoteRequestedItem } from '../types/quote.js'

type InternalPricedLine = QuoteLineItem & {
  itemKey: string | null
  baseUnitPrice: number
  pricingMethod: string
  coverageTier: 'high' | 'medium' | 'low'
  needsManualReview: boolean
}

type MarketLineInput = {
  id: string
  label: string
  quantity: number
  unit: QuoteLineItem['unit']
}

function toMarketInputs(requestedItems: QuoteRequestedItem[]): MarketLineInput[] {
  return requestedItems
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item, index) => ({
      id: `market_${index}`,
      label: item.label.trim() || `רכיב ${index + 1}`,
      quantity: round2(item.quantity),
      unit: normalizeRequestedUnit(item.unit),
    }))
}

export async function buildMarketPricedLines(
  request: QuoteClientRequest,
  requestedItems: QuoteRequestedItem[],
): Promise<InternalPricedLine[]> {
  const linesInput = toMarketInputs(requestedItems)
  if (linesInput.length === 0) return []

  let estimates: Map<string, { unitPrice: number; reason: string }> | null = null
  try {
    estimates = await estimateMarketUnitPricesWithOpenAi({
      lines: linesInput.map((line) => ({
        id: line.id,
        label: line.label,
        quantity: line.quantity,
        unit: line.unit,
      })),
      projectType: request.projectType,
      scope: request.scope,
      urgency: request.urgency,
      requirements: request.requirements,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.warn(`[learned-quote] OpenAI market pricing skipped: ${message}`)
  }

  return linesInput.map((item, index) => {
    const estimate = estimates?.get(item.id)
    const unitPrice = round2(Math.max(0, estimate?.unitPrice ?? 0))
    return {
      id: `${randomUUID()}_${index}`,
      sourceItemId: null,
      description: item.label,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(unitPrice * item.quantity),
      itemKey: null,
      baseUnitPrice: unitPrice,
      pricingMethod: estimate ? 'market_llm' : 'market_manual_review',
      coverageTier: 'low',
      needsManualReview: true,
    }
  })
}
