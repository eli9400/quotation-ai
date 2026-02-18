import { getFirestoreDb } from '../config/firebase.js'
import {
  DYNAMIC_FORM_SCHEMAS_COLLECTION,
  PRICING_ITEMS_COLLECTION,
} from './model-profile.service.js'
import type {
  DynamicFormField,
  DynamicFormSchema,
  LearnedPricingItem,
  PricingUnit,
} from '../types/model-profile.js'

const MAX_DYNAMIC_FIELDS = 14

function nowIso(): string {
  return new Date().toISOString()
}

function unitLabel(unit: PricingUnit): string {
  switch (unit) {
    case 'sqm':
      return 'מ"ר'
    case 'unit':
      return 'יחידות'
    case 'hour':
      return 'שעות'
    case 'meter':
      return 'מטר'
    case 'fixed':
      return 'מחיר קבוע'
    default:
      return 'כמות'
  }
}

function defaultPlaceholderForUnit(unit: PricingUnit): string {
  switch (unit) {
    case 'sqm':
      return 'לדוגמה: 100'
    case 'unit':
      return 'לדוגמה: 10'
    case 'hour':
      return 'לדוגמה: 8'
    case 'meter':
      return 'לדוגמה: 25'
    case 'fixed':
      return 'לדוגמה: 1'
    default:
      return 'לדוגמה: 1'
  }
}

function titleFromItem(item: LearnedPricingItem): string {
  const preferred = item.aliases?.find((name) => name.trim().length > 0) ?? item.canonicalName
  return preferred.trim()
}

function toNumberField(item: LearnedPricingItem, order: number): DynamicFormField {
  return {
    id: `qty_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    label: `${titleFromItem(item)} (${unitLabel(item.unit)})`,
    type: 'number',
    required: false,
    order,
    sourceItemId: item.id,
    placeholder: defaultPlaceholderForUnit(item.unit),
    hint: null,
    options: [],
  }
}

function baseFields(): DynamicFormField[] {
  return [
    {
      id: 'clientName',
      label: 'שם לקוח',
      type: 'text',
      required: true,
      order: 1,
      sourceItemId: null,
      placeholder: 'ישראל ישראלי',
      hint: null,
      options: [],
    },
    {
      id: 'clientEmail',
      label: 'אימייל לקוח',
      type: 'text',
      required: true,
      order: 2,
      sourceItemId: null,
      placeholder: 'client@example.com',
      hint: null,
      options: [],
    },
    {
      id: 'requirements',
      label: 'הערות ודרישות',
      type: 'textarea',
      required: false,
      order: 3,
      sourceItemId: null,
      placeholder: 'פרטים נוספים על העבודה',
      hint: null,
      options: [],
    },
  ]
}

export async function listLearnedPricingItems(
  serviceProviderUid: string,
): Promise<LearnedPricingItem[]> {
  const db = getFirestoreDb()
  const snapshot = await db
    .collection(PRICING_ITEMS_COLLECTION)
    .where('serviceProviderUid', '==', serviceProviderUid)
    .get()

  return snapshot.docs
    .map((doc) => doc.data() as LearnedPricingItem)
    .sort((a, b) => {
      if (b.sampleLines !== a.sampleLines) {
        return b.sampleLines - a.sampleLines
      }
      return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)
    })
}

export async function buildDynamicFormSchema(
  serviceProviderUid: string,
): Promise<DynamicFormSchema> {
  const learnedItems = await listLearnedPricingItems(serviceProviderUid)
  const selectedItems = learnedItems.slice(0, MAX_DYNAMIC_FIELDS)
  const fields = baseFields()
  const startOrder = fields.length + 1

  selectedItems.forEach((item, index) => {
    fields.push(toNumberField(item, startOrder + index))
  })

  const schema: DynamicFormSchema = {
    id: serviceProviderUid,
    serviceProviderUid,
    version: 1,
    generatedAt: nowIso(),
    sourceItemsCount: learnedItems.length,
    fields,
  }

  const db = getFirestoreDb()
  await db.collection(DYNAMIC_FORM_SCHEMAS_COLLECTION).doc(serviceProviderUid).set(schema, {
    merge: true,
  })
  return schema
}
