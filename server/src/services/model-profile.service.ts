import type { DynamicFormSchema, ModelProfile } from '../types/model-profile.js'

export const MODEL_PROFILES_COLLECTION = 'model_profiles'
export const PRICING_ITEMS_COLLECTION = 'pricing_items'
export const DYNAMIC_FORM_SCHEMAS_COLLECTION = 'dynamic_form_schemas'

function nowIso(): string {
  return new Date().toISOString()
}

export function createEmptyDynamicFormSchema(
  serviceProviderUid: string,
): DynamicFormSchema {
  return {
    id: serviceProviderUid,
    serviceProviderUid,
    version: 1,
    generatedAt: nowIso(),
    sourceItemsCount: 0,
    fields: [],
  }
}

export function createEmptyModelProfile(serviceProviderUid: string): ModelProfile {
  const timestamp = nowIso()
  return {
    id: serviceProviderUid,
    serviceProviderUid,
    version: 1,
    trainedDocumentsCount: 0,
    parsedLinesCount: 0,
    learnedItemsCount: 0,
    failedDocumentsCount: 0,
    lastTrainingJobId: null,
    lastTrainedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
