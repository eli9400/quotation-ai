import { buildMedianBaselineModel, predictMedianBaseline } from './model-evaluation-baseline.service.js'
import { buildEvaluationMetricSummary } from './model-evaluation-metrics.service.js'
import type {
  EvaluationCoverage,
  EvaluationSplit,
  EvaluationSplitSummary,
  TrainingEvaluationReport,
} from '../types/model-evaluation.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'

function createCoverage(): EvaluationCoverage {
  return { directItemUnit: 0, unitFallback: 0, globalFallback: 0 }
}

export function evaluateSplitWithMedianBaseline(split: EvaluationSplit): EvaluationSplitSummary {
  const model = buildMedianBaselineModel(split.train)
  const coverage = createCoverage()
  const points = split.test.map((example) => {
    const prediction = predictMedianBaseline(model, example)
    coverage[prediction.source] += 1
    return { actual: example.targetUnitPrice, predicted: prediction.predicted }
  })
  return {
    strategy: split.strategy,
    trainCount: split.train.length,
    testCount: split.test.length,
    metrics: buildEvaluationMetricSummary(points),
    coverage,
  }
}

export function buildTrainingEvaluationReport(input: {
  serviceProviderUid: string
  examples: TrainingDatasetExample[]
  datasetVersionId: string | null
  datasetFingerprint: string | null
  summaries: EvaluationSplitSummary[]
}): TrainingEvaluationReport {
  return {
    serviceProviderUid: input.serviceProviderUid,
    generatedAt: new Date().toISOString(),
    totalExamples: input.examples.length,
    datasetVersionId: input.datasetVersionId,
    datasetFingerprint: input.datasetFingerprint,
    summaries: input.summaries,
  }
}

export function renderTrainingEvaluationMarkdown(report: TrainingEvaluationReport): string {
  const header = [
    '# Training Evaluation Report',
    '',
    `- Provider UID: \`${report.serviceProviderUid}\``,
    `- Generated At: ${report.generatedAt}`,
    `- Total Examples: ${report.totalExamples}`,
    `- Dataset Version: ${report.datasetVersionId ?? 'n/a'}`,
    `- Dataset Fingerprint: ${report.datasetFingerprint ?? 'n/a'}`,
    '',
  ]
  const sections = report.summaries.flatMap((summary) => [
    `## ${summary.strategy.toUpperCase()} Split`,
    '',
    `- Train/Test: ${summary.trainCount}/${summary.testCount}`,
    `- MAE: ${summary.metrics.mae}`,
    `- MAPE: ${summary.metrics.mape ?? 'n/a'}`,
    `- SMAPE: ${summary.metrics.smape ?? 'n/a'}`,
    `- MedianAE: ${summary.metrics.medianAe}`,
    `- Coverage directItemUnit/unitFallback/globalFallback: ${summary.coverage.directItemUnit}/${summary.coverage.unitFallback}/${summary.coverage.globalFallback}`,
    '',
  ])
  return [...header, ...sections].join('\n')
}
