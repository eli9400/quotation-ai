import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import {
  activateModelV1Artifact,
  getModelV1ArtifactById,
  getLatestActiveModelV1Artifact,
} from './model-artifacts.service.js'
import { shouldServeCanary } from './model-rollout-utils.service.js'
import type { ModelV1Artifact } from '../types/model-v1.js'
import type {
  ModelV1CanaryQualityGate,
  ModelV1CanaryQualityGateResult,
  ModelV1CanaryRollout,
} from '../types/model-rollout.js'

const MODEL_ROLLOUTS_COLLECTION = 'model_rollouts'

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTrafficPercent(value: number): number {
  if (!Number.isFinite(value)) return 10
  return Math.max(1, Math.min(100, Math.round(value)))
}

export async function getActiveModelV1CanaryRollout(
  serviceProviderUid: string,
): Promise<ModelV1CanaryRollout | null> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_ROLLOUTS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('modelVersion', '==', 'v1')
    .where('status', '==', 'active')
    .limit(1)
    .get()
  if (snapshot.empty) return null
  return snapshot.docs[0].data() as ModelV1CanaryRollout
}

async function closeActiveRollouts(
  serviceProviderUid: string,
  reason: string,
): Promise<void> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_ROLLOUTS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('modelVersion', '==', 'v1')
    .where('status', '==', 'active')
    .get()
  if (snapshot.empty) return
  const batch = db.batch()
  const timestamp = nowIso()
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'rolled_back',
      rollbackReason: reason,
      endedAt: timestamp,
      updatedAt: timestamp,
    } satisfies Partial<ModelV1CanaryRollout>)
  })
  await batch.commit()
}

export async function createModelV1CanaryRollout(input: {
  serviceProviderUid: string
  stableArtifactId: string
  canaryArtifactId: string
  canaryTrafficPercent: number
  qualityGate: ModelV1CanaryQualityGate
  qualityGateResult: ModelV1CanaryQualityGateResult
  stableMetrics: ModelV1CanaryRollout['stableMetrics']
  canaryMetrics: ModelV1CanaryRollout['canaryMetrics']
}): Promise<ModelV1CanaryRollout> {
  await closeActiveRollouts(input.serviceProviderUid, 'Superseded by newer rollout.')
  const status: ModelV1CanaryRollout['status'] = input.qualityGateResult.pass ? 'active' : 'rolled_back'
  const timestamp = nowIso()
  const rollout: ModelV1CanaryRollout = {
    id: `${input.serviceProviderUid}_${randomUUID().slice(0, 10)}`,
    serviceProviderUid: input.serviceProviderUid,
    modelVersion: 'v1',
    stableArtifactId: input.stableArtifactId,
    canaryArtifactId: input.canaryArtifactId,
    canaryTrafficPercent: normalizeTrafficPercent(input.canaryTrafficPercent),
    status,
    qualityGate: input.qualityGate,
    qualityGateResult: input.qualityGateResult,
    stableMetrics: input.stableMetrics,
    canaryMetrics: input.canaryMetrics,
    createdAt: timestamp,
    updatedAt: timestamp,
    endedAt: status === 'active' ? null : timestamp,
    rollbackReason: status === 'active' ? null : input.qualityGateResult.reasons.join(' | '),
  }
  const db = getFirestoreDb()
  await db.collection(MODEL_ROLLOUTS_COLLECTION).doc(rollout.id).set(rollout)
  return rollout
}

export async function resolveServingModelV1Artifact(input: {
  serviceProviderUid: string
  routingKey: string
}): Promise<{ artifact: ModelV1Artifact | null; source: 'stable' | 'canary' | 'none' }> {
  const stable = await getLatestActiveModelV1Artifact(input.serviceProviderUid)
  if (!stable) return { artifact: null, source: 'none' }
  const rollout = await getActiveModelV1CanaryRollout(input.serviceProviderUid)
  if (!rollout) return { artifact: stable, source: 'stable' }
  if (rollout.stableArtifactId !== stable.id) {
    await rollbackActiveModelV1CanaryRollout(input.serviceProviderUid, 'Stable model changed during rollout.')
    return { artifact: stable, source: 'stable' }
  }
  const useCanary = shouldServeCanary({
    routingKey: `${input.routingKey}|${rollout.id}`,
    canaryTrafficPercent: rollout.canaryTrafficPercent,
  })
  if (!useCanary) return { artifact: stable, source: 'stable' }
  const canary = await getModelV1ArtifactById(input.serviceProviderUid, rollout.canaryArtifactId)
  if (!canary) return { artifact: stable, source: 'stable' }
  return { artifact: canary, source: 'canary' }
}

export async function rollbackActiveModelV1CanaryRollout(
  serviceProviderUid: string,
  reason: string,
): Promise<ModelV1CanaryRollout | null> {
  const rollout = await getActiveModelV1CanaryRollout(serviceProviderUid)
  if (!rollout) return null
  await activateModelV1Artifact(serviceProviderUid, rollout.stableArtifactId)
  const db = getFirestoreDb()
  const updated: Partial<ModelV1CanaryRollout> = {
    status: 'rolled_back',
    rollbackReason: reason,
    endedAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.collection(MODEL_ROLLOUTS_COLLECTION).doc(rollout.id).set(updated, { merge: true })
  return { ...rollout, ...updated } as ModelV1CanaryRollout
}

export async function promoteActiveModelV1CanaryRollout(
  serviceProviderUid: string,
): Promise<ModelV1CanaryRollout | null> {
  const rollout = await getActiveModelV1CanaryRollout(serviceProviderUid)
  if (!rollout) return null
  const activated = await activateModelV1Artifact(serviceProviderUid, rollout.canaryArtifactId)
  if (!activated) {
    return rollbackActiveModelV1CanaryRollout(
      serviceProviderUid,
      'Canary model is missing and could not be promoted.',
    )
  }
  const db = getFirestoreDb()
  const updated: Partial<ModelV1CanaryRollout> = {
    status: 'promoted',
    endedAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.collection(MODEL_ROLLOUTS_COLLECTION).doc(rollout.id).set(updated, { merge: true })
  return { ...rollout, ...updated } as ModelV1CanaryRollout
}
