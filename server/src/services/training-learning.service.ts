import { getStoredDocumentsByIds } from './documents.service.js'
import { extractTextFromDocuments } from './document-text-extractor.service.js'
import { extractPricingObservationsWithOpenAi } from './openai-pricing-parser.service.js'
import { learnPricingItemsFromObservations } from './pricing-items-learning.service.js'
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
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Training failed due to an unknown error.'
}

export async function runLearningTrainingJob(params: RunTrainingParams): Promise<void> {
  try {
    await setTrainingJobProgress(params.jobId, 12)
    const storedDocuments = await getStoredDocumentsByIds(
      params.serviceProviderUid,
      params.documentIds,
    )
    if (storedDocuments.length === 0) {
      throw new Error('Training documents are missing or inaccessible.')
    }

    await setTrainingJobProgress(params.jobId, 34)
    const extractedDocuments = await extractTextFromDocuments(storedDocuments)
    await setTrainingJobProgress(params.jobId, 58)

    const parsed = extractPricingObservations(extractedDocuments)
    const aiParsed = await extractPricingObservationsWithOpenAi(extractedDocuments).catch(() => null)
    const observations =
      aiParsed && aiParsed.length > 0 ? aiParsed : parsed.observations

    if (observations.length === 0) {
      throw new Error(
        'No pricing line-items were detected. Upload clearer quote files or include table-based documents (PDF/XLSX).',
      )
    }
    await setTrainingJobProgress(params.jobId, 76)

    await rebuildTrainingDatasetFromObservations({
      serviceProviderUid: params.serviceProviderUid,
      trainingJobId: params.jobId,
      observations,
    })
    await setTrainingJobProgress(params.jobId, 86)

    await learnPricingItemsFromObservations(params.serviceProviderUid, observations)
    await setTrainingJobProgress(params.jobId, 94)
    await completeTrainingJob(params.jobId)
  } catch (error) {
    await failTrainingJob(params.jobId, asErrorMessage(error))
  }
}
