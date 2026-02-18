import { projectLabels, scopeLabels, urgencyLabels } from './options'
import type { ClientRequestForm, ProjectType, Quote, ScopeLevel, UrgencyLevel } from '../../types/quotation'

type QuoteInput = {
  request: ClientRequestForm
  documentCount: number
}

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

export function generateQuote({ request, documentCount }: QuoteInput): Quote {
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

  const summary = [
    `סוג פרויקט: ${projectLabels[request.projectType]}`,
    `היקף: ${scopeLabels[request.scope]}`,
    `דחיפות: ${urgencyLabels[request.urgency]}`,
    `מסמכי למידה: ${documentCount}`,
  ].join(' | ')

  return {
    estimatedPrice,
    estimatedDays,
    confidence: Math.round(confidence * 100),
    summary,
  }
}
