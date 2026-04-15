import { env } from '../config/env.js'
import { listServiceProviderUids } from './service-providers.service.js'
import { getTrainingDatasetStats } from './training-dataset.service.js'
import { trainAndPersistModelV1 } from './model-v1-training.service.js'

let timer: NodeJS.Timeout | null = null
let running = false

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function intervalMs(): number {
  const minutes = Math.max(15, Math.round(finiteNumber(env.modelRetrainIntervalMinutes, 360)))
  return minutes * 60_000
}

async function runRetrainCycle(): Promise<void> {
  if (running) {
    console.log('[model-scheduler] Previous cycle is still running, skipping this tick.')
    return
  }
  running = true
  try {
    const providers = await listServiceProviderUids()
    for (const serviceProviderUid of providers) {
      const stats = await getTrainingDatasetStats(serviceProviderUid)
      const minExamples = Math.max(3, Math.round(finiteNumber(env.modelRetrainMinExamples, 50)))
      if (!stats || stats.totalExamples < minExamples) continue
      try {
        const result = await trainAndPersistModelV1(serviceProviderUid, {
          rolloutMode: 'canary',
          canaryTrafficPercent: finiteNumber(env.modelCanaryTrafficPercent, 10),
          qualityGate: {
            maxMaeIncreasePct: finiteNumber(env.modelCanaryMaxMaeIncreasePct, 0.15),
            maxSmapeIncreasePct: finiteNumber(env.modelCanaryMaxSmapeIncreasePct, 0.2),
          },
        })
        console.log(
          `[model-scheduler] provider=${serviceProviderUid} mode=${result.rolloutMode} status=${result.rolloutStatus} artifact=${result.modelArtifactId}`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[model-scheduler] provider=${serviceProviderUid} failed: ${message}`)
      }
    }
  } finally {
    running = false
  }
}

export function startModelRetrainingScheduler(): void {
  if (!env.modelRetrainSchedulerEnabled) {
    return
  }
  if (timer) {
    return
  }
  console.log(
    `[model-scheduler] enabled interval=${Math.round(intervalMs() / 60000)}m minExamples=${Math.max(3, Math.round(finiteNumber(env.modelRetrainMinExamples, 50)))} canaryTraffic=${Math.round(finiteNumber(env.modelCanaryTrafficPercent, 10))}%`,
  )
  void runRetrainCycle()
  timer = setInterval(() => {
    void runRetrainCycle()
  }, intervalMs())
}

export function stopModelRetrainingScheduler(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
