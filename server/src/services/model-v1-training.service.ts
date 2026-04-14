import { getModelFeatureSchema, buildModelFeatureRowFromDatasetExample, validateModelFeatureRow } from './model-feature-schema.service.js'
import { saveAndActivateModelV1Artifact } from './model-artifacts.service.js'
import { trainAndEvaluateModelV1 } from './model-v1-core.service.js'
import { listTrainingDatasetExamples, getTrainingDatasetStats } from './training-dataset.service.js'

export async function trainAndPersistModelV1(serviceProviderUid: string): Promise<{
  modelArtifactId: string
  trainedExamples: number
  droppedExamples: number
  datasetVersionId: string | null
  datasetFingerprint: string | null
  metrics: ReturnType<typeof trainAndEvaluateModelV1>['metrics']
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
  }
}
