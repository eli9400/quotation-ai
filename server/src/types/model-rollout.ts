import type { ModelV1MetricSummary } from './model-v1.js'

export type ModelV1CanaryRolloutStatus = 'active' | 'promoted' | 'rolled_back'

export type ModelV1CanaryQualityGate = {
  maxMaeIncreasePct: number
  maxSmapeIncreasePct: number
}

export type ModelV1CanaryQualityGateResult = {
  pass: boolean
  maeIncreasePct: number | null
  smapeIncreasePct: number | null
  reasons: string[]
}

export type ModelV1CanaryRollout = {
  id: string
  serviceProviderUid: string
  modelVersion: 'v1'
  stableArtifactId: string
  canaryArtifactId: string
  canaryTrafficPercent: number
  status: ModelV1CanaryRolloutStatus
  qualityGate: ModelV1CanaryQualityGate
  qualityGateResult: ModelV1CanaryQualityGateResult
  stableMetrics: ModelV1MetricSummary[]
  canaryMetrics: ModelV1MetricSummary[]
  createdAt: string
  updatedAt: string
  endedAt: string | null
  rollbackReason: string | null
}
