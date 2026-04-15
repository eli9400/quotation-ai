import { createHash } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { env } from '../config/env.js'
import { createModelV1Predictor } from './model-v1-inference.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { StoredQuote } from '../types/quote.js'
import type { ModelPredictionErrorRecord, ModelPredictionMetrics } from '../types/model-monitoring.js'

const MODEL_PREDICTION_ERRORS_COLLECTION = 'model_prediction_errors'
const MODEL_PREDICTION_METRICS_COLLECTION = 'model_prediction_metrics'

function nowIso(): string {
  return new Date().toISOString()
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function toErrorRecordId(serviceProviderUid: string, quoteId: string, lineId: string): string {
  const digest = createHash('sha1').update(`${serviceProviderUid}|${quoteId}|${lineId}`).digest('hex').slice(0, 20)
  return `${serviceProviderUid}_${digest}`
}

function isTrackableLine(line: StoredQuote['quote']['lineItems'][number]): boolean {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) return false
  if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) return false
  if (line.unit === 'percent' || line.unit === 'custom') return false
  return line.description.trim().length > 0
}

function toMetrics(serviceProviderUid: string, records: ModelPredictionErrorRecord[]): ModelPredictionMetrics {
  const sampleCount = records.length
  const mae = sampleCount > 0 ? records.reduce((sum, row) => sum + row.absoluteError, 0) / sampleCount : 0
  const mape = sampleCount > 0 ? records.reduce((sum, row) => sum + row.absolutePercentError, 0) / sampleCount : 0
  const smape = sampleCount > 0 ? records.reduce((sum, row) => sum + row.smape, 0) / sampleCount : 0
  return {
    serviceProviderUid,
    sampleCount,
    mae: round4(mae),
    mape: round4(mape),
    smape: round4(smape),
    updatedAt: nowIso(),
  }
}

export async function refreshModelPredictionMetrics(
  serviceProviderUid: string,
): Promise<ModelPredictionMetrics> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_PREDICTION_ERRORS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()
  const records = snapshot.docs.map((doc) => doc.data() as ModelPredictionErrorRecord)
  const metrics = toMetrics(serviceProviderUid, records)
  await db.collection(MODEL_PREDICTION_METRICS_COLLECTION).doc(serviceProviderUid).set(metrics, { merge: true })
  return metrics
}

export async function getModelPredictionMetrics(
  serviceProviderUid: string,
): Promise<ModelPredictionMetrics | null> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(MODEL_PREDICTION_METRICS_COLLECTION).doc(serviceProviderUid).get()
  if (!snapshot.exists) return null
  return snapshot.data() as ModelPredictionMetrics
}

export async function trackApprovedQuotePredictionErrors(quote: StoredQuote): Promise<{
  trackedLines: number
  metrics: ModelPredictionMetrics
}> {
  const profile = await getServiceProviderByUid(quote.serviceProviderUid)
  const predictor = await createModelV1Predictor(quote.serviceProviderUid, {
    routingKey: `approved|${quote.id}`,
  })
  if (!predictor) {
    const metrics = await refreshModelPredictionMetrics(quote.serviceProviderUid)
    return { trackedLines: 0, metrics }
  }

  const db = getFirestoreDb()
  const batch = db.batch()
  let trackedLines = 0
  quote.quote.lineItems.forEach((line) => {
    if (!isTrackableLine(line)) return
    const predicted = predictor.predict({
      itemName: line.description,
      unit: line.unit,
      quantity: line.quantity,
      industry: profile?.industry ?? null,
      projectType: quote.clientRequest.projectType,
      scope: quote.clientRequest.scope,
      urgency: quote.clientRequest.urgency,
      requirements: quote.clientRequest.requirements,
    })
    if (!predicted || !Number.isFinite(predicted.unitPrice) || predicted.unitPrice <= 0) return
    const actual = line.unitPrice
    const absoluteError = Math.abs(actual - predicted.unitPrice)
    const absolutePercentError = absoluteError / Math.max(1, actual)
    const smape = (2 * absoluteError) / Math.max(1, Math.abs(actual) + Math.abs(predicted.unitPrice))
    const row: ModelPredictionErrorRecord = {
      id: toErrorRecordId(quote.serviceProviderUid, quote.id, line.id),
      serviceProviderUid: quote.serviceProviderUid,
      quoteId: quote.id,
      lineId: line.id,
      modelArtifactId: predicted.modelArtifactId,
      predictedUnitPrice: round4(predicted.unitPrice),
      actualUnitPrice: round4(actual),
      absoluteError: round4(absoluteError),
      absolutePercentError: round4(absolutePercentError),
      smape: round4(smape),
      createdAt: quote.approvedAt ?? quote.updatedAt ?? nowIso(),
      updatedAt: nowIso(),
    }
    batch.set(db.collection(MODEL_PREDICTION_ERRORS_COLLECTION).doc(row.id), row, { merge: true })
    trackedLines += 1
  })

  if (trackedLines > 0) {
    await batch.commit()
  }
  const metrics = await refreshModelPredictionMetrics(quote.serviceProviderUid)
  return { trackedLines, metrics }
}

export function isPredictionMonitoringEnabled(): boolean {
  return (env.modelAlertsEnabled ?? true) === true
}
