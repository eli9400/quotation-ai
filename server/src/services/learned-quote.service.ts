import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { resolveCpiAdjustmentForQuote } from './cpi-quote-factor.service.js'
import { listLearnedPricingItems } from './dynamic-form-schema.service.js'
import { calibrateUnitPricesWithOpenAi } from './openai-line-pricing.service.js'
import { buildGroundedPricingLines } from './pricing-engine.service.js'
import { applyCpiFactorToUnitPrice } from './quote-pricing-adjustments.service.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { GeneratedQuote, QuoteClientRequest, QuoteLineItem } from '../types/quote.js'

type GenerateLearnedQuoteInput = {
  serviceProviderUid: string
  request: QuoteClientRequest
}

type InternalPricedLine = QuoteLineItem & {
  itemKey: string
  baseUnitPrice: number
  pricingMethod: string
  coverageTier: 'high' | 'medium' | 'low'
  needsManualReview: boolean
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function workloadWeight(unit: PricingUnit): number {
  switch (unit) {
    case 'sqm':
      return 0.045
    case 'point':
      return 0.2
    case 'day':
      return 1
    case 'container':
      return 0.4
    case 'package':
      return 0.6
    case 'meter':
      return 0.04
    case 'unit':
      return 0.28
    case 'hour':
      return 0.12
    case 'fixed':
      return 0.5
    default:
      return 0.18
  }
}

function estimateDays(lineItems: QuoteLineItem[]): number {
  const workUnits = lineItems.reduce(
    (sum, line) =>
      sum + line.quantity * workloadWeight(line.unit === 'custom' ? 'unknown' : line.unit),
    0,
  )
  return Math.max(1, Math.ceil(workUnits / 8))
}

function estimateConfidence(lines: Array<{ coverageTier: 'high' | 'medium' | 'low'; needsManualReview: boolean }>): number {
  if (lines.length === 0) {
    return 55
  }

  const score = lines.reduce((sum, line) => {
    if (line.needsManualReview) {
      return sum + 0.45
    }
    if (line.coverageTier === 'high') {
      return sum + 1
    }
    if (line.coverageTier === 'medium') {
      return sum + 0.76
    }
    return sum + 0.56
  }, 0)

  return Math.round(clamp(50 + (score / lines.length) * 46, 42, 98))
}

function calibrationDeltaForLine(line: InternalPricedLine): number {
  if (line.needsManualReview) {
    return 0.05
  }
  if (line.coverageTier === 'high') {
    return 0.15
  }
  if (line.coverageTier === 'medium') {
    return 0.1
  }
  return 0.05
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
  const learnedItems = await listLearnedPricingItems(input.serviceProviderUid)
  if (learnedItems.length === 0) {
    return null
  }

  const requestedItems = (input.request.requestedItems ?? []).filter(
    (item) => Number.isFinite(item.quantity) && item.quantity > 0,
  )

  const grounded = await buildGroundedPricingLines({
    serviceProviderUid: input.serviceProviderUid,
    requestedItems,
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

  if (lineItems.length === 0) {
    return null
  }

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
        const nextUnitPrice = calibrated.get(line.id)
        if (nextUnitPrice === undefined) {
          return
        }
        const delta = calibrationDeltaForLine(line)
        const minAllowed = line.baseUnitPrice * (1 - delta)
        const maxAllowed = line.baseUnitPrice * (1 + delta)
        line.unitPrice = round2(clamp(nextUnitPrice, minAllowed, maxAllowed))
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.warn(`[learned-quote] OpenAI calibration skipped: ${message}`)
  }

  let cpiAdjustment: GeneratedQuote['pricingAdjustments']['cpi'] = null
  try {
    cpiAdjustment = await resolveCpiAdjustmentForQuote({
      serviceProviderUid: input.serviceProviderUid,
      itemKeys: Array.from(new Set(lineItems.map((line) => line.itemKey))),
      itemQuantities: lineItems.map((line) => ({
        itemKey: line.itemKey,
        quantity: line.quantity,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.warn(`[learned-quote] CPI factor resolution skipped: ${message}`)
  }

  if (cpiAdjustment?.enabled) {
    lineItems.forEach((line) => {
      line.unitPrice = applyCpiFactorToUnitPrice(line.unitPrice, cpiAdjustment)
    })
  }

  const estimatedDays = estimateDays(lineItems)
  const confidence = estimateConfidence(
    lineItems.map((line) => ({
      coverageTier: line.coverageTier,
      needsManualReview: line.needsManualReview,
    })),
  )
  const manualReviewCount = lineItems.filter((line) => line.needsManualReview).length

  return buildQuoteFromLineItems({
    lineItems: toPersistedLineItems(lineItems),
    pricingAdjustments: { cpi: cpiAdjustment },
    vatRate: 17,
    estimatedDays,
    confidence,
    summary: `תמחור מבוסס היסטוריה נבנה עבור ${lineItems.length} רכיבי עבודה שביקש הלקוח.`,
    assumptions: [
      'מחיר הבסיס לכל שורה חושב מנתוני עבר מאומתים של אותו רכיב.',
      'שיטת החישוב הראשית: חציון לפי טווחי כמות, עם גיבוי אינטרפולציה לינארית בעת צורך.',
      `מומלץ מעבר ידני עבור ${manualReviewCount} שורות עם כיסוי נתונים נמוך.`,
      `רכיבים שלא זוהו ולכן לא חושבו: ${grounded.skippedSourceItemIds.length}.`,
      'מע״מ 17% מחושב על סכום הביניים.',
    ],
  })
}
