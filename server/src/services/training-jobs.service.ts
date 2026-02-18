import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import type { TrainingJob } from '../types/training.js'

const TRAINING_JOBS_COLLECTION = 'training_jobs'

function nowIso(): string {
  return new Date().toISOString()
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function getTrainingSnapshot(jobId: string) {
  const db = getFirestoreDb()
  const ref = db.collection(TRAINING_JOBS_COLLECTION).doc(jobId)
  const snapshot = await ref.get()
  return { ref, snapshot }
}

async function migrateLegacyJob(jobId: string, raw: TrainingJob & { contractorUid?: string }) {
  if (raw.serviceProviderUid) {
    return raw
  }
  if (!raw.contractorUid) {
    return null
  }

  const db = getFirestoreDb()
  const ref = db.collection(TRAINING_JOBS_COLLECTION).doc(jobId)
  await ref.set({ serviceProviderUid: raw.contractorUid }, { merge: true })
  return {
    ...raw,
    serviceProviderUid: raw.contractorUid,
  }
}

async function persistTrainingJob(job: TrainingJob): Promise<void> {
  const db = getFirestoreDb()
  await db.collection(TRAINING_JOBS_COLLECTION).doc(job.id).set(job, { merge: true })
}

type RawTrainingJob = TrainingJob & {
  contractorUid?: string
}

function normalizeTrainingJob(
  raw: RawTrainingJob,
  fallbackServiceProviderUid: string,
): TrainingJob | null {
  if (!raw?.id) {
    return null
  }

  const serviceProviderUid =
    raw.serviceProviderUid ?? raw.contractorUid ?? fallbackServiceProviderUid
  if (!serviceProviderUid) {
    return null
  }

  return {
    ...raw,
    serviceProviderUid,
  }
}

async function listTrainingJobsByField(
  fieldName: string,
  serviceProviderUid: string,
): Promise<TrainingJob[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_JOBS_COLLECTION)
    .where(fieldName, '==', serviceProviderUid)
    .limit(200)
    .get()

  return snapshot.docs
    .map((doc) =>
      normalizeTrainingJob(
        doc.data() as RawTrainingJob,
        serviceProviderUid,
      ),
    )
    .filter((job): job is TrainingJob => job !== null)
}

export async function createTrainingJob(
  serviceProviderUid: string,
  documentIds: string[],
): Promise<TrainingJob> {
  const timestamp = nowIso()
  const job: TrainingJob = {
    id: randomUUID(),
    serviceProviderUid,
    status: 'running',
    progress: 5,
    documentIds,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    errorMessage: null,
  }

  await persistTrainingJob(job)
  return job
}

export async function getTrainingJob(jobId: string): Promise<TrainingJob | null> {
  const { snapshot } = await getTrainingSnapshot(jobId)
  if (!snapshot.exists) {
    return null
  }

  const raw = snapshot.data() as TrainingJob & { contractorUid?: string }
  return migrateLegacyJob(jobId, raw)
}

export async function getLatestCompletedTrainingJobByServiceProvider(
  serviceProviderUid: string,
): Promise<TrainingJob | null> {
  const [newJobs, legacyJobs] = await Promise.all([
    listTrainingJobsByField('serviceProviderUid', serviceProviderUid),
    listTrainingJobsByField('contractorUid', serviceProviderUid),
  ])

  const uniqueJobs = new Map<string, TrainingJob>()
  ;[...newJobs, ...legacyJobs].forEach((job) => {
    uniqueJobs.set(job.id, job)
  })

  const completedJobs = Array.from(uniqueJobs.values()).filter(
    (job) => job.status === 'completed',
  )

  if (completedJobs.length === 0) {
    return null
  }

  completedJobs.sort((a, b) => {
    const aTimestamp = a.completedAt ?? a.updatedAt
    const bTimestamp = b.completedAt ?? b.updatedAt
    return bTimestamp.localeCompare(aTimestamp)
  })

  return completedJobs[0]
}

export async function setTrainingJobProgress(
  jobId: string,
  progress: number,
): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job || job.status !== 'running') {
    return job
  }

  const nextProgress = clampProgress(progress)
  if (nextProgress < job.progress) {
    return job
  }

  const updated: TrainingJob = {
    ...job,
    progress: nextProgress,
    updatedAt: nowIso(),
  }
  await persistTrainingJob(updated)
  return updated
}

export async function completeTrainingJob(jobId: string): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job) {
    return null
  }

  const completedAt = nowIso()
  const completed: TrainingJob = {
    ...job,
    status: 'completed',
    progress: 100,
    updatedAt: completedAt,
    completedAt,
    errorMessage: null,
  }
  await persistTrainingJob(completed)
  return completed
}

export async function failTrainingJob(
  jobId: string,
  errorMessage: string,
): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job) {
    return null
  }

  const completedAt = nowIso()
  const failed: TrainingJob = {
    ...job,
    status: 'failed',
    updatedAt: completedAt,
    completedAt,
    errorMessage: errorMessage.trim() || 'Training failed.',
  }
  await persistTrainingJob(failed)
  return failed
}
