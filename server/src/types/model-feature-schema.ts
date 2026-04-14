import type { ScopeLevel, UrgencyLevel, ProjectType } from './quote.js'

export type ModelFeatureFieldType = 'string' | 'number'

export type ModelFeatureField = {
  name: string
  type: ModelFeatureFieldType
}

export type ModelFeatureSchema = {
  version: string
  fields: ModelFeatureField[]
}

export type ModelFeatureRow = {
  itemKey: string
  unit: string
  quantity: number
  projectType: ProjectType | 'unknown'
  scope: ScopeLevel | 'unknown'
  urgency: UrgencyLevel | 'unknown'
  requirementsState: 'none' | 'present'
  inventorySurplus: number
  availableWorkers: number
  hasInventorySurplus: number
  hasAvailableWorkers: number
}

