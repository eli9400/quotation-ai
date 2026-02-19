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
  setTrainingJobProgress,
} from './training-jobs.service.js'

type RunTrainingParams = {
  jobId: string
  serviceProviderUid: string
  documentIds: string[]
  processingDocumentIds?: string[]
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

    await setTrainingJobProgress(params.jobId, 12)
    const storedDocuments = await getStoredDocumentsByIds(
      params.serviceProviderUid,
      processingDocumentIds,
    )
    if (storedDocuments.length === 0) {
      throw new Error('Training documents are missing or inaccessible.')
    }

    await setTrainingJobProgress(params.jobId, 34)
    const extractedDocuments = await extractTextFromDocuments(storedDocuments)
    await setTrainingJobProgress(params.jobId, 58)

    const parsed = extractPricingObservations(extractedDocuments)
    const aiParsed = await extractPricingObservationsWithOpenAi(extractedDocuments).catch(() => null)
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
    await setTrainingJobProgress(params.jobId, 76)

    const datasetResult = await rebuildTrainingDatasetFromObservations({
      serviceProviderUid: params.serviceProviderUid,
      trainingJobId: params.jobId,
      observations,
    })
    console.info(
      `[dataset] rebuilt for ${params.serviceProviderUid}: examples=${datasetResult.totalExamples}, train=${datasetResult.splitCounts.train}, validation=${datasetResult.splitCounts.validation}, test=${datasetResult.splitCounts.test}, items=${datasetResult.uniqueItems}`,
    )
    await setTrainingJobProgress(params.jobId, 86)

    await learnPricingItemsFromObservations(params.serviceProviderUid, observations)
    await setTrainingJobProgress(params.jobId, 94)

    const normalizeResult = await normalizePricingItemsForServiceProvider(params.serviceProviderUid)
    const schema = await buildDynamicFormSchema(params.serviceProviderUid)
    console.info(
      `[training] normalized pricing_items for ${params.serviceProviderUid}: before=${normalizeResult.before}, after=${normalizeResult.after}, removedDuplicates=${normalizeResult.removedDuplicates}, removedNoise=${normalizeResult.removedNoise}, schemaFields=${schema.fields.length}`,
    )
    await setTrainingJobProgress(params.jobId, 98)

    await completeTrainingJob(params.jobId)
  } catch (error) {
    await failTrainingJob(params.jobId, asErrorMessage(error))
  }
}
