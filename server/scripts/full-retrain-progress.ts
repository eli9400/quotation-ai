import { getTrainingJob } from '../src/services/training-jobs.service.js'

const PROGRESS_POLL_INTERVAL_MS = 3000
const PROGRESS_HEARTBEAT_MS = 20000

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function estimateEta(elapsedMs: number, progress: number): string | null {
  if (progress <= 0 || progress >= 100) {
    return null
  }
  const remainingMs = (elapsedMs * (100 - progress)) / progress
  return formatDuration(remainingMs)
}

function describeStage(progress: number, currentStage?: string): string {
  if (currentStage) return currentStage
  if (progress < 12) return 'preparing'
  if (progress < 34) return 'loading-documents'
  if (progress < 58) return 'extracting-text'
  if (progress < 76) return 'parsing-pricing-lines'
  if (progress < 86) return 'building-dataset'
  if (progress < 94) return 'learning-items'
  if (progress < 98) return 'normalizing-and-schema'
  if (progress < 100) return 'finishing'
  return 'completed'
}

export async function runWithProgressLogging(
  jobId: string,
  operation: () => Promise<void>,
): Promise<void> {
  const startedAt = Date.now()
  let lastLogAt = 0
  let lastStateKey = ''
  let pollingNow = false

  const logProgress = async (force = false): Promise<void> => {
    if (pollingNow) {
      return
    }
    pollingNow = true
    try {
      const job = await getTrainingJob(jobId)
      if (!job) {
        return
      }
      const elapsedMs = Date.now() - startedAt
      const stage = describeStage(job.progress, job.currentStage)
      const eta = estimateEta(elapsedMs, job.progress)
      const stateKey = `${job.status}:${job.progress}:${job.errorMessage ?? ''}`
      const shouldLog =
        force || stateKey !== lastStateKey || Date.now() - lastLogAt >= PROGRESS_HEARTBEAT_MS

      if (!shouldLog) {
        return
      }

      const baseMessage = `[progress] ${job.progress}% | status=${job.status} | stage=${stage} | elapsed=${formatDuration(elapsedMs)}`
      console.info(eta ? `${baseMessage} | ETA~${eta}` : baseMessage)
      if (job.errorMessage) {
        console.error(`[progress] error: ${job.errorMessage}`)
      }
      lastStateKey = stateKey
      lastLogAt = Date.now()
    } finally {
      pollingNow = false
    }
  }

  await logProgress(true)
  const timer = setInterval(() => {
    void logProgress()
  }, PROGRESS_POLL_INTERVAL_MS)

  try {
    await operation()
  } finally {
    clearInterval(timer)
    await logProgress(true)
  }
}
