import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { resolveCpiAdjustmentForQuote } from './cpi-quote-factor.service.js'
import { listLearnedPricingItems } from './dynamic-form-schema.service.js'
import { exactMatchUnitPrice, estimateUnitPriceLinear } from './line-pricing-utils.service.js'
import { calibrateUnitPricesWithOpenAi } from './openai-line-pricing.service.js'
import { applyCpiFactorToUnitPrice } from './quote-pricing-adjustments.service.js'
import type { LearnedPricingItem, PricingUnit } from '../types/model-profile.js'
import type { GeneratedQuote, QuoteClientRequest, QuoteLineItem } from '../types/quote.js'

type GenerateLearnedQuoteInput = {
  serviceProviderUid: string
  request: QuoteClientRequest
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolveLabel(item: LearnedPricingItem, fallbackLabel: string): string {
  const alias = item.aliases?.find((name) => name.trim().length > 0)
  return (alias ?? fallbackLabel).trim() || item.canonicalName
}

function toItemKey(item: LearnedPricingItem): string {
  return `${item.canonicalName}|${item.unit}`
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

function estimateConfidence(
  lineItems: QuoteLineItem[],
  learnedItemsById: Map<string, LearnedPricingItem>,
): number {
  if (lineItems.length === 0) {
    return 55
  }

  const score = lineItems.reduce((sum, line) => {
    if (!line.sourceItemId) {
      return sum + 0.45
    }
    const learned = learnedItemsById.get(line.sourceItemId)
    if (!learned) {
      return sum + 0.5
    }
    const inRange =
      line.quantity >= learned.quantity.min && line.quantity <= learned.quantity.max
    const sampleScore = Math.min(1, learned.sampleLines / 10)
    return sum + sampleScore * 0.7 + (inRange ? 0.3 : 0.12)
  }, 0)

  const normalizedScore = score / lineItems.length
  return Math.round(clamp(52 + normalizedScore * 46, 45, 98))
}

export async function generateLearnedQuote(
  input: GenerateLearnedQuoteInput,
): Promise<GeneratedQuote | null> {
  const learnedItems = await listLearnedPricingItems(input.serviceProviderUid)
  if (learnedItems.length === 0) {
    return null
  }

  const learnedById = new Map(learnedItems.map((item) => [item.id, item]))
  const requestedItems = (input.request.requestedItems ?? []).filter(
    (item) => Number.isFinite(item.quantity) && item.quantity > 0,
  )

  const lineItems = requestedItems
    .map((requested, index) => ({ requested, index }))
    .map((requested) => {
      const learned = learnedById.get(requested.requested.sourceItemId)
      if (!learned) {
        return null
      }

      const quantity = round2(requested.requested.quantity)
      const exactLockedPrice = exactMatchUnitPrice(learned, quantity)
      const unitPrice = estimateUnitPriceLinear(learned, quantity)
      return {
        id: `${requested.requested.sourceItemId}_${Date.now()}_${requested.index}`,
        sourceItemId: learned.id,
        itemKey: toItemKey(learned),
        description: resolveLabel(learned, requested.requested.label),
        unit: learned.unit,
        quantity,
        unitPrice: exactLockedPrice ?? unitPrice,
        exactLockedPrice,
        lineTotal: 0,
      }
    })
    .filter((line): line is NonNullable<typeof line> => line !== null)

  if (lineItems.length === 0) {
    return null
  }

  const lineSamples = new Map(
    learnedItems.map((item) => [item.id, item.quantityPriceSamples ?? []]),
  )
  try {
    const calibrated = await calibrateUnitPricesWithOpenAi(
      lineItems,
      lineSamples,
      input.request.requirements,
    )
    if (calibrated) {
      const calibrationMaxDelta = 0.08
      lineItems.forEach((line) => {
        if (line.exactLockedPrice !== null) {
          line.unitPrice = line.exactLockedPrice
          return
        }
        const nextUnitPrice = calibrated.get(line.id)
        if (nextUnitPrice === undefined) {
          return
        }
        const minAllowed = line.unitPrice * (1 - calibrationMaxDelta)
        const maxAllowed = line.unitPrice * (1 + calibrationMaxDelta)
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
  const confidence = estimateConfidence(lineItems, learnedById)

  return buildQuoteFromLineItems({
    lineItems: lineItems.map(({ exactLockedPrice: _ignore, itemKey: _ignore2, ...line }) => line),
    pricingAdjustments: { cpi: cpiAdjustment },
    vatRate: 17,
    estimatedDays,
    confidence,
    summary: `חישוב לפי ${lineItems.length} רכיבים וכמויות שהוזנו בטופס הלקוח.`,
    assumptions: [
      'מחיר יחידה לכל רכיב חושב ליניארית לפי היסטוריית הצעות מחיר.',
      'ככל שהכמות עולה, מחיר היחידה יורד בטווח שנלמד מנתוני העבר.',
      'הסכום הסופי כולל מע״מ 17%.',
    ],
  })
}
