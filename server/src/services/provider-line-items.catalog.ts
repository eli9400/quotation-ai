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

const CATEGORY_BASE_CATALOG: Record<string, ProviderCatalogLineItem[]> = {
  construction_renovation: [
    { key: 'painting_walls', name: 'צביעת קירות ותקרות', unit: 'sqm' },
    { key: 'plaster_walls', name: 'שפכטל והכנת קירות', unit: 'sqm' },
    { key: 'floor_tiles', name: 'ריצוף גרניט פורצלן', unit: 'sqm' },
    { key: 'electrical_point', name: 'התקנת נקודת חשמל', unit: 'point' },
    { key: 'water_point', name: 'נקודת מים/ביוב', unit: 'point' },
    { key: 'debris_container', name: 'פינוי מכולת פסולת', unit: 'container' },
  ],
  transport_logistics: [
    { key: 'service_visit', name: 'ביקור שירות', unit: 'unit' },
    { key: 'hourly_work', name: 'עבודה לפי שעה', unit: 'hour' },
    { key: 'local_delivery', name: 'משלוח עירוני', unit: 'unit' },
  ],
  maintenance_home_services: [
    { key: 'service_visit', name: 'ביקור שירות', unit: 'unit' },
    { key: 'hourly_work', name: 'עבודה לפי שעה', unit: 'hour' },
    { key: 'home_cleaning', name: 'ניקיון בית', unit: 'sqm' },
  ],
  digital_technology: [
    { key: 'hourly_work', name: 'עבודה לפי שעה', unit: 'hour' },
    { key: 'feature_development', name: 'פיתוח פיצ׳ר', unit: 'unit' },
    { key: 'maintenance_package', name: 'תחזוקה חודשית', unit: 'package' },
  ],
  marketing_design_creative: [
    { key: 'editing_hour', name: 'שעת עריכה/עיצוב', unit: 'hour' },
    { key: 'content_item', name: 'פריט תוכן', unit: 'unit' },
    { key: 'creative_package', name: 'חבילת שירות', unit: 'package' },
  ],
  licensed_professions: [
    { key: 'consultation_hour', name: 'שעת ייעוץ מקצועי', unit: 'hour' },
    { key: 'review_package', name: 'בדיקה/חוות דעת', unit: 'package' },
    { key: 'document_preparation', name: 'הכנת מסמך מקצועי', unit: 'package' },
  ],
  health_therapy: [
    { key: 'treatment_session', name: 'טיפול/מפגש', unit: 'unit' },
    { key: 'diagnostic_session', name: 'מפגש אבחון', unit: 'unit' },
    { key: 'therapy_program', name: 'תכנית טיפול', unit: 'package' },
  ],
  education_training: [
    { key: 'lesson_hour', name: 'שיעור לפי שעה', unit: 'hour' },
    { key: 'course_package', name: 'חבילת קורס', unit: 'package' },
    { key: 'session', name: 'מפגש הדרכה', unit: 'unit' },
  ],
  consulting_business_personal: [
    { key: 'strategy_session', name: 'פגישת ייעוץ', unit: 'hour' },
    { key: 'monthly_package', name: 'ליווי חודשי', unit: 'package' },
    { key: 'analysis_report', name: 'דוח ניתוח', unit: 'package' },
  ],
  arts_entertainment: [
    { key: 'event_performance', name: 'הופעה באירוע', unit: 'unit' },
    { key: 'event_package', name: 'חבילת אירוע', unit: 'package' },
    { key: 'rehearsal_hour', name: 'שעת חזרה/עבודה', unit: 'hour' },
  ],
  everyday_small_services: [
    { key: 'basic_service', name: 'שירות בסיסי', unit: 'unit' },
    { key: 'treatment_service', name: 'טיפול/שירות', unit: 'unit' },
    { key: 'session_hour', name: 'מפגש לפי שעה', unit: 'hour' },
  ],
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
    { suffix: 'package', name: 'תכנית טיפול', unit: 'package' },
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
  if (specific.length > 0) {
    return dedupeItems([...specific, ...templates])
  }

  const categoryBase = CATEGORY_BASE_CATALOG[categoryId] ?? []
  return dedupeItems(categoryBase)
}
