import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'
import type { TrainingDatasetExample } from '../types/training-dataset.js'
import type { ModelFeatureRow, ModelFeatureSchema } from '../types/model-feature-schema.js'

const MODEL_FEATURE_SCHEMA_V1: ModelFeatureSchema = {
  version: 'v1',
  fields: [
    { name: 'itemKey', type: 'string' },
    { name: 'unit', type: 'string' },
    { name: 'quantity', type: 'number' },
    { name: 'projectType', type: 'string' },
    { name: 'scope', type: 'string' },
    { name: 'urgency', type: 'string' },
    { name: 'requirementsState', type: 'string' },
    { name: 'inventorySurplus', type: 'number' },
    { name: 'availableWorkers', type: 'number' },
    { name: 'hasInventorySurplus', type: 'number' },
    { name: 'hasAvailableWorkers', type: 'number' },
  ],
}

type InferenceFeatureInput = {
  itemKey?: string | null
  itemName?: string | null
  unit: string
  quantity: number
  industry?: string | null
  projectType?: string | null
  scope?: string | null
  urgency?: string | null
  requirements?: string | null
  inventorySurplus?: number | null
  availableWorkers?: number | null
}

function normalizeCategory(value: string | null | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : 'unknown'
}

function normalizeRequirementsState(value: string | null | undefined): 'none' | 'present' {
  return (value ?? '').trim().length > 0 ? 'present' : 'none'
}

function safeNumber(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Number(value)
}

function hasNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? 1 : 0
}

function resolveItemKey(input: InferenceFeatureInput): string {
  const explicit = (input.itemKey ?? '').trim()
  if (explicit.length > 0) return explicit
  const name = (input.itemName ?? '').trim()
  if (name.length === 0) throw new Error('Missing itemKey or itemName for model feature mapping.')
  const canonical = canonicalizeTrainingItemForIndustry(name, input.unit, input.industry ?? null)
  return canonical.itemKey
}

export function getModelFeatureSchema(): ModelFeatureSchema {
  return MODEL_FEATURE_SCHEMA_V1
}

export function buildModelFeatureRowFromDatasetExample(example: TrainingDatasetExample): ModelFeatureRow {
  return {
    itemKey: example.itemKey,
    unit: example.unit,
    quantity: example.quantity,
    projectType: normalizeCategory(example.featureProjectType) as ModelFeatureRow['projectType'],
    scope: normalizeCategory(example.featureScope) as ModelFeatureRow['scope'],
    urgency: normalizeCategory(example.featureUrgency) as ModelFeatureRow['urgency'],
    requirementsState: normalizeRequirementsState(example.featureRequirements),
    inventorySurplus: safeNumber(example.featureInventorySurplus),
    availableWorkers: safeNumber(example.featureAvailableWorkers),
    hasInventorySurplus: hasNumber(example.featureInventorySurplus),
    hasAvailableWorkers: hasNumber(example.featureAvailableWorkers),
  }
}

export function buildModelFeatureRowFromInferenceInput(input: InferenceFeatureInput): ModelFeatureRow {
  return {
    itemKey: resolveItemKey(input),
    unit: input.unit,
    quantity: input.quantity,
    projectType: normalizeCategory(input.projectType) as ModelFeatureRow['projectType'],
    scope: normalizeCategory(input.scope) as ModelFeatureRow['scope'],
    urgency: normalizeCategory(input.urgency) as ModelFeatureRow['urgency'],
    requirementsState: normalizeRequirementsState(input.requirements),
    inventorySurplus: safeNumber(input.inventorySurplus),
    availableWorkers: safeNumber(input.availableWorkers),
    hasInventorySurplus: hasNumber(input.inventorySurplus),
    hasAvailableWorkers: hasNumber(input.availableWorkers),
  }
}

export function validateModelFeatureRow(row: ModelFeatureRow): string[] {
  const errors: string[] = []
  if (!row.itemKey || row.itemKey.trim().length < 3) errors.push('itemKey')
  if (!row.unit || row.unit.trim().length === 0) errors.push('unit')
  if (!Number.isFinite(row.quantity) || row.quantity <= 0) errors.push('quantity')
  if (!Number.isFinite(row.inventorySurplus)) errors.push('inventorySurplus')
  if (!Number.isFinite(row.availableWorkers)) errors.push('availableWorkers')
  if (![0, 1].includes(row.hasInventorySurplus)) errors.push('hasInventorySurplus')
  if (![0, 1].includes(row.hasAvailableWorkers)) errors.push('hasAvailableWorkers')
  return errors
}

export function serializeModelFeatureRow(row: ModelFeatureRow): Array<string | number> {
  const schema = getModelFeatureSchema()
  return schema.fields.map((field) => row[field.name as keyof ModelFeatureRow])
}
