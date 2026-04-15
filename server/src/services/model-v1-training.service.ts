import {
  getLatestActiveModelV1Artifact,
  saveAndActivateModelV1Artifact,
  saveModelV1Artifact,
} from './model-artifacts.service.js'
import { getModelFeatureSchema, buildModelFeatureRowFromDatasetExample, validateModelFeatureRow } from './model-feature-schema.service.js'
import { createModelV1CanaryRollout } from './model-rollout.service.js'
import { evaluateCanaryQualityGate } from './model-rollout-utils.service.js'
import { trainAndEvaluateModelV1 } from './model-v1-core.service.js'
import { listTrainingDatasetExamples, getTrainingDatasetStats } from './training-dataset.service.js'

const DEFAULT_CANARY_TRAFFIC_PERCENT = 10
const DEFAULT_MAX_MAE_INCREASE_PCT = 0.15
const DEFAULT_MAX_SMAPE_INCREASE_PCT = 0.2

type ModelV1RolloutMode = 'activate' | 'canary'

export async function trainAndPersistModelV1(
  serviceProviderUid: string,
  options: {
    rolloutMode?: ModelV1RolloutMode
    canaryTrafficPercent?: number
    qualityGate?: {
      maxMaeIncreasePct?: number
      maxSmapeIncreasePct?: number
    }
  } = {},
): Promise<{
  modelArtifactId: string
  trainedExamples: number
  droppedExamples: number
  datasetVersionId: string | null
  datasetFingerprint: string | null
  metrics: ReturnType<typeof trainAndEvaluateModelV1>['metrics']
  rolloutMode: ModelV1RolloutMode
  rolloutStatus: 'activated' | 'canary_active' | 'rolled_back'
  rolloutId: string | null
  rolloutReason: string | null
}> {
  const [examples, stats] = await Promise.all([
    listTrainingDatasetExamples(serviceProviderUid),
    getTrainingDatasetStats(serviceProviderUid),
  ])
  if (examples.length < 3) {
    throw new Error(`Model v1 training requires at least 3 dataset examples (found ${examples.length})`)
  }

  const mapped = examples.map((example) => {
    const row = buildModelFeatureRowFromDatasetExample(example)
    const errors = validateModelFeatureRow(row)
    return { row, target: example.targetUnitPrice, errors }
  })
  const validRows = mapped.filter((entry) => entry.errors.length === 0)
  if (validRows.length < 3) {
    throw new Error(`Not enough valid rows after feature validation (valid=${validRows.length})`)
  }

  const trained = trainAndEvaluateModelV1(
    validRows.map((entry) => entry.row),
    validRows.map((entry) => entry.target),
  )
  const schema = getModelFeatureSchema()
  const rolloutMode: ModelV1RolloutMode = options.rolloutMode ?? 'activate'
  const qualityGate = {
    maxMaeIncreasePct: options.qualityGate?.maxMaeIncreasePct ?? DEFAULT_MAX_MAE_INCREASE_PCT,
    maxSmapeIncreasePct: options.qualityGate?.maxSmapeIncreasePct ?? DEFAULT_MAX_SMAPE_INCREASE_PCT,
  }

  if (rolloutMode === 'canary') {
    const stableArtifact = await getLatestActiveModelV1Artifact(serviceProviderUid)
    if (stableArtifact) {
      const canaryArtifact = await saveModelV1Artifact({
        serviceProviderUid,
        datasetVersionId: stats?.datasetVersionId ?? null,
        datasetFingerprint: stats?.datasetFingerprint ?? null,
        featureSchemaVersion: schema.version,
        payload: trained.payload,
        metrics: trained.metrics,
        active: false,
      })
      const qualityGateResult = evaluateCanaryQualityGate({
        stableMetrics: stableArtifact.metrics,
        candidateMetrics: canaryArtifact.metrics,
        qualityGate,
      })
      const rollout = await createModelV1CanaryRollout({
        serviceProviderUid,
        stableArtifactId: stableArtifact.id,
        canaryArtifactId: canaryArtifact.id,
        canaryTrafficPercent: options.canaryTrafficPercent ?? DEFAULT_CANARY_TRAFFIC_PERCENT,
        qualityGate,
        qualityGateResult,
        stableMetrics: stableArtifact.metrics,
        canaryMetrics: canaryArtifact.metrics,
      })
      return {
        modelArtifactId: canaryArtifact.id,
        trainedExamples: validRows.length,
        droppedExamples: mapped.length - validRows.length,
        datasetVersionId: canaryArtifact.datasetVersionId,
        datasetFingerprint: canaryArtifact.datasetFingerprint,
        metrics: trained.metrics,
        rolloutMode,
        rolloutStatus: rollout.status === 'active' ? 'canary_active' : 'rolled_back',
        rolloutId: rollout.id,
        rolloutReason: rollout.rollbackReason,
      }
    }
  }

  const artifact = await saveAndActivateModelV1Artifact({
    serviceProviderUid,
    datasetVersionId: stats?.datasetVersionId ?? null,
    datasetFingerprint: stats?.datasetFingerprint ?? null,
    featureSchemaVersion: schema.version,
    payload: trained.payload,
    metrics: trained.metrics,
  })
  return {
    modelArtifactId: artifact.id,
    trainedExamples: validRows.length,
    droppedExamples: mapped.length - validRows.length,
    datasetVersionId: artifact.datasetVersionId,
    datasetFingerprint: artifact.datasetFingerprint,
    metrics: trained.metrics,
    rolloutMode,
    rolloutStatus: 'activated',
    rolloutId: null,
    rolloutReason: null,
  }
}
