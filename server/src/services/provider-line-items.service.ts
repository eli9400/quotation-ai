import { listLearnedPricingItems } from './dynamic-form-schema.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { PricingUnit } from '../types/model-profile.js'
import type { ServiceProviderIndustry } from '../types/service-provider.js'

export type ProviderLineItemOption = {
  id: string
  label: string
  canonicalName: string
  unit: PricingUnit
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
  isProviderOnly: boolean
}

type CatalogItem = {
  key: string
  name: string
  unit: PricingUnit
  aliases?: string[]
}

const PROVIDER_ONLY_PATTERNS = [
  /מע["״׳]?מ/i,
  /vat/i,
  /סה["״׳]?כ/i,
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

const CLIENT_UNITS = new Set<PricingUnit>([
  'sqm',
  'unit',
  'point',
  'container',
  'package',
  'hour',
  'meter',
])

const INDUSTRY_CATALOG: Record<ServiceProviderIndustry, CatalogItem[]> = {
  general: [
    { key: 'painting_walls', name: 'צביעת קירות ותקרות', unit: 'sqm' },
    { key: 'plaster_walls', name: 'שפכטל והכנת קירות', unit: 'sqm' },
    { key: 'floor_tiles', name: 'ריצוף גרניט פורצלן', unit: 'sqm' },
    { key: 'electrical_point', name: 'התקנת נקודת חשמל', unit: 'point' },
    { key: 'water_point', name: 'נקודת מים/ביוב', unit: 'point' },
    { key: 'debris_container', name: 'פינוי מכולה פסולת', unit: 'container' },
  ],
  renovation: [
    { key: 'demolition', name: 'פירוק והריסה', unit: 'sqm' },
    { key: 'plaster_walls', name: 'שפכטל והכנת קירות', unit: 'sqm' },
    { key: 'painting_walls', name: 'צביעת קירות ותקרות', unit: 'sqm' },
    { key: 'floor_tiles', name: 'ריצוף גרניט פורצלן', unit: 'sqm' },
    { key: 'bath_cladding', name: 'חיפוי קירות אמבטיה', unit: 'sqm' },
    { key: 'laminate_floor', name: 'התקנת פרקט למינציה', unit: 'sqm' },
  ],
  electrical: [
    { key: 'electrical_point', name: 'התקנת נקודת חשמל', unit: 'point' },
    { key: 'lighting_point', name: 'התקנת נקודת תאורה', unit: 'point' },
    { key: 'switch_socket', name: 'החלפת מפסק/שקע', unit: 'unit' },
    { key: 'panel_upgrade', name: 'שדרוג לוח חשמל', unit: 'unit' },
    { key: 'network_point', name: 'נקודת תקשורת', unit: 'point' },
  ],
  plumbing: [
    { key: 'water_point', name: 'נקודת מים/ביוב', unit: 'point' },
    { key: 'sink_install', name: 'התקנת כיור', unit: 'unit' },
    { key: 'toilet_install', name: 'התקנת אסלה', unit: 'unit' },
    { key: 'faucet_replace', name: 'החלפת ברז', unit: 'unit' },
    { key: 'pipe_repair', name: 'תיקון צנרת', unit: 'meter' },
  ],
  painting: [
    { key: 'painting_walls', name: 'צביעת קירות ותקרות', unit: 'sqm' },
    { key: 'plaster_walls', name: 'שפכטל והכנת קירות', unit: 'sqm' },
    { key: 'primer_coat', name: 'צביעת יסוד', unit: 'sqm' },
    { key: 'door_paint', name: 'צביעת דלת/משקוף', unit: 'unit' },
  ],
  cleaning: [
    { key: 'standard_cleaning', name: 'ניקיון סטנדרטי', unit: 'sqm' },
    { key: 'post_renovation', name: 'ניקיון אחרי שיפוץ', unit: 'sqm' },
    { key: 'window_cleaning', name: 'ניקוי חלונות', unit: 'sqm' },
    { key: 'pressure_wash', name: 'שטיפה בלחץ', unit: 'sqm' },
  ],
  hvac: [
    { key: 'ac_install', name: 'התקנת מזגן', unit: 'unit' },
    { key: 'ac_service', name: 'טיפול תקופתי למזגן', unit: 'unit' },
    { key: 'ac_repair', name: 'תיקון מזגן', unit: 'unit' },
    { key: 'drain_pipe', name: 'התקנת צנרת ניקוז', unit: 'meter' },
  ],
  gardening: [
    { key: 'lawn_setup', name: 'הקמת דשא', unit: 'sqm' },
    { key: 'irrigation_point', name: 'נקודת השקיה', unit: 'point' },
    { key: 'tree_trimming', name: 'גיזום עצים', unit: 'unit' },
    { key: 'garden_maintenance', name: 'תחזוקת גינה', unit: 'hour' },
  ],
}

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim()
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/[+/_-]+/g, ' ').replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function isProviderOnly(unit: PricingUnit, label: string): boolean {
  if (!CLIENT_UNITS.has(unit)) return true
  return PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label))
}

function buildDisplayLabel(label: string, unit: PricingUnit): string {
  return `${normalizeLabel(label)} (${unit})`
}

function toLearnedOption(item: Awaited<ReturnType<typeof listLearnedPricingItems>>[number]): ProviderLineItemOption {
  const primaryAlias = item.aliases?.find((value) => value.trim().length > 0)
  const rawLabel = normalizeLabel(primaryAlias || item.canonicalName)
  return {
    id: item.id,
    label: buildDisplayLabel(rawLabel, item.unit),
    canonicalName: rawLabel,
    unit: item.unit,
    aliases: item.aliases ?? [],
    sampleLines: item.sampleLines,
    quantityPriceSamples: item.quantityPriceSamples ?? [],
    isProviderOnly: isProviderOnly(item.unit, rawLabel),
  }
}

function toCatalogOptions(industry: ServiceProviderIndustry): ProviderLineItemOption[] {
  const items = INDUSTRY_CATALOG[industry] ?? INDUSTRY_CATALOG.general
  return items.map((item) => {
    const canonicalName = normalizeLabel(item.name)
    return {
      id: `catalog_${industry}_${item.key}`,
      label: buildDisplayLabel(canonicalName, item.unit),
      canonicalName,
      unit: item.unit,
      aliases: item.aliases ?? [],
      sampleLines: 0,
      quantityPriceSamples: [],
      isProviderOnly: isProviderOnly(item.unit, canonicalName),
    }
  })
}

function dedupeOptions(options: ProviderLineItemOption[]): ProviderLineItemOption[] {
  const grouped = new Map<string, ProviderLineItemOption>()
  options.forEach((option) => {
    const key = `${normalizeForKey(option.canonicalName)}|${option.unit}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, option)
      return
    }
    const aliases = Array.from(new Set([...existing.aliases, ...option.aliases])).filter(Boolean)
    const mergedSamples = [...existing.quantityPriceSamples, ...option.quantityPriceSamples]
    const sampleLines = existing.sampleLines + option.sampleLines
    if (option.sampleLines > existing.sampleLines) {
      grouped.set(key, { ...option, aliases, sampleLines, quantityPriceSamples: mergedSamples })
      return
    }
    grouped.set(key, { ...existing, aliases, sampleLines, quantityPriceSamples: mergedSamples })
  })
  return Array.from(grouped.values())
}

export async function listProviderLineItemOptions(
  serviceProviderUid: string,
): Promise<ProviderLineItemOption[]> {
  const learnedItems = await listLearnedPricingItems(serviceProviderUid)
  if (learnedItems.length > 0) {
    return dedupeOptions(learnedItems.map(toLearnedOption))
      .filter((item) => item.canonicalName.length > 0)
      .sort((left, right) => right.sampleLines - left.sampleLines || left.label.localeCompare(right.label, 'he'))
  }

  const profile = await getServiceProviderByUid(serviceProviderUid)
  const industry = profile?.industry ?? 'general'
  return dedupeOptions(toCatalogOptions(industry))
    .filter((item) => item.canonicalName.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label, 'he'))
}
