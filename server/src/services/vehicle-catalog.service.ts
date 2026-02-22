import { getFirestoreDb } from '../config/firebase.js'
import {
  listPreferredManufacturersByVehicleTypes,
} from './vehicle-manufacturers.catalog.js'
import { listPreferredVehicleTrims } from './vehicle-trims.catalog.js'

type VehicleOption = {
  value: string
  label: string
}

type VehicleCacheDoc = {
  updatedAt: string
  items: VehicleOption[]
}

type VehicleApiResultItem = {
  Make_Name?: unknown
  Model_Name?: unknown
  MakeName?: unknown
}

type VehicleApiResponse = {
  Results?: VehicleApiResultItem[]
}

const VEHICLE_CATALOG_CACHE_COLLECTION = 'vehicle_catalog_cache'
const MEMORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const FIRESTORE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SOURCE_TIMEOUT_MS = 15_000
const ALLOWED_VEHICLE_TYPES = new Set(['car', 'truck', 'bus', 'motorcycle'])
const DEFAULT_VEHICLE_TYPES = ['car', 'truck']

const memoryCache = new Map<string, { updatedAt: number; items: VehicleOption[] }>()

function nowIso(): string {
  return new Date().toISOString()
}

function isFresh(updatedAtMs: number, maxAgeMs: number): boolean {
  return Date.now() - updatedAtMs <= maxAgeMs
}

function normalizeMake(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sanitizeOptions(values: string[]): VehicleOption[] {
  const unique = Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  )
  return unique
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((value) => ({ value, label: value }))
}

function toOptionsInGivenOrder(values: string[]): VehicleOption[] {
  return values.map((value) => ({ value, label: value }))
}

function normalizeVehicleTypes(vehicleTypes?: string[]): string[] {
  if (!Array.isArray(vehicleTypes) || vehicleTypes.length === 0) {
    return DEFAULT_VEHICLE_TYPES
  }
  const normalized = Array.from(
    new Set(
      vehicleTypes
        .map((value) => value.trim().toLowerCase())
        .filter((value) => ALLOWED_VEHICLE_TYPES.has(value)),
    ),
  )
  return normalized.length > 0 ? normalized : DEFAULT_VEHICLE_TYPES
}

async function readCache(docId: string): Promise<VehicleOption[] | null> {
  const memory = memoryCache.get(docId)
  if (memory && isFresh(memory.updatedAt, MEMORY_CACHE_TTL_MS)) {
    return memory.items
  }

  try {
    const db = getFirestoreDb()
    const snapshot = await db.collection(VEHICLE_CATALOG_CACHE_COLLECTION).doc(docId).get()
    if (!snapshot.exists) return null
    const payload = snapshot.data() as Partial<VehicleCacheDoc>
    const updatedAtMs = Date.parse(payload.updatedAt ?? '')
    if (!Number.isFinite(updatedAtMs) || !isFresh(updatedAtMs, FIRESTORE_CACHE_TTL_MS)) {
      return null
    }
    const items = Array.isArray(payload.items)
      ? payload.items.filter(
          (item): item is VehicleOption =>
            !!item &&
            typeof item.value === 'string' &&
            typeof item.label === 'string' &&
            item.value.trim().length > 0,
        )
      : []
    if (items.length === 0) return null
    memoryCache.set(docId, { updatedAt: Date.now(), items })
    return items
  } catch {
    return null
  }
}

async function writeCache(docId: string, items: VehicleOption[]): Promise<void> {
  memoryCache.set(docId, { updatedAt: Date.now(), items })
  try {
    const db = getFirestoreDb()
    await db
      .collection(VEHICLE_CATALOG_CACHE_COLLECTION)
      .doc(docId)
      .set(
        {
          updatedAt: nowIso(),
          items,
        } satisfies VehicleCacheDoc,
        { merge: true },
      )
  } catch {
    // Ignore Firestore cache write errors to keep endpoint available.
  }
}

async function fetchVehicleApi(path: string): Promise<VehicleApiResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS)
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/${path}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Vehicle catalog source error: ${response.status}`)
    }
    return (await response.json()) as VehicleApiResponse
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchManufacturersFromSource(vehicleTypes: string[]): Promise<VehicleOption[]> {
  const preferred = listPreferredManufacturersByVehicleTypes(vehicleTypes)
  return toOptionsInGivenOrder(preferred)
}

async function fetchModelsFromSource(make: string): Promise<VehicleOption[]> {
  const encodedMake = encodeURIComponent(make)
  const payload = await fetchVehicleApi(`GetModelsForMake/${encodedMake}?format=json`)
  const values = (payload.Results ?? [])
    .map((item) => (typeof item.Model_Name === 'string' ? item.Model_Name : ''))
    .filter((value) => value.length > 0)
  return sanitizeOptions(values)
}

async function fetchModelsForYearFromSource(make: string, year: number): Promise<VehicleOption[]> {
  const encodedMake = encodeURIComponent(make)
  const payload = await fetchVehicleApi(
    `GetModelsForMakeYear/make/${encodedMake}/modelyear/${year}?format=json`,
  )
  const values = (payload.Results ?? [])
    .map((item) => (typeof item.Model_Name === 'string' ? item.Model_Name : ''))
    .filter((value) => value.length > 0)
  return sanitizeOptions(values)
}

export async function listVehicleManufacturers(
  vehicleTypes?: string[],
): Promise<VehicleOption[]> {
  const normalizedTypes = normalizeVehicleTypes(vehicleTypes)
  const cacheId = `manufacturers_v4_${normalizedTypes.join('_')}`
  const cached = await readCache(cacheId)
  if (cached && cached.length > 0) return cached

  const items = await fetchManufacturersFromSource(normalizedTypes)
  if (items.length > 0) await writeCache(cacheId, items)
  return items
}

export async function listVehicleModelsByMake(
  make: string,
  year: number | null = null,
): Promise<VehicleOption[]> {
  const normalizedMake = make.trim()
  if (normalizedMake.length < 2) return []
  const yearSuffix = year && Number.isInteger(year) ? `_${year}` : ''
  const cacheId = `models_${normalizeMake(normalizedMake)}${yearSuffix}`
  const cached = await readCache(cacheId)
  if (cached && cached.length > 0) return cached

  const items =
    year && Number.isInteger(year)
      ? await fetchModelsForYearFromSource(normalizedMake, year)
      : await fetchModelsFromSource(normalizedMake)
  if (items.length > 0) await writeCache(cacheId, items)
  return items
}

export async function listVehicleTrimsByMake(make?: string | null): Promise<VehicleOption[]> {
  const normalizedMake = typeof make === 'string' ? make.trim() : ''
  const cacheId = normalizedMake
    ? `trims_v1_${normalizeMake(normalizedMake)}`
    : 'trims_v1_default'
  const cached = await readCache(cacheId)
  if (cached && cached.length > 0) return cached

  const items = toOptionsInGivenOrder(listPreferredVehicleTrims(normalizedMake || null))
  if (items.length > 0) await writeCache(cacheId, items)
  return items
}
