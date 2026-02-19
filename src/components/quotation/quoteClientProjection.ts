import type { Quote, QuoteLineItem } from '../../types/quotation'
import {
  computeCustomFieldsAdjustment,
  isPercentLikeCustomField,
} from './quoteCustomFieldMath'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function hiddenPercentAdjustment(quote: Quote): number {
  return quote.customFields.reduce((sum, field) => {
    if (field.showInQuoteDetails) {
      return sum
    }
    if (field.valueType !== 'number' || typeof field.value !== 'number') {
      return sum
    }
    if (!Number.isFinite(field.value)) {
      return sum
    }
    if (!isPercentLikeCustomField(field.key, field.label)) {
      return sum
    }
    return sum + field.value
  }, 0)
}

function projectLineWithFactor(line: QuoteLineItem, factor: number): QuoteLineItem {
  const unitPrice = round2(line.unitPrice * factor)
  return {
    ...line,
    unitPrice,
    lineTotal: round2(unitPrice * line.quantity),
  }
}

export type ClientProjectedQuote = {
  lineItems: QuoteLineItem[]
  lineSubtotal: number
  visibleAdjustment: number
  subtotalBeforeVat: number
  vatAmount: number
  estimatedPrice: number
  hiddenPercent: number
}

export function toClientProjectedQuote(quote: Quote): ClientProjectedQuote {
  const hiddenPercent = hiddenPercentAdjustment(quote)
  const factor = Math.max(0, 1 + hiddenPercent / 100)
  const lineItems =
    factor === 1 ? quote.lineItems : quote.lineItems.map((line) => projectLineWithFactor(line, factor))
  const lineSubtotal = round2(lineItems.reduce((sum, line) => sum + line.lineTotal, 0))
  const visibleFields = quote.customFields.filter((field) => field.showInQuoteDetails)
  const visibleAdjustment = round2(computeCustomFieldsAdjustment(visibleFields, lineSubtotal))
  const subtotalBeforeVat = round2(Math.max(0, lineSubtotal + visibleAdjustment))
  const vatAmount = round2((subtotalBeforeVat * quote.vatRate) / 100)
  const estimatedPrice = round2(subtotalBeforeVat + vatAmount)
  return {
    lineItems,
    lineSubtotal,
    visibleAdjustment,
    subtotalBeforeVat,
    vatAmount,
    estimatedPrice,
    hiddenPercent,
  }
}
