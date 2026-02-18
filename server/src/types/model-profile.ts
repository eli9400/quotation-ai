export type PricingUnit =
  | 'sqm'
  | 'unit'
  | 'hour'
  | 'meter'
  | 'fixed'
  | 'unknown'

export type NumericRange = {
  min: number
  avg: number
  max: number
  sampleCount: number
}

export type LearnedPricingItem = {
  id: string
  serviceProviderUid: string
  canonicalName: string
  aliases: string[]
  unit: PricingUnit
  pricePerUnit: NumericRange
  quantity: NumericRange
  lineTotal: NumericRange
  quantityPriceSamples: Array<{
    quantity: number
    unitPrice: number
  }>
  sampleLines: number
  lastUpdatedAt: string
}

export type DynamicFieldType = 'number' | 'text' | 'select' | 'textarea'

export type DynamicFormField = {
  id: string
  label: string
  type: DynamicFieldType
  required: boolean
  order: number
  sourceItemId: string | null
  placeholder: string | null
  hint: string | null
  options: string[]
}

export type DynamicFormSchema = {
  id: string
  serviceProviderUid: string
  version: number
  generatedAt: string
  sourceItemsCount: number
  fields: DynamicFormField[]
}

export type ModelProfile = {
  id: string
  serviceProviderUid: string
  version: number
  trainedDocumentsCount: number
  parsedLinesCount: number
  learnedItemsCount: number
  failedDocumentsCount: number
  lastTrainingJobId: string | null
  lastTrainedAt: string | null
  createdAt: string
  updatedAt: string
}
