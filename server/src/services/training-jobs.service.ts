import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import type { TrainingJob, TrainingStage, TrainingStageProgress } from '../types/training.js'
import { createCompletedStageProgress, createEmptyStageProgress, isEmptyStageProgress, mergeTrainingStageProgress, normalizeTrainingStage, normalizeTrainingStageProgress } from './training-stage-progress.service.js'

const TRAINING_JOBS_COLLECTION = 'training_jobs'

type UpdateTrainingProgressOptions = {
  progress?: number
  currentStage?: TrainingStage
  stageProgress?: Partial<TrainingStageProgress>
}

type RawTrainingJob = Partial<TrainingJob> & {
  id?: string
  serviceProviderUid?: string
  contractorUid?: string
  currentStage?: TrainingStage
  stageProgress?: Partial<TrainingStageProgress>
}

function nowIso(): string {
  return new Date().toISOString()
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function stageProgressChanged(
  left: TrainingStageProgress,
  right: TrainingStageProgress,
): boolean {
  return (
    left.prepare !== right.prepare ||
    left.load_documents !== right.load_documents ||
    left.extract_text !== right.extract_text ||
    left.parse_pricing_lines !== right.parse_pricing_lines ||
    left.build_dataset !== right.build_dataset ||
    left.learn_items !== right.learn_items ||
    left.normalize_schema !== right.normalize_schema ||
    left.finalize !== right.finalize
  )
}

function normalizeTrainingJob(raw: RawTrainingJob, fallbackUid: string): TrainingJob | null {
  if (!raw?.id) {
    return null
  }
  const serviceProviderUid = raw.serviceProviderUid ?? raw.contractorUid ?? fallbackUid
  if (!serviceProviderUid) {
    return null
  }
  const status = raw.status === 'completed' || raw.status === 'failed' ? raw.status : 'running'
  const normalizedStageProgress = normalizeTrainingStageProgress(raw.stageProgress)
  const stageProgress =
    status === 'completed' && isEmptyStageProgress(normalizedStageProgress)
      ? createCompletedStageProgress()
      : normalizedStageProgress

  return {
    id: raw.id,
    serviceProviderUid,
    status,
    progress: clampProgress(typeof raw.progress === 'number' ? raw.progress : 0),
    currentStage: status === 'completed' ? 'finalize' : normalizeTrainingStage(raw.currentStage),
    stageProgress,
    documentIds: Array.isArray(raw.documentIds) ? raw.documentIds.filter((id): id is string => typeof id === 'string') : [],
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : null,
  }
}

async function persistTrainingJob(job: TrainingJob): Promise<void> {
  const db = getFirestoreDb()
  await db.collection(TRAINING_JOBS_COLLECTION).doc(job.id).set(job, { merge: true })
}

async function migrateLegacyJob(jobId: string, raw: RawTrainingJob): Promise<RawTrainingJob | null> {
  if (raw.serviceProviderUid) {
    return raw
  }
  if (!raw.contractorUid) {
    return null
  }
  const db = getFirestoreDb()
  await db.collection(TRAINING_JOBS_COLLECTION).doc(jobId).set(
    { serviceProviderUid: raw.contractorUid },
    { merge: true },
  )
  return { ...raw, serviceProviderUid: raw.contractorUid }
}

async function listTrainingJobsByField(fieldName: string, serviceProviderUid: string): Promise<TrainingJob[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(TRAINING_JOBS_COLLECTION)
    .where(fieldName, '==', serviceProviderUid)
    .limit(200)
    .get()
  return snapshot.docs
    .map((doc) => normalizeTrainingJob(doc.data() as RawTrainingJob, serviceProviderUid))
    .filter((job): job is TrainingJob => job !== null)
}

export async function createTrainingJob(
  serviceProviderUid: string,
  documentIds: string[],
): Promise<TrainingJob> {
  const timestamp = nowIso()
  const stageProgress = createEmptyStageProgress()
  stageProgress.prepare = 100
  const job: TrainingJob = {
    id: randomUUID(),
    serviceProviderUid,
    status: 'running',
    progress: 5,
    currentStage: 'prepare',
    stageProgress,
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
  const db = getFirestoreDb()
  const snapshot = await db.collection(TRAINING_JOBS_COLLECTION).doc(jobId).get()
  if (!snapshot.exists) {
    return null
  }
  const raw = snapshot.data() as RawTrainingJob
  const migrated = await migrateLegacyJob(jobId, raw)
  if (!migrated) {
    return null
  }
  return normalizeTrainingJob(migrated, migrated.serviceProviderUid ?? migrated.contractorUid ?? '')
}

export async function getLatestCompletedTrainingJobByServiceProvider(
  serviceProviderUid: string,
): Promise<TrainingJob | null> {
  const [newJobs, legacyJobs] = await Promise.all([
    listTrainingJobsByField('serviceProviderUid', serviceProviderUid),
    listTrainingJobsByField('contractorUid', serviceProviderUid),
  ])
  const uniqueJobs = new Map<string, TrainingJob>()
  ;[...newJobs, ...legacyJobs].forEach((job) => uniqueJobs.set(job.id, job))
  const completedJobs = Array.from(uniqueJobs.values()).filter((job) => job.status === 'completed')
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

export async function updateTrainingJobProgress(
  jobId: string,
  options: UpdateTrainingProgressOptions,
): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job || job.status !== 'running') {
    return job
  }
  const nextProgress =
    options.progress === undefined ? job.progress : Math.max(job.progress, clampProgress(options.progress))
  const nextCurrentStage =
    options.currentStage ? normalizeTrainingStage(options.currentStage, job.currentStage) : job.currentStage
  const nextStageProgress = options.stageProgress
    ? mergeTrainingStageProgress(job.stageProgress, options.stageProgress)
    : job.stageProgress

  const hasChanges =
    nextProgress !== job.progress ||
    nextCurrentStage !== job.currentStage ||
    stageProgressChanged(job.stageProgress, nextStageProgress)
  if (!hasChanges) {
    return job
  }

  const updated: TrainingJob = {
    ...job,
    progress: nextProgress,
    currentStage: nextCurrentStage,
    stageProgress: nextStageProgress,
    updatedAt: nowIso(),
  }
  await persistTrainingJob(updated)
  return updated
}

export async function setTrainingJobProgress(jobId: string, progress: number): Promise<TrainingJob | null> {
  return updateTrainingJobProgress(jobId, { progress })
}

export async function completeTrainingJob(jobId: string): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job) {
    return null
  }
  const completedAt = nowIso()
  const stageProgress = { ...createEmptyStageProgress(), ...job.stageProgress, finalize: 100 }
  const completed: TrainingJob = {
    ...job,
    status: 'completed',
    progress: 100,
    currentStage: 'finalize',
    stageProgress,
    updatedAt: completedAt,
    completedAt,
    errorMessage: null,
  }
  await persistTrainingJob(completed)
  return completed
}

export async function failTrainingJob(jobId: string, errorMessage: string): Promise<TrainingJob | null> {
  const job = await getTrainingJob(jobId)
  if (!job) {
    return null
  }
  const completedAt = nowIso()
  const failed: TrainingJob = {
    ...job,
    status: 'failed',
    currentStage: normalizeTrainingStage(job.currentStage),
    stageProgress: normalizeTrainingStageProgress(job.stageProgress),
    updatedAt: completedAt,
    completedAt,
    errorMessage: errorMessage.trim() || 'Training failed.',
  }
  await persistTrainingJob(failed)
  return failed
}
