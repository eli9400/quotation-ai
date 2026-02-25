import type { PricingUnit } from '../types/model-profile.js'

export type ProviderLineItemCategory = {
  id: string
  label: string
}

type CategoryRule = {
  id: string
  label: string
  pattern: RegExp
}

const DYNAMIC_STOP_WORDS = new Set([
  'החלפה',
  'החלפת',
  'תיקון',
  'בדיקה',
  'שירות',
  'טיפול',
  'עבודת',
  'עבודה',
  'כולל',
  'עם',
  'בלי',
  'לפי',
  'של',
  'for',
  'with',
  'service',
  'repair',
  'replace',
  'check',
])

const AUTO_RULES: CategoryRule[] = [
  { id: 'diagnostics', label: 'אבחון', pattern: /(אבחון|דיאגנוסט|בדיקת מחשב|scan|diagnostic)/i },
  { id: 'brakes', label: 'בלמים', pattern: /(בלמ|רפיד|דיסק)/i },
  { id: 'ac', label: 'מזגן', pattern: /(מזגן|מדחס|גז)/i },
  { id: 'suspension_steering', label: 'מתלים והיגוי', pattern: /(בולמ|פרונט|איזון גלגל|היגוי)/i },
  { id: 'electrical_start', label: 'חשמל והתנעה', pattern: /(מצבר|אלטרנטור|סטרטר|נור|תאור|חשמל)/i },
  { id: 'engine_components', label: 'מנוע ומכלולים', pattern: /(טיימינג|משאבת מים|רדיאטור|קלאץ|מנוע|פלאג)/i },
  { id: 'maintenance', label: 'טיפולים שוטפים', pattern: /(שמן|פילטר|מסנן|מצערת|טיפול)/i },
]

const CONSTRUCTION_RULES: CategoryRule[] = [
  { id: 'electrical', label: 'חשמל', pattern: /(חשמל|לוח|שקע|תאור|נקודת חשמל)/i },
  { id: 'plumbing', label: 'אינסטלציה', pattern: /(מים|ביוב|צנרת|ברז|אסלה|כיור|אינסטלט)/i },
  { id: 'finishing', label: 'גמר וצבע', pattern: /(צבע|שפכטל|ריצוף|חיפוי|פרקט|גבס|טיח)/i },
  { id: 'structure', label: 'שלד והריסה', pattern: /(הריסה|פירוק|שלד|בטון|יציקה)/i },
  { id: 'outdoor', label: 'חוץ ואיטום', pattern: /(איטום|מרפסת|גינה|דק|פרגול|מכולה|פינוי)/i },
]

const DIGITAL_RULES: CategoryRule[] = [
  { id: 'development', label: 'פיתוח', pattern: /(פיתוח|feature|module|app|web|api)/i },
  { id: 'ops', label: 'תשתיות ותפעול', pattern: /(שרת|תשתית|devops|cloud|deploy|סייבר)/i },
  { id: 'support', label: 'תחזוקה ותמיכה', pattern: /(תחזוקה|תמיכה|בדיקה|ייעוץ|audit)/i },
]

const GARDEN_RULES: CategoryRule[] = [
  { id: 'lawn_pruning', label: 'דשא וגיזום', pattern: /(דשא|כיסוח|גיזום|שיח|גדר חיה|trim|prun)/i },
  { id: 'irrigation', label: 'השקיה וניקוז', pattern: /(השקיה|טפט|ממטיר|מחשב השקיה|ניקוז|drip|irrig)/i },
  { id: 'planting', label: 'שתילה ופיתוח', pattern: /(שתילה|צמח|עץ|אדמה|דישון|קרקע|פיתוח|landscape)/i },
  { id: 'cleanup', label: 'ניקיון ופינוי', pattern: /(ניקיון|פינוי|גזם|פסולת|מכולה|cleanup)/i },
]

function fallbackCategory(categoryId: string, unit: PricingUnit): ProviderLineItemCategory {
  if (unit === 'hour') return { id: 'hourly', label: 'שעות עבודה' }
  if (unit === 'package') return { id: 'packages', label: 'חבילות שירות' }

  switch (categoryId) {
    case 'construction_renovation':
      return { id: 'general_construction', label: 'עבודות כלליות' }
    case 'transport_logistics':
      return { id: 'general_transport', label: 'שירותי הובלה/רכב' }
    case 'maintenance_home_services':
      return { id: 'general_maintenance', label: 'תחזוקה כללית' }
    case 'digital_technology':
      return { id: 'general_digital', label: 'שירותים דיגיטליים' }
    case 'marketing_design_creative':
      return { id: 'general_creative', label: 'קריאייטיב ותוכן' }
    case 'licensed_professions':
      return { id: 'general_professional', label: 'שירותים מקצועיים' }
    case 'health_therapy':
      return { id: 'general_health', label: 'שירותי טיפול' }
    case 'education_training':
      return { id: 'general_education', label: 'הדרכה ושיעורים' }
    case 'consulting_business_personal':
      return { id: 'general_consulting', label: 'ייעוץ' }
    case 'arts_entertainment':
      return { id: 'general_arts', label: 'שירותי אמנות/אירועים' }
    case 'everyday_small_services':
      return { id: 'general_daily', label: 'שירותים יומיומיים' }
    default:
      return { id: 'general', label: 'שירותים כלליים' }
  }
}

function resolveRules(industry: string, categoryId: string): CategoryRule[] {
  if (industry === 'auto_mechanic' || industry === 'auto_electrician' || industry === 'auto_body_technician') {
    return AUTO_RULES
  }
  if (
    industry === 'gardener' ||
    industry === 'landscape_contractor' ||
    industry === 'tree_trimmer' ||
    industry === 'synthetic_grass_installer' ||
    industry === 'outdoor_development_contractor'
  ) {
    return GARDEN_RULES
  }
  if (categoryId === 'construction_renovation') return CONSTRUCTION_RULES
  if (categoryId === 'digital_technology') return DIGITAL_RULES
  return []
}

function shouldPromoteDynamicCategory(categoryId: string): boolean {
  return categoryId === 'general' || categoryId.startsWith('general_')
}

function extractDynamicCategoryTokens(canonicalName: string): string[] {
  return canonicalName
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !DYNAMIC_STOP_WORDS.has(token))
}

function toDynamicCategoryId(tokens: string[]): string {
  const raw = tokens.slice(0, 2).join('_')
  return `dynamic_${raw.replace(/[^a-z0-9\u0590-\u05ff_]/g, '_').slice(0, 48)}`
}

function toDynamicCategoryLabel(tokens: string[]): string {
  return tokens.slice(0, 2).join(' ')
}

export function categorizeProviderLineItem(params: {
  industry: string
  categoryId: string
  canonicalName: string
  unit: PricingUnit
  isProviderOnly: boolean
}): ProviderLineItemCategory {
  if (params.isProviderOnly) {
    return { id: 'provider_internal', label: 'רכיבי נותן שירות' }
  }

  const rules = resolveRules(params.industry, params.categoryId)
  const category = rules.find((rule) => rule.pattern.test(params.canonicalName)) ?? null
  if (category) return { id: category.id, label: category.label }
  return fallbackCategory(params.categoryId, params.unit)
}

export function resolveDynamicCategoryForLineItem(params: {
  canonicalName: string
  currentCategoryId: string
}): ProviderLineItemCategory | null {
  if (!shouldPromoteDynamicCategory(params.currentCategoryId)) {
    return null
  }
  const tokens = extractDynamicCategoryTokens(params.canonicalName)
  if (tokens.length === 0) {
    return null
  }
  const label = toDynamicCategoryLabel(tokens)
  if (!label) {
    return null
  }
  return {
    id: toDynamicCategoryId(tokens),
    label,
  }
}
