import type { PricingUnit } from '../types/model-profile.js'

export type ProviderCatalogLineItem = {
  key: string
  name: string
  unit: PricingUnit
  aliases?: string[]
}

type CatalogTemplate = {
  suffix: string
  name: string
  unit: PricingUnit
}

const CATEGORY_GENERIC_TEMPLATES: Record<string, CatalogTemplate[]> = {
  construction_renovation: [
    { suffix: 'visit', name: 'ביקור שירות', unit: 'unit' },
    { suffix: 'hourly', name: 'עבודת שטח לפי שעה', unit: 'hour' },
    { suffix: 'package', name: 'חבילת עבודה', unit: 'package' },
  ],
  transport_logistics: [
    { suffix: 'visit', name: 'ביקור שירות', unit: 'unit' },
    { suffix: 'hourly', name: 'שעת עבודה', unit: 'hour' },
    { suffix: 'package', name: 'חבילת שירות', unit: 'package' },
  ],
  maintenance_home_services: [
    { suffix: 'visit', name: 'ביקור שירות', unit: 'unit' },
    { suffix: 'hourly', name: 'שעת עבודה', unit: 'hour' },
    { suffix: 'package', name: 'חבילת שירות', unit: 'package' },
  ],
  digital_technology: [
    { suffix: 'hourly', name: 'שעת עבודה', unit: 'hour' },
    { suffix: 'deliverable', name: 'פריט עבודה', unit: 'unit' },
    { suffix: 'package', name: 'חבילת שירות', unit: 'package' },
  ],
  marketing_design_creative: [
    { suffix: 'hourly', name: 'שעת עבודה', unit: 'hour' },
    { suffix: 'deliverable', name: 'פריט עבודה', unit: 'unit' },
    { suffix: 'package', name: 'חבילת שירות', unit: 'package' },
  ],
  licensed_professions: [
    { suffix: 'hourly', name: 'שעת ייעוץ', unit: 'hour' },
    { suffix: 'document', name: 'מסמך מקצועי', unit: 'package' },
    { suffix: 'package', name: 'חבילת ליווי', unit: 'package' },
  ],
  health_therapy: [
    { suffix: 'session', name: 'מפגש', unit: 'unit' },
    { suffix: 'hourly', name: 'שעת טיפול', unit: 'hour' },
    { suffix: 'package', name: 'תוכנית טיפול', unit: 'package' },
  ],
  education_training: [
    { suffix: 'session', name: 'מפגש', unit: 'unit' },
    { suffix: 'hourly', name: 'שעת הדרכה', unit: 'hour' },
    { suffix: 'package', name: 'חבילת הדרכה', unit: 'package' },
  ],
  consulting_business_personal: [
    { suffix: 'session', name: 'פגישת ייעוץ', unit: 'hour' },
    { suffix: 'report', name: 'דוח ניתוח', unit: 'package' },
    { suffix: 'package', name: 'חבילת ליווי', unit: 'package' },
  ],
  arts_entertainment: [
    { suffix: 'session', name: 'סשן עבודה', unit: 'hour' },
    { suffix: 'event', name: 'שירות לאירוע', unit: 'unit' },
    { suffix: 'package', name: 'חבילת אירוע', unit: 'package' },
  ],
  everyday_small_services: [
    { suffix: 'service', name: 'שירות', unit: 'unit' },
    { suffix: 'hourly', name: 'שעת עבודה', unit: 'hour' },
    { suffix: 'package', name: 'חבילת שירות', unit: 'package' },
  ],
}

const INDUSTRY_SPECIFIC_CATALOG: Record<string, ProviderCatalogLineItem[]> = {
  auto_electrician: [
    { key: 'vehicle_diagnostics', name: 'דיאגנוסטיקה חשמלית לרכב', unit: 'unit' },
    { key: 'alternator_repair', name: 'תיקון/החלפת אלטרנטור', unit: 'unit' },
    { key: 'starter_repair', name: 'תיקון/החלפת סטרטר', unit: 'unit' },
    { key: 'battery_replacement', name: 'החלפת מצבר', unit: 'unit' },
    { key: 'wiring_repair', name: 'תיקון צמות חשמל', unit: 'hour' },
  ],
  auto_mechanic: [
    { key: 'vehicle_diagnostics', name: 'בדיקה ואבחון רכב', unit: 'unit' },
    { key: 'oil_service', name: 'טיפול שמנים ומסננים', unit: 'unit' },
    { key: 'brake_service', name: 'תיקון מערכת בלמים', unit: 'unit' },
    { key: 'engine_repair', name: 'תיקון מנוע', unit: 'hour' },
  ],
  electrician: [
    { key: 'electric_point', name: 'התקנת נקודת חשמל', unit: 'point' },
    { key: 'lighting_point', name: 'התקנת נקודת תאורה', unit: 'point' },
    { key: 'switch_socket', name: 'החלפת מפסק/שקע', unit: 'unit' },
    { key: 'panel_upgrade', name: 'שדרוג לוח חשמל', unit: 'unit' },
  ],
  plumber: [
    { key: 'water_point', name: 'נקודת מים/ביוב', unit: 'point' },
    { key: 'toilet_install', name: 'התקנת אסלה/כיור', unit: 'unit' },
    { key: 'faucet_replace', name: 'החלפת ברז', unit: 'unit' },
    { key: 'pipe_repair_meter', name: 'תיקון צנרת', unit: 'meter' },
  ],
  renovation_contractor: [
    { key: 'demolition', name: 'פירוק והריסה', unit: 'sqm' },
    { key: 'laminate_install', name: 'התקנת פרקט למינציה', unit: 'sqm' },
    { key: 'bath_cladding', name: 'חיפוי קירות אמבטיה', unit: 'sqm' },
    { key: 'team_workday', name: 'עבודה - צוות עובדים', unit: 'day' },
  ],
  painter: [
    { key: 'painting_walls_sqm', name: 'צביעת קירות ותקרות', unit: 'sqm' },
    { key: 'plaster_prep_sqm', name: 'שפכטל והכנת קירות', unit: 'sqm' },
    { key: 'door_paint_unit', name: 'צביעת דלת/משקוף', unit: 'unit' },
  ],
  cleaning_company: [
    { key: 'post_renovation_clean', name: 'ניקיון אחרי שיפוץ', unit: 'sqm' },
    { key: 'office_clean', name: 'ניקיון משרד', unit: 'sqm' },
    { key: 'window_clean', name: 'ניקוי חלונות', unit: 'sqm' },
  ],
  gardener: [
    { key: 'lawn_mowing', name: 'כיסוח דשא', unit: 'sqm' },
    { key: 'hedge_trimming', name: 'גיזום שיחים וגדר חיה', unit: 'meter' },
    { key: 'seasonal_planting', name: 'שתילה עונתית', unit: 'unit' },
    { key: 'irrigation_maintenance', name: 'תחזוקת מערכת השקיה', unit: 'unit' },
    { key: 'garden_cleanup', name: 'ניקיון וסידור גינה', unit: 'hour' },
  ],
  landscape_contractor: [
    { key: 'landscape_planning', name: 'תכנון גינה ופיתוח חוץ', unit: 'package' },
    { key: 'soil_preparation', name: 'יישור והכנת קרקע', unit: 'sqm' },
    { key: 'irrigation_installation', name: 'התקנת מערכת השקיה', unit: 'unit' },
    { key: 'synthetic_grass_install', name: 'התקנת דשא סינטטי', unit: 'sqm' },
    { key: 'deck_pergola_install', name: 'התקנת דק/פרגולה', unit: 'sqm' },
  ],
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim()
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toTemplateItems(industry: string, categoryId: string): ProviderCatalogLineItem[] {
  const templates = CATEGORY_GENERIC_TEMPLATES[categoryId] ?? []
  return templates.map((template) => ({
    key: `${industry}_${template.suffix}`,
    name: template.name,
    unit: template.unit,
  }))
}

function dedupeItems(items: ProviderCatalogLineItem[]): ProviderCatalogLineItem[] {
  const map = new Map<string, ProviderCatalogLineItem>()
  items.forEach((item) => {
    const key = `${normalizeLabel(item.name)}|${item.unit}`
    if (!map.has(key)) map.set(key, item)
  })
  return Array.from(map.values())
}

export function getCatalogLineItemsForIndustry(
  industryValue: string,
  _industryLabel: string,
  categoryId: string,
): ProviderCatalogLineItem[] {
  const normalizedIndustry = normalizeKey(industryValue)
  const specific = INDUSTRY_SPECIFIC_CATALOG[normalizedIndustry] ?? []
  const templates = toTemplateItems(normalizedIndustry, categoryId)

  if (specific.length > 0) return dedupeItems([...specific, ...templates])
  if (templates.length > 0) return dedupeItems(templates)
  return []
}
