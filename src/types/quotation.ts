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
}

export type ClientRequestForm = {
  clientName: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
}
