import { env } from '../config/env.js'
import { getFirestoreDb } from '../config/firebase.js'
import { baseContactFields, requirementsField } from './dynamic-form-core-fields.service.js'
import { buildIntakeDynamicFields } from './dynamic-form-intake-fields.service.js'
import { DYNAMIC_FORM_SCHEMAS_COLLECTION } from './model-profile.service.js'
import { listProviderLineItemOptions } from './provider-line-items.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import { getServiceProviderIntakeTemplateByIndustry } from './service-provider-intake-templates.service.js'
import type { DynamicFormSchema, PricingUnit } from '../types/model-profile.js'

const MAX_DYNAMIC_FIELDS = Math.max(5, Math.min(120, env.clientFormMaxItems))

function nowIso(): string {
  return new Date().toISOString()
}

function isClientUnitAllowed(unit: PricingUnit): boolean {
  return (
    unit !== 'unknown' &&
    unit !== 'percent' &&
    unit !== 'fixed' &&
    unit !== 'day' &&
    unit !== 'hour'
  )
}

export async function buildDynamicFormSchema(serviceProviderUid: string): Promise<DynamicFormSchema> {
  const [lineItemOptions, serviceProviderProfile] = await Promise.all([
    listProviderLineItemOptions(serviceProviderUid),
    getServiceProviderByUid(serviceProviderUid),
  ])
  const intakeTemplate = await getServiceProviderIntakeTemplateByIndustry(
    serviceProviderProfile?.industry ?? '',
  )
  const clientItems = lineItemOptions
    .filter((item) => item.visibleToClient && !item.isProviderOnly && isClientUnitAllowed(item.unit))
    .slice(0, MAX_DYNAMIC_FIELDS)

  const fields = baseContactFields()
  fields.push(...buildIntakeDynamicFields(intakeTemplate.fields, fields.length + 1))
  fields.push(requirementsField(fields.length + 1))

  const schema: DynamicFormSchema = {
    id: serviceProviderUid,
    serviceProviderUid,
    version: 1,
    generatedAt: nowIso(),
    sourceItemsCount: clientItems.length,
    fields,
  }

  const db = getFirestoreDb()
  await db.collection(DYNAMIC_FORM_SCHEMAS_COLLECTION).doc(serviceProviderUid).set(schema, {
    merge: true,
  })
  return schema
}
