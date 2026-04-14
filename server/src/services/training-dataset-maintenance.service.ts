import { getFirestoreDb } from '../config/firebase.js'
import { buildDatasetFingerprint, buildDatasetVersionId } from './training-dataset-governance.service.js'
import { buildTrainingDatasetStats } from './training-dataset-stats.service.js'
import {
  TRAINING_DATASET_COLLECTION,
  TRAINING_DATASET_STATS_COLLECTION,
} from './training-dataset.service.js'
import type { TrainingDatasetExample, TrainingDatasetStats } from '../types/training-dataset.js'

export async function refreshTrainingDatasetStatsForServiceProvider(
  serviceProviderUid: string,
): Promise<TrainingDatasetStats> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_DATASET_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  const examples = snapshot.docs.map((doc) => doc.data() as TrainingDatasetExample)
  const generatedAt = new Date().toISOString()
  const datasetFingerprint = buildDatasetFingerprint(examples)
  const datasetVersionId = buildDatasetVersionId(datasetFingerprint)
  const stats = buildTrainingDatasetStats(serviceProviderUid, examples, {
    datasetFingerprint,
    datasetVersionId,
    generatedAt,
  })
  await db.collection(TRAINING_DATASET_STATS_COLLECTION).doc(serviceProviderUid).set(stats)
  return stats
}
