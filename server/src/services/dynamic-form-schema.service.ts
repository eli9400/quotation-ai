import { env } from '../config/env.js'
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

const MAX_DYNAMIC_FIELDS = Math.max(5, Math.min(120, env.clientFormMaxItems))
const MIN_SAMPLES_PER_CLIENT_FIELD = 1
const CLIENT_FIELD_IGNORE_PATTERNS = [
  /מע.?מ/i,
  /vat/i,
  /סה.?כ/i,
  /total/i,
  /subtotal/i,
  /תנאי תשלום/i,
  /מקדמה/i,
  /יתרה/i,
  /הנחה/i,
  /discount/i,
  /תכנון\/?ניהול/i,
  /ניהול פרויקט/i,
  /אחוז/i,
  /percent/i,
]
const TRAILING_UNIT_PATTERN =
  /\s*\((מ["׳']?ר|sqm|m2|יחידות?|unit|points?|נקודות?|days?|ימים?|containers?|מכולות?|קומפלט|package|שעות?|hours?|meters?|מטרים?|%)\)\s*$/i
const LEADING_UNIT_PATTERN =
  /^(מ["׳']?ר|sqm|m2|יחידות?|יחידה|unit|נקודות?|נקודה|points?|ימים?|יום|days?|מכולות?|מכולה|containers?|קומפלט|package|שעות?|hours?|מטרים?|meters?)\s*[:-]?\s+/i
const UNIT_PRIORITY: Record<PricingUnit, number> = {
  sqm: 1,
  point: 2,
  day: 3,
  container: 4,
  package: 5,
  meter: 6,
  unit: 7,
  hour: 8,
  fixed: 9,
  percent: 10,
  unknown: 11,
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeLabel(label: string): string {
  let value = label.replace(TRAILING_UNIT_PATTERN, '').trim()
  while (LEADING_UNIT_PATTERN.test(value)) {
    value = value.replace(LEADING_UNIT_PATTERN, '').trim()
  }
  return value.replace(/\s+/g, ' ').trim()
}

function resolveClientUnit(item: LearnedPricingItem): PricingUnit {
  const source = `${item.canonicalName} ${(item.aliases ?? []).join(' ')}`.toLowerCase()
  if (/נקוד|point/.test(source)) return 'point'
  if (/יום עבודה|ימים?|day/.test(source)) return 'day'
  if (/מכול|container/.test(source)) return 'container'
  if (/קומפלט|package/.test(source)) return 'package'
  if (/%|אחוז|percent/.test(source)) return 'percent'
  if (item.unit === 'fixed' && /קומפלט|package/.test(source)) return 'package'
  return item.unit
}

function unitLabel(unit: PricingUnit): string {
  switch (unit) {
    case 'sqm':
      return 'מ"ר'
    case 'unit':
      return 'יחידות'
    case 'point':
      return 'נקודות'
    case 'day':
      return 'ימים'
    case 'container':
      return 'מכולות'
    case 'package':
      return 'קומפלט'
    case 'hour':
      return 'שעות'
    case 'meter':
      return 'מטר'
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
    case 'point':
      return 'לדוגמה: 8'
    case 'day':
      return 'לדוגמה: 5'
    case 'container':
      return 'לדוגמה: 1'
    case 'package':
      return 'לדוגמה: 1'
    case 'hour':
      return 'לדוגמה: 8'
    case 'meter':
      return 'לדוגמה: 25'
    default:
      return 'לדוגמה: 1'
  }
}

function titleFromItem(item: LearnedPricingItem): string {
  const preferred = item.aliases?.find((name) => name.trim().length > 0) ?? item.canonicalName
  return normalizeLabel(preferred.trim())
}

function isClientUnitAllowed(unit: PricingUnit): boolean {
  return unit !== 'unknown' && unit !== 'percent' && unit !== 'fixed'
}

function isClientSafeItem(item: LearnedPricingItem): boolean {
  if (item.sampleLines < MIN_SAMPLES_PER_CLIENT_FIELD) {
    return false
  }

  const normalizedUnit = resolveClientUnit(item)
  if (!isClientUnitAllowed(normalizedUnit)) {
    return false
  }

  const label = titleFromItem(item)
  if (!label || label.length > 90) {
    return false
  }
  return !CLIENT_FIELD_IGNORE_PATTERNS.some((pattern) => pattern.test(label))
}

function pickBestItem(current: LearnedPricingItem, next: LearnedPricingItem): LearnedPricingItem {
  const nextUnit = resolveClientUnit(next)
  const currentUnit = resolveClientUnit(current)
  const nextScore = UNIT_PRIORITY[nextUnit]
  const currentScore = UNIT_PRIORITY[currentUnit]
  if (next.sampleLines !== current.sampleLines) {
    return next.sampleLines > current.sampleLines ? next : current
  }
  if (nextScore !== currentScore) {
    return nextScore < currentScore ? next : current
  }
  return next.lastUpdatedAt.localeCompare(current.lastUpdatedAt) > 0 ? next : current
}

function dedupeItemsForClient(items: LearnedPricingItem[]): LearnedPricingItem[] {
  const grouped = new Map<string, LearnedPricingItem>()
  items.forEach((item) => {
    const key = normalizeLabel(titleFromItem(item)).toLowerCase()
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, item)
      return
    }
    grouped.set(key, pickBestItem(existing, item))
  })

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.sampleLines !== a.sampleLines) {
      return b.sampleLines - a.sampleLines
    }
    return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)
  })
}

function toNumberField(item: LearnedPricingItem, order: number): DynamicFormField {
  const clientUnit = resolveClientUnit(item)
  const clientLabel = titleFromItem(item)
  return {
    id: `qty_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    label: `${clientLabel} (${unitLabel(clientUnit)})`,
    type: 'number',
    role: 'input_qty',
    visibleTo: 'client',
    editableBy: 'client',
    required: false,
    order,
    sourceItemId: item.id,
    placeholder: defaultPlaceholderForUnit(clientUnit),
    hint: null,
    options: [],
  }
}

function baseFields(): DynamicFormField[] {
  return [
    { id: 'clientName', label: 'שם לקוח', type: 'text', role: 'contact', visibleTo: 'client', editableBy: 'client', required: true, order: 1, sourceItemId: null, placeholder: 'ישראל ישראלי', hint: null, options: [] },
    { id: 'clientEmail', label: 'אימייל לקוח', type: 'text', role: 'contact', visibleTo: 'client', editableBy: 'client', required: true, order: 2, sourceItemId: null, placeholder: 'client@example.com', hint: null, options: [] },
    { id: 'requirements', label: 'הערות ודרישות', type: 'textarea', role: 'requirements', visibleTo: 'client', editableBy: 'client', required: false, order: 3, sourceItemId: null, placeholder: 'פרטים נוספים על העבודה', hint: null, options: [] },
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

  return snapshot.docs.map((doc) => doc.data() as LearnedPricingItem)
}

export async function buildDynamicFormSchema(
  serviceProviderUid: string,
): Promise<DynamicFormSchema> {
  const learnedItems = await listLearnedPricingItems(serviceProviderUid)
  const selectedItems = dedupeItemsForClient(learnedItems.filter(isClientSafeItem)).slice(
    0,
    MAX_DYNAMIC_FIELDS,
  )
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
