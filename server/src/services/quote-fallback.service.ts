import type {
  GeneratedQuote,
  ProjectType,
  QuoteClientRequest,
  ScopeLevel,
  UrgencyLevel,
} from '../types/quote.js'

const PROJECT_BASE_PRICE: Record<ProjectType, number> = {
  renovation: 8000,
  consulting: 4500,
  installation: 6200,
  maintenance: 3000,
}

const SCOPE_MULTIPLIER: Record<ScopeLevel, number> = {
  small: 1,
  medium: 1.35,
  large: 1.75,
}

const URGENCY_MULTIPLIER: Record<UrgencyLevel, number> = {
  normal: 1,
  fast: 1.2,
  immediate: 1.4,
}

const PROJECT_LABEL: Record<ProjectType, string> = {
  renovation: 'שיפוץ',
  consulting: 'ייעוץ מקצועי',
  installation: 'התקנה',
  maintenance: 'תחזוקה',
}

const SCOPE_LABEL: Record<ScopeLevel, string> = {
  small: 'קטן',
  medium: 'בינוני',
  large: 'גדול',
}

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  normal: 'רגילה',
  fast: 'מהירה',
  immediate: 'מיידית',
}

type GenerateFallbackQuoteInput = {
  request: QuoteClientRequest
  documentCount: number
}

export function generateFallbackQuote({
  request,
  documentCount,
}: GenerateFallbackQuoteInput): GeneratedQuote {
  const base = PROJECT_BASE_PRICE[request.projectType]
  const scopeRatio = SCOPE_MULTIPLIER[request.scope]
  const urgencyRatio = URGENCY_MULTIPLIER[request.urgency]
  const docsBoost = Math.min(documentCount * 0.035, 0.18)
  const detailsBoost = Math.min(request.requirements.length / 450, 0.12)
  const confidence = Math.min(0.68 + docsBoost + detailsBoost, 0.96)

  const estimatedPrice = Math.round(
    base * scopeRatio * urgencyRatio * (0.9 + confidence / 2),
  )
  const estimatedDays = Math.max(2, Math.round((scopeRatio * 11) / urgencyRatio))

  return {
    estimatedPrice,
    estimatedDays,
    confidence: Math.round(confidence * 100),
    summary: [
      `סוג פרויקט: ${PROJECT_LABEL[request.projectType]}`,
      `היקף: ${SCOPE_LABEL[request.scope]}`,
      `דחיפות: ${URGENCY_LABEL[request.urgency]}`,
      `מסמכי למידה: ${documentCount}`,
    ].join(' | '),
    assumptions: [
      'המחיר מבוסס על אומדן ראשוני בלבד.',
      'כולל טווח סטנדרטי לעלויות חומר ועבודה.',
      'לא כולל חריגות מיוחדות שלא צוינו בדרישות.',
    ],
    generatedAt: new Date().toISOString(),
  }
}
