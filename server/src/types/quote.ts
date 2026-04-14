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
