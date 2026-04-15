import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { resolveCpiAdjustmentForQuote } from './cpi-quote-factor.service.js'
import {
  applyBoundedReasoningAdjustment,
  calibrationDeltaForLine,
  estimateConfidence,
  estimateDays,
} from './learned-quote-utils.service.js'
import { buildMarketPricedLines } from './market-quote-lines.service.js'
import { calibrateUnitPricesWithOpenAi } from './openai-line-pricing.service.js'
import { buildGroundedPricingLines } from './pricing-engine.service.js'
import { listProviderPricingItemsWithIndustryBaseline } from './pricing-items-source.service.js'
import {
  buildGroundedLineExplainability,
  buildMarketLineExplainability,
  toAnomalyAssumptions,
} from './quote-line-explainability.service.js'
import { applyCpiFactorToUnitPrice } from './quote-pricing-adjustments.service.js'
import { resolveRequestedSourceItemId } from './requested-item-grounding.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { GeneratedQuote, QuoteClientRequest, QuoteLineItem, QuoteRequestedItem } from '../types/quote.js'

type GenerateLearnedQuoteInput = {
  serviceProviderUid: string
  request: QuoteClientRequest
}

type InternalPricedLine = QuoteLineItem & {
  itemKey: string | null
  baseUnitPrice: number
  pricingMethod: string
  coverageTier: 'high' | 'medium' | 'low'
  needsManualReview: boolean
}

function buildInferenceRoutingKey(request: QuoteClientRequest): string {
  return [
    request.clientEmail,
    request.projectType,
    request.scope,
    request.urgency,
    request.requirements.slice(0, 240),
  ].join('|')
}

function toPersistedLineItems(lines: InternalPricedLine[]): QuoteLineItem[] {
  return lines.map((line) => ({
    id: line.id,
    sourceItemId: line.sourceItemId,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    explainability: line.explainability ?? null,
  }))
}

function toHybridAssumptions(input: {
  lineCount: number
  manualReviewCount: number
  marketCount: number
  skippedCount: number
  anomalyAssumptions: string[]
}): string[] {
  return [
    `Hybrid engine path applied on ${input.lineCount} line(s): rules -> ML blend -> LLM explanation.`,
    `Manual review recommended for ${input.manualReviewCount} line(s).`,
    `Market-only pricing (no learned history): ${input.marketCount} line(s).`,
    `Requested items skipped due unresolved source mapping: ${input.skippedCount}.`,
    ...input.anomalyAssumptions,
  ]
}

export async function generateLearnedQuote(
  input: GenerateLearnedQuoteInput,
): Promise<GeneratedQuote | null> {
  const profile = await getServiceProviderByUid(input.serviceProviderUid)
  const learnedItems = await listProviderPricingItemsWithIndustryBaseline(
    input.serviceProviderUid,
    profile?.industry ?? '',
  )
  if (learnedItems.length === 0) return null

  const requestedItems = (input.request.requestedItems ?? []).filter(
    (item) => Number.isFinite(item.quantity) && item.quantity > 0,
  )
  if (requestedItems.length === 0) return null

  const learnedById = new Map(learnedItems.map((item) => [item.id, item]))
  const groundedRequested: Array<QuoteRequestedItem & { sourceItemId: string }> = []
  const marketRequested: QuoteRequestedItem[] = []
  requestedItems.forEach((item) => {
    const sourceItemId =
      typeof item.sourceItemId === 'string' && item.sourceItemId.trim().length > 0
        ? item.sourceItemId.trim()
        : null
    if (sourceItemId && learnedById.has(sourceItemId)) {
      groundedRequested.push({ ...item, sourceItemId })
      return
    }
    const resolvedSourceItemId = resolveRequestedSourceItemId(item, learnedItems)
    if (resolvedSourceItemId && learnedById.has(resolvedSourceItemId)) {
      groundedRequested.push({ ...item, sourceItemId: resolvedSourceItemId })
      return
    }
    marketRequested.push(item)
  })

  const grounded = await buildGroundedPricingLines({
    serviceProviderUid: input.serviceProviderUid,
    requestedItems: groundedRequested,
    learnedItems,
    inferenceRoutingKey: buildInferenceRoutingKey(input.request),
    industry: profile?.industry ?? null,
    requestFeatures: {
      projectType: input.request.projectType,
      scope: input.request.scope,
      urgency: input.request.urgency,
      requirements: input.request.requirements,
    },
  })
  const groundedByLineId = new Map(grounded.lines.map((line) => [line.id, line]))

  const lineItems: InternalPricedLine[] = grounded.lines.map((line) => ({
    id: line.id,
    sourceItemId: line.sourceItemId,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.baseUnitPrice,
    lineTotal: line.baseLineTotal,
    itemKey: line.itemKey,
    baseUnitPrice: line.baseUnitPrice,
    pricingMethod: line.pricingMethod,
    coverageTier: line.coverage.tier,
    needsManualReview: line.needsManualReview,
    explainability: null,
  }))

  const llmAdjustmentByLineId = new Map<string, number>()
  if (lineItems.length > 0) {
    try {
      const calibrated = await calibrateUnitPricesWithOpenAi(
        grounded.lines.map((line) => ({
          id: line.id,
          itemKey: line.itemKey,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity,
          currentUnitPrice: line.baseUnitPrice,
          pricingMethod: line.pricingMethod,
          coverageTier: line.coverage.tier,
          priceStats: line.priceStats,
          sourceExamples: line.sourceExamples,
        })),
        input.request.requirements,
      )
      if (calibrated) {
        lineItems.forEach((line) => {
          const adjustment = calibrated.get(line.id)
          if (!adjustment) return
          line.unitPrice = applyBoundedReasoningAdjustment(
            line.baseUnitPrice,
            adjustment.adjustmentPct,
            calibrationDeltaForLine(line),
          )
          if (line.baseUnitPrice > 0) {
            llmAdjustmentByLineId.set(line.id, (line.unitPrice - line.baseUnitPrice) / line.baseUnitPrice)
          }
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      console.warn(`[learned-quote] OpenAI calibration skipped: ${message}`)
    }
  }

  let cpiAdjustment: GeneratedQuote['pricingAdjustments']['cpi'] = null
  if (lineItems.length > 0) {
    try {
      cpiAdjustment = await resolveCpiAdjustmentForQuote({
        serviceProviderUid: input.serviceProviderUid,
        itemKeys: Array.from(new Set(lineItems.map((line) => line.itemKey).filter((value): value is string => Boolean(value)))),
        itemQuantities: lineItems
          .filter((line) => line.itemKey)
          .map((line) => ({ itemKey: line.itemKey ?? '', quantity: line.quantity })),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      console.warn(`[learned-quote] CPI factor resolution skipped: ${message}`)
    }
  }
  if (cpiAdjustment?.enabled) {
    lineItems.forEach((line) => {
      if (line.sourceItemId) line.unitPrice = applyCpiFactorToUnitPrice(line.unitPrice, cpiAdjustment)
    })
  }

  const marketLines = await buildMarketPricedLines(input.request, marketRequested)
  const allLines: InternalPricedLine[] = [...lineItems, ...marketLines].map((line) => {
    const groundedLine = groundedByLineId.get(line.id)
    if (groundedLine) {
      return {
        ...line,
        explainability: buildGroundedLineExplainability(
          groundedLine,
          llmAdjustmentByLineId.get(line.id) ?? null,
        ),
      }
    }
    return { ...line, explainability: buildMarketLineExplainability(line.pricingMethod) }
  })
  if (allLines.length === 0) return null

  const persistedLineItems = toPersistedLineItems(allLines)
  const anomalyAssumptions = toAnomalyAssumptions(persistedLineItems)
  const manualReviewCount = allLines.filter((line) => line.needsManualReview).length
  const marketCount = marketLines.length

  return buildQuoteFromLineItems({
    lineItems: persistedLineItems,
    pricingAdjustments: { cpi: cpiAdjustment },
    vatRate: 17,
    estimatedDays: estimateDays(allLines),
    confidence: estimateConfidence(
      allLines.map((line) => ({ coverageTier: line.coverageTier, needsManualReview: line.needsManualReview })),
    ),
    summary: `Pricing generated for ${allLines.length} requested line-item(s) using learned provider history.`,
    assumptions: toHybridAssumptions({
      lineCount: allLines.length,
      manualReviewCount,
      marketCount,
      skippedCount: grounded.skippedSourceItemIds.length,
      anomalyAssumptions,
    }),
  })
}
