export type ProjectType = 'renovation' | 'consulting' | 'installation' | 'maintenance'

export type ScopeLevel = 'small' | 'medium' | 'large'

export type UrgencyLevel = 'normal' | 'fast' | 'immediate'

export type UploadedDocument = {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
}

export type Quote = {
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

export type QuoteLineItem = {
  id: string
  sourceItemId: string | null
  description: string
  unit: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type QuoteCustomField = {
  id: string
  key: string
  label: string
  valueType: 'number' | 'text' | 'boolean'
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

export type ClientRequestForm = {
  clientName: string
  clientEmail: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
  requestedItems?: Array<{
    sourceItemId: string | null
    label: string
    quantity: number
    unit?: string
  }>
}

export type TrainingStatus = 'running' | 'completed' | 'failed'

export type TrainingJob = {
  id: string
  status: TrainingStatus
  progress: number
  documentIds: string[]
  startedAt: string
  updatedAt: string
  completedAt: string | null
  errorMessage: string | null
}

export type QuoteSource = 'openai' | 'fallback' | 'learned'

export type QuoteApprovalStatus = 'draft' | 'approved' | 'completed'

export type StoredQuoteRecord = {
  id: string
  source: QuoteSource
  createdAt: string
  updatedAt: string
  status: QuoteApprovalStatus
  clientRevisionPending: boolean
  approvedAt: string | null
  completedAt: string | null
  clientRequest: ClientRequestForm
  quote: Quote
}

export type FormPreviewField = {
  id: string
  label: string
  type: 'number' | 'text' | 'select' | 'textarea'
  role: 'input_qty' | 'contact' | 'requirements' | 'internal_meta'
  visibleTo: 'client' | 'provider' | 'internal'
  editableBy: 'client' | 'provider' | 'internal'
  required: boolean
  order: number
  sourceItemId: string | null
  placeholder: string | null
  hint: string | null
  options: string[]
}

export type FormPreviewSchema = {
  id: string
  serviceProviderUid: string
  version: number
  generatedAt: string
  sourceItemsCount: number
  fields: FormPreviewField[]
}

export type ProviderLineItemOption = {
  id: string
  label: string
  canonicalName: string
  unit: string
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{
    quantity: number
    unitPrice: number
  }>
  isProviderOnly: boolean
}

export type ProviderCustomFeatureOption = {
  id: string
  key: string
  label: string
  valueType: 'number' | 'text' | 'boolean'
  defaultValue: string | number | boolean | null
  suggestedValue?: string | number | boolean | null
  suggestedSampleCount?: number
  showInQuoteDetails: boolean
}
