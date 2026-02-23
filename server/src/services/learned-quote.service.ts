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
import { listProviderPricingItemsWithIndustryBaseline } from './pricing-items-source.service.js'
import { buildGroundedPricingLines } from './pricing-engine.service.js'
import { applyCpiFactorToUnitPrice } from './quote-pricing-adjustments.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type {
  GeneratedQuote,
  QuoteClientRequest,
  QuoteLineItem,
  QuoteRequestedItem,
} from '../types/quote.js'

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

function toPersistedLineItems(lines: InternalPricedLine[]): QuoteLineItem[] {
  return lines.map((line) => ({
    id: line.id,
    sourceItemId: line.sourceItemId,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  }))
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
    marketRequested.push(item)
  })

  const grounded = await buildGroundedPricingLines({
    serviceProviderUid: input.serviceProviderUid,
    requestedItems: groundedRequested,
    learnedItems,
  })

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
  }))

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
        itemKeys: Array.from(
          new Set(
            lineItems
              .map((line) => line.itemKey)
              .filter((itemKey): itemKey is string => typeof itemKey === 'string' && itemKey.length > 0),
          ),
        ),
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
      if (!line.sourceItemId) return
      line.unitPrice = applyCpiFactorToUnitPrice(line.unitPrice, cpiAdjustment)
    })
  }

  const marketLines = await buildMarketPricedLines(input.request, marketRequested)
  const allLines = [...lineItems, ...marketLines]
  if (allLines.length === 0) return null

  const estimatedDays = estimateDays(allLines)
  const confidence = estimateConfidence(
    allLines.map((line) => ({
      coverageTier: line.coverageTier,
      needsManualReview: line.needsManualReview,
    })),
  )
  const manualReviewCount = allLines.filter((line) => line.needsManualReview).length
  const marketCount = marketLines.length

  return buildQuoteFromLineItems({
    lineItems: toPersistedLineItems(allLines),
    pricingAdjustments: { cpi: cpiAdjustment },
    vatRate: 17,
    estimatedDays,
    confidence,
    summary: `תמחור מבוסס היסטוריה נבנה עבור ${allLines.length} רכיבי עבודה שביקש הלקוח.`,
    assumptions: [
      'מחיר הבסיס לכל שורה חושב מנתוני עבר מאומתים של אותו רכיב.',
      'שיטת החישוב הראשית: חציון לפי טווחי כמות, עם גיבוי אינטרפולציה לינארית בעת צורך.',
      `מומלץ מעבר ידני עבור ${manualReviewCount} שורות עם כיסוי נתונים נמוך או רכיב חדש.`,
      `רכיבים חדשים ללא היסטוריה שתומחרו לפי ממוצע שוק (LLM): ${marketCount}.`,
      `רכיבים שלא זוהו ולכן לא חושבו: ${grounded.skippedSourceItemIds.length}.`,
      'מע"מ 17% מחושב על סכום הביניים.',
    ],
  })
}
