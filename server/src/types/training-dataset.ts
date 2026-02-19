import type { PricingUnit } from './model-profile.js'
import type { CustomFeatureValue } from './custom-feature.js'

export type DatasetSplit = 'train' | 'validation' | 'test'

export type DatasetExampleSource = 'uploaded_document' | 'approved_quote'

export type TrainingDatasetExample = {
  id: string
  serviceProviderUid: string
  source: DatasetExampleSource
  sourceDocumentId: string | null
  sourceQuoteDate: string | null
  sourceQuoteId: string | null
  sourceTrainingJobId: string | null
  itemKey: string
  itemName: string
  unit: PricingUnit | 'custom'
  quantity: number
  lineTotal: number
  targetUnitPrice: number
  featureProjectType: string | null
  featureScope: string | null
  featureUrgency: string | null
  featureRequirements: string | null
  featureInventorySurplus: number | null
  featureAvailableWorkers: number | null
  featureDynamicValues: Record<string, CustomFeatureValue>
  featureDynamicVisibility: Record<string, boolean>
  split: DatasetSplit
  createdAt: string
  updatedAt: string
}

export type DatasetSplitCounts = {
  train: number
  validation: number
  test: number
}

export type TrainingDatasetItemStats = {
  itemKey: string
  itemName: string
  unit: PricingUnit | 'custom'
  exampleCount: number
  documentCount: number
}

export type TrainingDatasetStats = {
  id: string
  serviceProviderUid: string
  totalExamples: number
  splitCounts: DatasetSplitCounts
  uniqueItems: number
  sourceCounts: Record<DatasetExampleSource, number>
  itemStats: TrainingDatasetItemStats[]
  generatedAt: string
}

export type RebuildTrainingDatasetResult = {
  totalExamples: number
  splitCounts: DatasetSplitCounts
  uniqueItems: number
}
