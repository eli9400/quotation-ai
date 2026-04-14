import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import type { ModelV1Artifact } from '../types/model-v1.js'

export const MODEL_ARTIFACTS_COLLECTION = 'model_artifacts'

const CACHE_TTL_MS = 60_000
const artifactCache = new Map<string, { expiresAt: number; artifact: ModelV1Artifact | null }>()

function nowIso(): string {
  return new Date().toISOString()
}

function cacheKey(serviceProviderUid: string): string {
  return `${serviceProviderUid}:v1`
}

function invalidateCache(serviceProviderUid: string): void {
  artifactCache.delete(cacheKey(serviceProviderUid))
}

function getCached(serviceProviderUid: string): ModelV1Artifact | null | undefined {
  const entry = artifactCache.get(cacheKey(serviceProviderUid))
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    artifactCache.delete(cacheKey(serviceProviderUid))
    return undefined
  }
  return entry.artifact
}

function setCached(serviceProviderUid: string, artifact: ModelV1Artifact | null): void {
  artifactCache.set(cacheKey(serviceProviderUid), {
    expiresAt: Date.now() + CACHE_TTL_MS,
    artifact,
  })
}

async function listProviderArtifacts(serviceProviderUid: string): Promise<ModelV1Artifact[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(MODEL_ARTIFACTS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .where('modelVersion', '==', 'v1')
    .get()
  return snapshot.docs.map((doc) => doc.data() as ModelV1Artifact)
}

export async function getLatestActiveModelV1Artifact(
  serviceProviderUid: string,
): Promise<ModelV1Artifact | null> {
  const cached = getCached(serviceProviderUid)
  if (cached !== undefined) return cached

  const artifacts = await listProviderArtifacts(serviceProviderUid)
  const active = artifacts
    .filter((artifact) => artifact.active)
    .sort((left, right) => right.trainedAt.localeCompare(left.trainedAt))[0]
  const resolved = active ?? null
  setCached(serviceProviderUid, resolved)
  return resolved
}

export async function saveAndActivateModelV1Artifact(input: {
  serviceProviderUid: string
  datasetVersionId: string | null
  datasetFingerprint: string | null
  featureSchemaVersion: string
  payload: ModelV1Artifact['payload']
  metrics: ModelV1Artifact['metrics']
}): Promise<ModelV1Artifact> {
  const db = getFirestoreDb()
  const id = `${input.serviceProviderUid}_${randomUUID().slice(0, 12)}`
  const trainedAt = nowIso()
  const artifact: ModelV1Artifact = {
    id,
    serviceProviderUid: input.serviceProviderUid,
    modelVersion: 'v1',
    algorithm: 'linear_quantity_v1',
    active: true,
    trainedAt,
    datasetVersionId: input.datasetVersionId,
    datasetFingerprint: input.datasetFingerprint,
    featureSchemaVersion: input.featureSchemaVersion,
    metrics: input.metrics,
    payload: input.payload,
  }

  const existing = await listProviderArtifacts(input.serviceProviderUid)
  const batch = db.batch()
  existing
    .filter((row) => row.active)
    .forEach((row) =>
      batch.update(db.collection(MODEL_ARTIFACTS_COLLECTION).doc(row.id), { active: false }),
    )
  batch.set(db.collection(MODEL_ARTIFACTS_COLLECTION).doc(artifact.id), artifact)
  await batch.commit()
  invalidateCache(input.serviceProviderUid)
  setCached(input.serviceProviderUid, artifact)
  return artifact
}
