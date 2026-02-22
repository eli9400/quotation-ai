export type PricingUnit =
  | 'sqm'
  | 'unit'
  | 'point'
  | 'day'
  | 'container'
  | 'package'
  | 'hour'
  | 'meter'
  | 'fixed'
  | 'percent'
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

export type DynamicFieldType = 'number' | 'text' | 'select' | 'textarea' | 'date'
export type FormFieldVisibility = 'client' | 'provider' | 'internal'
export type FormFieldEditor = 'client' | 'provider' | 'internal'
export type FormFieldRole = 'input_qty' | 'contact' | 'requirements' | 'internal_meta'

export type DynamicFormField = {
  id: string
  label: string
  type: DynamicFieldType
  role: FormFieldRole
  visibleTo: FormFieldVisibility
  editableBy: FormFieldEditor
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
