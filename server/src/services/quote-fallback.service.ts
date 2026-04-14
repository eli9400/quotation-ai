import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import type { GeneratedQuote, QuoteClientRequest } from '../types/quote.js'

type GenerateFallbackQuoteInput = {
  request: QuoteClientRequest
}

function fallbackUnitPrice(quantity: number): number {
  const base = 280
  const normalizedQuantity = Math.max(1, quantity)
  const discount = Math.min(0.22, Math.log10(normalizedQuantity) * 0.09)
  return Math.round(base * (1 - discount))
}

export function generateFallbackQuote({
  request,
}: GenerateFallbackQuoteInput): GeneratedQuote {
  const quantity =
    (request.requestedItems ?? []).reduce((sum, item) => sum + Math.max(0, item.quantity), 0) || 1
  const unitPrice = fallbackUnitPrice(quantity)
  const description =
    request.requirements.trim().length > 0
      ? `אומדן עבודה: ${request.requirements.slice(0, 90)}`
      : 'אומדן עבודה כללי'

  return buildQuoteFromLineItems({
    lineItems: [
      {
        id: 'fallback_line',
        sourceItemId: null,
        description,
        unit: 'custom',
        quantity,
        unitPrice,
        lineTotal: 0,
      },
    ],
    vatRate: 17,
    estimatedDays: Math.max(1, Math.ceil(quantity / 10)),
    confidence: 55,
    summary: 'לא זוהו מספיק רכיבים תואמים מהיסטוריית המחירים, חושב אומדן כללי.',
    assumptions: [
      'זהו חישוב גיבוי עד להוספת עוד דוגמאות למחירון ההיסטורי.',
      'מומלץ לעבור ידנית על מחיר היחידה לפני אישור.',
    ],
  })
}
