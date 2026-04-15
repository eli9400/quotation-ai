import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { env } from '../config/env.js'
import { getLatestActiveModelV1Artifact } from './model-artifacts.service.js'
import { getModelPredictionMetrics } from './model-performance-tracking.service.js'
import type { TrainingDatasetSnapshot } from '../types/training.js'
import type { ModelQualityAlert, ModelQualityAlertType } from '../types/model-monitoring.js'

const MODEL_ALERTS_COLLECTION = 'model_quality_alerts'

function nowIso(): string {
  return new Date().toISOString()
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function asPercentIncrease(base: number, current: number): number | null {
  if (!Number.isFinite(base) || !Number.isFinite(current) || base <= 0) return null
  return (current - base) / base
}

async function getActiveAlert(
  serviceProviderUid: string,
  type: ModelQualityAlertType,
): Promise<ModelQualityAlert | null> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_ALERTS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('type', '==', type)
    .where('active', '==', true)
    .limit(1)
    .get()
  if (snapshot.empty) return null
  return snapshot.docs[0].data() as ModelQualityAlert
}

export async function listActiveModelAlerts(
  serviceProviderUid: string,
): Promise<ModelQualityAlert[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_ALERTS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('active', '==', true)
    .get()
  return snapshot.docs.map((doc) => doc.data() as ModelQualityAlert)
}

async function upsertActiveAlert(input: {
  serviceProviderUid: string
  type: ModelQualityAlertType
  severity: ModelQualityAlert['severity']
  message: string
  context: ModelQualityAlert['context']
}): Promise<ModelQualityAlert> {
  const db = getFirestoreDb()
  const existing = await getActiveAlert(input.serviceProviderUid, input.type)
  const timestamp = nowIso()
  const alert: ModelQualityAlert = existing
    ? { ...existing, severity: input.severity, message: input.message, context: input.context, updatedAt: timestamp }
    : {
        id: `${input.serviceProviderUid}_${randomUUID().slice(0, 10)}`,
        serviceProviderUid: input.serviceProviderUid,
        type: input.type,
        severity: input.severity,
        message: input.message,
        context: input.context,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        resolvedAt: null,
      }
  await db.collection(MODEL_ALERTS_COLLECTION).doc(alert.id).set(alert, { merge: true })
  return alert
}

async function resolveActiveAlert(
  serviceProviderUid: string,
  type: ModelQualityAlertType,
): Promise<void> {
  const existing = await getActiveAlert(serviceProviderUid, type)
  if (!existing) return
  const db = getFirestoreDb()
  await db.collection(MODEL_ALERTS_COLLECTION).doc(existing.id).set(
    { active: false, resolvedAt: nowIso(), updatedAt: nowIso() } satisfies Partial<ModelQualityAlert>,
    { merge: true },
  )
}

export async function evaluatePredictionQualityAlert(serviceProviderUid: string): Promise<void> {
  if (!env.modelAlertsEnabled) return
  const metrics = await getModelPredictionMetrics(serviceProviderUid)
  const minSamples = Math.max(5, Math.round(env.modelAlertMinErrorSamples))
  if (!metrics || metrics.sampleCount < minSamples) {
    await resolveActiveAlert(serviceProviderUid, 'prediction_quality_drop')
    return
  }
  const artifact = await getLatestActiveModelV1Artifact(serviceProviderUid)
  const baseline = artifact?.metrics.find((metric) => metric.strategy === 'time') ?? artifact?.metrics[0] ?? null
  if (!baseline) return
  const maeIncrease = asPercentIncrease(baseline.mae, metrics.mae)
  const smapeIncrease = asPercentIncrease(baseline.smape ?? 0, metrics.smape)
  const maeLimit = env.modelAlertMaxMaeIncreasePct
  const smapeLimit = env.modelAlertMaxSmapeIncreasePct
  const exceedsMae = maeIncrease !== null && maeIncrease > maeLimit
  const exceedsSmape = smapeIncrease !== null && smapeIncrease > smapeLimit
  if (!exceedsMae && !exceedsSmape) {
    await resolveActiveAlert(serviceProviderUid, 'prediction_quality_drop')
    return
  }
  await upsertActiveAlert({
    serviceProviderUid,
    type: 'prediction_quality_drop',
    severity: exceedsMae && exceedsSmape ? 'critical' : 'warn',
    message: 'Prediction quality degraded against active model baseline.',
    context: {
      sampleCount: metrics.sampleCount,
      mae: metrics.mae,
      baselineMae: baseline.mae,
      maeIncreasePct: round2((maeIncrease ?? 0) * 100),
      smape: metrics.smape,
      baselineSmape: baseline.smape ?? 0,
      smapeIncreasePct: round2((smapeIncrease ?? 0) * 100),
    },
  })
}

export async function evaluateDatasetDriftAlert(input: {
  serviceProviderUid: string
  datasetSnapshot: TrainingDatasetSnapshot | null
}): Promise<void> {
  if (!env.modelAlertsEnabled || !input.datasetSnapshot) return
  const drift = input.datasetSnapshot.driftFromPreviousRun
  if (drift.severity === 'none' || drift.severity === 'low') {
    await resolveActiveAlert(input.serviceProviderUid, 'dataset_drift_increase')
    return
  }
  await upsertActiveAlert({
    serviceProviderUid: input.serviceProviderUid,
    type: 'dataset_drift_increase',
    severity: drift.severity === 'high' ? 'critical' : 'warn',
    message: `Dataset drift severity is ${drift.severity}.`,
    context: {
      severity: drift.severity,
      totalExamplesDeltaPct: drift.totalExamplesDeltaPct ?? 0,
      uniqueItemsDeltaPct: drift.uniqueItemsDeltaPct ?? 0,
      maxUnitShareDeltaPctPoints: drift.maxUnitShareDeltaPctPoints,
    },
  })
}
