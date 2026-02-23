import { getStoredDocumentsByIds } from './documents.service.js'
import { extractTextFromDocuments } from './document-text-extractor.service.js'
import { extractPricingObservationsWithOpenAi } from './openai-pricing-parser.service.js'
import { adjustObservationsByCurrentCpi } from './cpi-adjustment.service.js'
import { buildDynamicFormSchema } from './dynamic-form-schema.service.js'
import { learnPricingItemsFromObservations } from './pricing-items-learning.service.js'
import { normalizePricingItemsForServiceProvider } from './pricing-items-normalization.service.js'
import { normalizeObservationsForTraining } from './pricing-observation-normalizer.service.js'
import { extractPricingObservations } from './pricing-observation-parser.service.js'
import { rebuildTrainingDatasetFromObservations } from './training-dataset.service.js'
import {
  completeTrainingJob,
  failTrainingJob,
  updateTrainingJobProgress,
} from './training-jobs.service.js'
import type { TrainingStage } from '../types/training.js'

type RunTrainingParams = {
  jobId: string
  serviceProviderUid: string
  documentIds: string[]
  processingDocumentIds?: string[]
}

function interpolateProgress(
  start: number,
  end: number,
  processed: number,
  total: number,
): number {
  if (total <= 0) {
    return end
  }
  const ratio = Math.min(1, Math.max(0, processed / total))
  return start + (end - start) * ratio
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Training failed due to an unknown error.'
}

export async function runLearningTrainingJob(params: RunTrainingParams): Promise<void> {
  try {
    const processingDocumentIds =
      params.processingDocumentIds && params.processingDocumentIds.length > 0
        ? params.processingDocumentIds
        : params.documentIds

    let lastProgress = 5
    const reportProgress = async (
      value: number,
      stage?: TrainingStage,
      stageValue?: number,
    ): Promise<void> => {
      const clamped = Math.max(0, Math.min(99, Math.round(value)))
      const nextStageValue =
        stageValue === undefined
          ? undefined
          : Math.max(0, Math.min(100, Math.round(stageValue)))
      if (clamped <= lastProgress && !stage) {
        return
      }
      lastProgress = Math.max(lastProgress, clamped)
      await updateTrainingJobProgress(params.jobId, {
        progress: clamped,
        currentStage: stage,
        stageProgress:
          stage && nextStageValue !== undefined ? { [stage]: nextStageValue } : undefined,
      })
    }

    await reportProgress(12, 'prepare', 100)
    const storedDocuments = await getStoredDocumentsByIds(
      params.serviceProviderUid,
      processingDocumentIds,
    )
    if (storedDocuments.length === 0) {
      throw new Error('Training documents are missing or inaccessible.')
    }

    await reportProgress(34, 'load_documents', 100)
    let lastExtractLog = 0
    const extractedDocuments = await extractTextFromDocuments(storedDocuments, {
      onProgress: async ({ processed, total }) => {
        await reportProgress(
          interpolateProgress(34, 58, processed, total),
          'extract_text',
          interpolateProgress(0, 100, processed, total),
        )
        if (
          processed === total ||
          processed === 1 ||
          processed - lastExtractLog >= 10
        ) {
          lastExtractLog = processed
          console.info(`[training] extracting-text ${processed}/${total}`)
        }
      },
    })
    await reportProgress(58, 'extract_text', 100)

    const parsed = extractPricingObservations(extractedDocuments)
    await reportProgress(64, 'parse_pricing_lines', 0)
    let lastAiLog = 0
    let aiParsed: ReturnType<typeof extractPricingObservationsWithOpenAi> extends Promise<infer T>
      ? T
      : null = null
    try {
      aiParsed = await extractPricingObservationsWithOpenAi(extractedDocuments, {
        onProgress: async ({ processed, total }) => {
          await reportProgress(
            interpolateProgress(64, 76, processed, total),
            'parse_pricing_lines',
            interpolateProgress(0, 100, processed, total),
          )
          if (
            processed === total ||
            processed === 1 ||
            processed - lastAiLog >= 10
          ) {
            lastAiLog = processed
            console.info(`[training] parsing-pricing-lines ${processed}/${total}`)
          }
        },
      })
    } catch (error) {
      console.warn(
        `[training] OpenAI parser unavailable, using heuristic parser: ${asErrorMessage(error)}`,
      )
    }
    const aiCount = aiParsed?.length ?? 0
    const source = aiCount > 0 ? 'openai' : 'heuristic'
    console.info(
      `[training] extraction summary: docs=${extractedDocuments.length}, heuristicLines=${parsed.observations.length}, aiLines=${aiCount}, source=${source}`,
    )
    const observationsRaw =
      aiParsed && aiParsed.length > 0 ? aiParsed : parsed.observations
    const normalizedObservations = normalizeObservationsForTraining(observationsRaw)
    const observations = await adjustObservationsByCurrentCpi(normalizedObservations, {
      applyToPrices: false,
    })

    if (observations.length === 0) {
      throw new Error(
        'No pricing line-items were detected. Upload clearer quote files or include table-based documents (PDF/XLSX).',
      )
    }
    await reportProgress(76, 'parse_pricing_lines', 100)

    const datasetResult = await rebuildTrainingDatasetFromObservations({
      serviceProviderUid: params.serviceProviderUid,
      trainingJobId: params.jobId,
      observations,
    })
    console.info(
      `[dataset] rebuilt for ${params.serviceProviderUid}: examples=${datasetResult.totalExamples}, train=${datasetResult.splitCounts.train}, validation=${datasetResult.splitCounts.validation}, test=${datasetResult.splitCounts.test}, items=${datasetResult.uniqueItems}`,
    )
    await reportProgress(86, 'build_dataset', 100)

    await learnPricingItemsFromObservations(params.serviceProviderUid, observations)
    await reportProgress(94, 'learn_items', 100)

    const normalizeResult = await normalizePricingItemsForServiceProvider(params.serviceProviderUid)
    const schema = await buildDynamicFormSchema(params.serviceProviderUid)
    console.info(
      `[training] normalized pricing_items for ${params.serviceProviderUid}: before=${normalizeResult.before}, after=${normalizeResult.after}, removedDuplicates=${normalizeResult.removedDuplicates}, removedNoise=${normalizeResult.removedNoise}, schemaFields=${schema.fields.length}`,
    )
    await reportProgress(98, 'normalize_schema', 100)
    await reportProgress(99, 'finalize', 100)

    await completeTrainingJob(params.jobId)
  } catch (error) {
    await failTrainingJob(params.jobId, asErrorMessage(error))
  }
}
