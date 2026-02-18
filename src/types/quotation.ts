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
  estimatedPrice: number
  estimatedDays: number
  confidence: number
  summary: string
  assumptions: string[]
  generatedAt: string
}

export type ClientRequestForm = {
  clientName: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
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

export type QuoteSource = 'openai' | 'fallback'
