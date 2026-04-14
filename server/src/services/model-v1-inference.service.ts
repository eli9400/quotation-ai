import { getLatestActiveModelV1Artifact } from './model-artifacts.service.js'
import {
  buildModelFeatureRowFromInferenceInput,
  validateModelFeatureRow,
} from './model-feature-schema.service.js'
import { predictModelV1 } from './model-v1-core.service.js'

type PredictorInput = {
  itemKey?: string | null
  itemName?: string | null
  unit: string
  quantity: number
  industry?: string | null
  projectType?: string | null
  scope?: string | null
  urgency?: string | null
  requirements?: string | null
  inventorySurplus?: number | null
  availableWorkers?: number | null
}

export type ModelV1Prediction = {
  unitPrice: number
  p25: number
  p50: number
  p75: number
  uncertaintyScore: number
  source: 'direct_item_unit' | 'unit_fallback' | 'global_fallback'
  modelArtifactId: string
}

export async function createModelV1Predictor(serviceProviderUid: string): Promise<{
  predict: (input: PredictorInput) => ModelV1Prediction | null
  modelArtifactId: string
} | null> {
  const artifact = await getLatestActiveModelV1Artifact(serviceProviderUid)
  if (!artifact) return null

  return {
    modelArtifactId: artifact.id,
    predict: (input: PredictorInput): ModelV1Prediction | null => {
      const row = buildModelFeatureRowFromInferenceInput(input)
      const errors = validateModelFeatureRow(row)
      if (errors.length > 0) return null
      const predicted = predictModelV1(artifact.payload, {
        itemKey: row.itemKey,
        unit: row.unit,
        quantity: row.quantity,
      })
      if (!Number.isFinite(predicted.unitPrice) || predicted.unitPrice <= 0) return null
      return {
        unitPrice: predicted.unitPrice,
        p25: predicted.p25,
        p50: predicted.p50,
        p75: predicted.p75,
        uncertaintyScore: predicted.uncertaintyScore,
        source: predicted.source,
        modelArtifactId: artifact.id,
      }
    },
  }
}
