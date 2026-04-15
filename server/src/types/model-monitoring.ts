export type ModelPredictionErrorRecord = {
  id: string
  serviceProviderUid: string
  quoteId: string
  lineId: string
  modelArtifactId: string
  predictedUnitPrice: number
  actualUnitPrice: number
  absoluteError: number
  absolutePercentError: number
  smape: number
  createdAt: string
  updatedAt: string
}

export type ModelPredictionMetrics = {
  serviceProviderUid: string
  sampleCount: number
  mae: number
  mape: number
  smape: number
  updatedAt: string
}

export type ModelQualityAlertType = 'prediction_quality_drop' | 'dataset_drift_increase'

export type ModelQualityAlert = {
  id: string
  serviceProviderUid: string
  type: ModelQualityAlertType
  severity: 'warn' | 'critical'
  message: string
  context: Record<string, string | number | boolean | null>
  active: boolean
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}
