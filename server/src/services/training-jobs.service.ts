import { randomUUID } from 'node:crypto'
import type { TrainingJob } from '../types/training.js'

const jobs = new Map<string, TrainingJob>()
const activeTimers = new Map<string, NodeJS.Timeout>()

function nowIso(): string {
  return new Date().toISOString()
}

function completeJob(jobId: string) {
  const job = jobs.get(jobId)
  if (!job) {
    return
  }

  job.status = 'completed'
  job.progress = 100
  job.updatedAt = nowIso()
  job.completedAt = job.updatedAt

  const timer = activeTimers.get(jobId)
  if (timer) {
    clearInterval(timer)
    activeTimers.delete(jobId)
  }
}

function progressJob(jobId: string) {
  const job = jobs.get(jobId)
  if (!job || job.status !== 'running') {
    return
  }

  const increment = Math.floor(Math.random() * 15) + 7
  job.progress = Math.min(100, job.progress + increment)
  job.updatedAt = nowIso()

  if (job.progress >= 100) {
    completeJob(jobId)
  }
}

function scheduleTraining(jobId: string) {
  const timer = setInterval(() => progressJob(jobId), 600)
  activeTimers.set(jobId, timer)
}

export function createTrainingJob(documentIds: string[]): TrainingJob {
  const timestamp = nowIso()
  const id = randomUUID()
  const job: TrainingJob = {
    id,
    status: 'running',
    progress: 5,
    documentIds,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    errorMessage: null,
  }

  jobs.set(id, job)
  scheduleTraining(id)
  return job
}

export function getTrainingJob(jobId: string): TrainingJob | null {
  return jobs.get(jobId) ?? null
}
