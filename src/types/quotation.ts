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

export type ClientRequestForm = {
  clientName: string
  clientEmail: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
  requestedItems?: Array<{
    sourceItemId: string
    label: string
    quantity: number
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

export type QuoteApprovalStatus = 'draft' | 'approved'

export type StoredQuoteRecord = {
  id: string
  source: QuoteSource
  createdAt: string
  updatedAt: string
  status: QuoteApprovalStatus
  approvedAt: string | null
  clientRequest: ClientRequestForm
  quote: Quote
}

export type FormPreviewField = {
  id: string
  label: string
  type: 'number' | 'text' | 'select' | 'textarea'
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
