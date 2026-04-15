import type { PricingUnit } from './model-profile.js'
import type { CustomFeatureValueType } from './custom-feature.js'

export type ProjectType = 'renovation' | 'consulting' | 'installation' | 'maintenance'

export type ScopeLevel = 'small' | 'medium' | 'large'

export type UrgencyLevel = 'normal' | 'fast' | 'immediate'

export type QuoteClientRequest = {
  clientName: string
  clientEmail: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
  requestedItems?: QuoteRequestedItem[]
}

export type QuoteRequestedItem = {
  sourceItemId: string | null
  label: string
  quantity: number
  unit?: PricingUnit | 'custom'
}

export type QuoteLineItem = {
  id: string
  sourceItemId: string | null
  description: string
  unit: PricingUnit | 'custom'
  quantity: number
  unitPrice: number
  lineTotal: number
  explainability?: QuoteLineExplainability | null
}

export type QuoteLineAnomalyWarning = {
  code:
    | 'low_coverage'
    | 'manual_review'
    | 'clamped_price'
    | 'global_fallback'
    | 'high_uncertainty'
    | 'llm_large_adjustment'
    | 'similar_item_fallback'
    | 'market_pricing'
  severity: 'info' | 'warn'
  message: string
}

export type QuoteLineExplainability = {
  pipeline: 'rules_only' | 'rules_ml' | 'rules_ml_llm' | 'llm_market'
  pricingMethod: string
  coverageTier: 'high' | 'medium' | 'low' | 'n/a'
  referenceItemKey: string | null
  categoryId: string | null
  modelSource: 'direct_item_unit' | 'unit_fallback' | 'global_fallback' | 'none'
  modelUncertainty: number | null
  llmAdjustmentPct: number | null
  anomalyWarnings: QuoteLineAnomalyWarning[]
}

export type QuoteCustomField = {
  id: string
  key: string
  label: string
  valueType: CustomFeatureValueType
  value: string | number | boolean | null
  showInQuoteDetails: boolean
}

export type QuoteCpiAdjustment = {
  enabled: boolean
  factor: number
  sourceYear: number | null
  targetYear: number | null
}

export type QuotePricingAdjustments = {
  cpi: QuoteCpiAdjustment | null
}

export type GeneratedQuote = {
  lineItems: QuoteLineItem[]
  customFields: QuoteCustomField[]
  pricingAdjustments: QuotePricingAdjustments
  subtotalBeforeVat: number
  vatRate: number
  vatAmount: number
  estimatedPrice: number
  estimatedDays: number
  confidence: number
  summary: string
  assumptions: string[]
  generatedAt: string
}

export type QuoteSource = 'openai' | 'fallback' | 'learned'

export type QuoteApprovalStatus = 'draft' | 'approved' | 'completed'

export type StoredQuote = {
  id: string
  serviceProviderUid: string
  trainingJobId: string
  source: QuoteSource
  clientRequest: QuoteClientRequest
  quote: GeneratedQuote
  status: QuoteApprovalStatus
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  completedAt: string | null
  approvedByServiceProviderUid: string | null
  clientRevisionPending: boolean
}
