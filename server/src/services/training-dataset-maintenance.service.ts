import { getFirestoreDb } from '../config/firebase.js'
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
  const stats = buildTrainingDatasetStats(serviceProviderUid, examples)
  await db.collection(TRAINING_DATASET_STATS_COLLECTION).doc(serviceProviderUid).set(stats)
  return stats
}
