export type ProjectType = 'renovation' | 'consulting' | 'installation' | 'maintenance'

export type ScopeLevel = 'small' | 'medium' | 'large'

export type UrgencyLevel = 'normal' | 'fast' | 'immediate'

export type QuoteClientRequest = {
  clientName: string
  projectType: ProjectType
  scope: ScopeLevel
  urgency: UrgencyLevel
  requirements: string
}

export type GeneratedQuote = {
  estimatedPrice: number
  estimatedDays: number
  confidence: number
  summary: string
  assumptions: string[]
  generatedAt: string
}
