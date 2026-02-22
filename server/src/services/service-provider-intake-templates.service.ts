import { getFirestoreDb } from '../config/firebase.js'
import { getServiceProviderIndustryMeta } from './service-provider-industries.service.js'
import {
  buildDefaultIntakeTemplates,
  toStoredTemplate,
} from './service-provider-intake-templates.catalog.js'
import type {
  IntakeFieldTemplate,
  ServiceProviderIntakeTemplate,
} from './service-provider-intake-templates.types.js'

export const SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION = 'service_provider_intake_templates'

const DEFAULT_TEMPLATES = buildDefaultIntakeTemplates()
const DEFAULT_TEMPLATE_BY_INDUSTRY = new Map(
  DEFAULT_TEMPLATES.map((template) => [template.industry, toStoredTemplate(template)]),
)

function normalizeField(field: IntakeFieldTemplate): IntakeFieldTemplate {
  const options = Array.isArray(field.options)
    ? field.options.map((value) => value.trim()).filter((value) => value.length > 0)
    : undefined
  return {
    key: field.key.trim(),
    label: field.label.trim(),
    type: field.type,
    required: field.required,
    placeholder: field.placeholder?.trim() || undefined,
    hint: field.hint?.trim() || undefined,
    options: options && options.length > 0 ? Array.from(new Set(options)) : undefined,
  }
}

function normalizeTemplate(
  input: ServiceProviderIntakeTemplate,
  fallback: ServiceProviderIntakeTemplate,
): ServiceProviderIntakeTemplate {
  const fields = Array.isArray(input.fields)
    ? input.fields
        .filter((field) => field && typeof field.key === 'string' && typeof field.label === 'string')
        .map(normalizeField)
        .filter((field) => field.key.length > 0 && field.label.length > 0)
    : []
  return {
    id: fallback.id,
    industry: fallback.industry,
    industryLabel:
      typeof input.industryLabel === 'string' && input.industryLabel.trim().length > 0
        ? input.industryLabel.trim()
        : fallback.industryLabel,
    categoryId:
      typeof input.categoryId === 'string' && input.categoryId.trim().length > 0
        ? input.categoryId.trim()
        : fallback.categoryId,
    categoryLabel:
      typeof input.categoryLabel === 'string' && input.categoryLabel.trim().length > 0
        ? input.categoryLabel.trim()
        : fallback.categoryLabel,
    fields: fields.length > 0 ? fields : fallback.fields,
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim().length > 0
        ? input.updatedAt.trim()
        : fallback.updatedAt,
  }
}

function getFallbackTemplate(industry: string): ServiceProviderIntakeTemplate {
  const industryMeta = getServiceProviderIndustryMeta(industry)
  return (
    DEFAULT_TEMPLATE_BY_INDUSTRY.get(industryMeta.value) ??
    Array.from(DEFAULT_TEMPLATE_BY_INDUSTRY.values())[0]
  )
}

export async function getServiceProviderIntakeTemplateByIndustry(
  industry: string,
): Promise<ServiceProviderIntakeTemplate> {
  const fallback = getFallbackTemplate(industry)
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION)
    .doc(fallback.id)
    .get()
  if (!snapshot.exists) return fallback
  return normalizeTemplate(snapshot.data() as ServiceProviderIntakeTemplate, fallback)
}

export async function seedDefaultIntakeTemplatesToFirestore(): Promise<{ upserted: number }> {
  const db = getFirestoreDb()
  const collection = db.collection(SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION)
  const defaults = DEFAULT_TEMPLATES.map(toStoredTemplate)
  let upserted = 0

  for (let i = 0; i < defaults.length; i += 400) {
    const chunk = defaults.slice(i, i + 400)
    const batch = db.batch()
    chunk.forEach((template) => {
      batch.set(collection.doc(template.id), template, { merge: true })
      upserted += 1
    })
    await batch.commit()
  }

  return { upserted }
}

