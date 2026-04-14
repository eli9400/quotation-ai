export type ModelV1MetricSummary = {
  strategy: 'random' | 'time'
  samples: number
  mae: number
  mape: number | null
  smape: number | null
  medianAe: number
}

export type ModelV1Regressor = {
  key: string
  unit: string
  samples: number
  intercept: number
  slope: number
  median: number
  minPrediction: number
  maxPrediction: number
}

export type ModelV1Payload = {
  schemaVersion: string
  transform: 'log1p_quantity'
  directByItemUnit: ModelV1Regressor[]
  fallbackByUnit: ModelV1Regressor[]
  globalFallback: ModelV1Regressor
}

export type ModelV1Artifact = {
  id: string
  serviceProviderUid: string
  modelVersion: 'v1'
  algorithm: 'linear_quantity_v1'
  active: boolean
  trainedAt: string
  datasetVersionId: string | null
  datasetFingerprint: string | null
  featureSchemaVersion: string
  metrics: ModelV1MetricSummary[]
  payload: ModelV1Payload
}
