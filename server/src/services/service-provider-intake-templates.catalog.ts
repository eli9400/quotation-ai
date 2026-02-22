import {
  SERVICE_PROVIDER_INDUSTRY_CATEGORIES,
} from './service-provider-industries.catalog.js'
import type {
  IntakeFieldTemplate,
  ServiceProviderIntakeTemplate,
} from './service-provider-intake-templates.types.js'

type TemplateInput = Omit<ServiceProviderIntakeTemplate, 'updatedAt'>

function buildVehicleYearOptions(): string[] {
  const currentYear = new Date().getFullYear()
  const startYear = 1980
  const options: string[] = []
  for (let year = currentYear; year >= startYear; year -= 1) {
    options.push(String(year))
  }
  return options
}

const COMMON_FIELDS: IntakeFieldTemplate[] = [
  { key: 'serviceAddress', label: 'כתובת השירות (אם רלוונטי)', type: 'text', required: false, placeholder: 'עיר, רחוב ומספר' },
  { key: 'serviceCity', label: 'עיר השירות (אם רלוונטי)', type: 'text', required: false, placeholder: 'לדוגמה: תל אביב' },
  { key: 'preferredStartDate', label: 'תאריך התחלה מועדף', type: 'date', required: false },
  { key: 'siteAccessNotes', label: 'הערות לוגיסטיות', type: 'textarea', required: false, placeholder: 'גישה, חניה, שעות עבודה מותרות או מגבלות מיוחדות' },
]

const CATEGORY_FIELDS: Record<string, IntakeFieldTemplate[]> = {
  construction_renovation: [
    { key: 'serviceAddress', label: 'כתובת ביצוע העבודה', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר', type: 'text', required: true, placeholder: 'לדוגמה: תל אביב' },
    { key: 'projectType', label: 'סוג פרויקט', type: 'select', required: true, options: ['שיפוץ', 'תחזוקה', 'התקנה', 'שדרוג'] },
    { key: 'structureType', label: 'סוג מבנה', type: 'select', required: true, options: ['דירה', 'בית פרטי', 'משרד', 'מסחרי', 'אחר'] },
    { key: 'buildingAgeYears', label: 'גיל המבנה (שנים)', type: 'number', required: false, placeholder: 'לדוגמה: 25' },
    { key: 'existingOrExtension', label: 'מבנה קיים או תוספת', type: 'select', required: true, options: ['מבנה קיים', 'תוספת למבנה קיים', 'מבנה חדש'] },
  ],
  transport_logistics: [
    { key: 'pickupAddress', label: 'כתובת איסוף', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'dropoffAddress', label: 'כתובת יעד', type: 'text', required: false, placeholder: 'עיר, רחוב ומספר (אם יש יעד שונה)' },
    { key: 'loadType', label: 'סוג נסיעה/משימה', type: 'text', required: false, placeholder: 'לדוגמה: הסעה / שליחות / הובלה' },
    { key: 'loadVolume', label: 'היקף משוער (אם רלוונטי)', type: 'text', required: false, placeholder: 'לדוגמה: 5 קרטונים / נסיעה אחת' },
  ],
  maintenance_home_services: [
    { key: 'serviceAddress', label: 'כתובת השירות', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר', type: 'text', required: true, placeholder: 'לדוגמה: תל אביב' },
    { key: 'propertyType', label: 'סוג נכס', type: 'select', required: true, options: ['דירה', 'בית פרטי', 'משרד', 'מסחרי', 'אחר'] },
    { key: 'serviceAreaSize', label: 'שטח עבודה משוער (מ"ר)', type: 'number', required: false, placeholder: 'לדוגמה: 120' },
    { key: 'isUrgentVisit', label: 'נדרש טיפול דחוף?', type: 'select', required: false, options: ['כן', 'לא'] },
  ],
  digital_technology: [
    { key: 'currentSystem', label: 'מערכת קיימת', type: 'text', required: false, placeholder: 'לדוגמה: אתר WordPress' },
    { key: 'mainGoal', label: 'מה המטרה העסקית?', type: 'textarea', required: true, placeholder: 'תיאור תוצאה רצויה' },
    { key: 'targetDeadline', label: 'תאריך יעד', type: 'date', required: false },
  ],
  marketing_design_creative: [
    { key: 'brandStage', label: 'שלב עסקי', type: 'select', required: false, options: ['רעיון', 'עסק פעיל', 'התרחבות'] },
    { key: 'targetAudience', label: 'קהל יעד', type: 'text', required: true, placeholder: 'למי השירות/המוצר מיועד' },
    { key: 'campaignGoal', label: 'יעד מרכזי', type: 'text', required: true, placeholder: 'לדוגמה: לידים / מכירות / חשיפה' },
  ],
  licensed_professions: [
    { key: 'caseTopic', label: 'נושא הפנייה', type: 'text', required: true, placeholder: 'תיאור קצר של הנושא' },
    { key: 'legalOrRegulatoryDeadline', label: 'תאריך דדליין מחייב (אם יש)', type: 'date', required: false },
    { key: 'documentsReady', label: 'האם יש מסמכים זמינים?', type: 'select', required: false, options: ['כן', 'לא', 'חלקי'] },
  ],
  health_therapy: [
    { key: 'patientAge', label: 'גיל מטופל', type: 'number', required: false, placeholder: 'לדוגמה: 42' },
    { key: 'careGoal', label: 'מטרת טיפול', type: 'text', required: true, placeholder: 'לדוגמה: שיקום / הפחתת כאב' },
    { key: 'visitType', label: 'סוג מפגש', type: 'select', required: false, options: ['קליניקה', 'בית לקוח', 'אונליין'] },
  ],
  education_training: [
    { key: 'learnerAge', label: 'גיל לומד', type: 'number', required: false, placeholder: 'לדוגמה: 16' },
    { key: 'learningGoal', label: 'מטרת הלמידה', type: 'text', required: true, placeholder: 'לדוגמה: הכנה לבגרות' },
    { key: 'lessonFormat', label: 'פורמט', type: 'select', required: false, options: ['פרונטלי', 'אונליין', 'משולב'] },
  ],
  consulting_business_personal: [
    { key: 'businessStage', label: 'שלב עסקי', type: 'select', required: false, options: ['הקמה', 'פעיל', 'התרחבות'] },
    { key: 'mainChallenge', label: 'אתגר מרכזי', type: 'textarea', required: true, placeholder: 'מה הבעיה שצריך לפתור' },
    { key: 'budgetRange', label: 'טווח תקציב משוער', type: 'text', required: false, placeholder: 'לדוגמה: 5,000-10,000' },
  ],
  arts_entertainment: [
    { key: 'serviceCity', label: 'עיר האירוע', type: 'text', required: true, placeholder: 'לדוגמה: תל אביב' },
    { key: 'eventType', label: 'סוג אירוע', type: 'text', required: true, placeholder: 'לדוגמה: חתונה / כנס' },
    { key: 'eventDate', label: 'תאריך אירוע', type: 'date', required: true },
    { key: 'eventLocation', label: 'מיקום אירוע', type: 'text', required: true, placeholder: 'עיר/אולם' },
  ],
  everyday_small_services: [
    { key: 'servicePreference', label: 'העדפת שירות', type: 'select', required: false, options: ['בבית הלקוח', 'בקליניקה/סטודיו', 'מרחוק'] },
    { key: 'availabilityWindow', label: 'זמינות מועדפת', type: 'text', required: false, placeholder: 'ימים/שעות נוחים' },
    { key: 'specialNotes', label: 'דגשים חשובים', type: 'textarea', required: false, placeholder: 'רגישויות, מגבלות, בקשות מיוחדות' },
  ],
}

const INDUSTRY_OVERRIDES: Record<string, IntakeFieldTemplate[]> = {
  renovation_contractor: [
    { key: 'renovationScope', label: 'היקף שיפוץ', type: 'select', required: true, options: ['מקומי', 'דירה מלאה', 'משרדים/מסחרי'] },
    { key: 'inhabitedDuringWork', label: 'האם הנכס מאוכלס בזמן העבודה?', type: 'select', required: false, options: ['כן', 'לא', 'חלקית'] },
  ],
  piano_tuner: [
    { key: 'serviceAddress', label: 'כתובת הפסנתר', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר', type: 'text', required: true, placeholder: 'לדוגמה: תל אביב' },
    { key: 'pianoType', label: 'סוג פסנתר', type: 'select', required: true, options: ['קיר', 'כנף', 'דיגיטלי-היברידי', 'לא ידוע'] },
    { key: 'pianoAgeYears', label: 'גיל הפסנתר (שנים)', type: 'number', required: false, placeholder: 'לדוגמה: 18' },
    { key: 'manufactureCountry', label: 'ארץ ייצור', type: 'text', required: false, placeholder: 'לדוגמה: יפן' },
    { key: 'lastTuningDate', label: 'מתי כוון לאחרונה?', type: 'date', required: false },
    { key: 'needsRepairBeforeTuning', label: 'נדרש תיקון לפני כיוון?', type: 'select', required: true, options: ['כן', 'לא', 'לא בטוח'] },
  ],
  auto_electrician: [
    { key: 'serviceAddress', label: 'כתובת הרכב', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר (אם שונה מהכתובת)', type: 'text', required: false, placeholder: 'לדוגמה: תל אביב' },
    { key: 'vehicleBrand', label: 'יצרן רכב', type: 'text', required: true, placeholder: 'לדוגמה: Toyota' },
    { key: 'vehicleYear', label: 'שנת ייצור', type: 'select', required: false, options: buildVehicleYearOptions() },
    { key: 'vehicleModel', label: 'דגם רכב', type: 'text', required: true, placeholder: 'לדוגמה: Corolla' },
    { key: 'vehicleType', label: 'סוג רכב', type: 'select', required: true, options: ['פרטי', 'מסחרי', 'משאית', 'דו-גלגלי'] },
    { key: 'vehicleTrim', label: 'גרסה/רמת גימור', type: 'text', required: false, placeholder: 'לדוגמה: GLI 1.8' },
    { key: 'electricalIssue', label: 'תיאור התקלה החשמלית', type: 'textarea', required: true, placeholder: 'מה הסימפטום המרכזי' },
  ],
  auto_mechanic: [
    { key: 'serviceAddress', label: 'כתובת הרכב', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר (אם שונה מהכתובת)', type: 'text', required: false, placeholder: 'לדוגמה: תל אביב' },
    { key: 'vehicleBrand', label: 'יצרן רכב', type: 'text', required: true, placeholder: 'לדוגמה: Hyundai' },
    { key: 'vehicleYear', label: 'שנת ייצור', type: 'select', required: false, options: buildVehicleYearOptions() },
    { key: 'vehicleModel', label: 'דגם רכב', type: 'text', required: true, placeholder: 'לדוגמה: i30' },
    { key: 'vehicleType', label: 'סוג רכב', type: 'select', required: true, options: ['פרטי', 'מסחרי', 'משאית', 'דו-גלגלי'] },
    { key: 'vehicleTrim', label: 'גרסה/רמת גימור', type: 'text', required: false, placeholder: 'לדוגמה: Premium 1.6' },
    { key: 'mechanicIssue', label: 'תיאור התקלה', type: 'textarea', required: true, placeholder: 'מה הבעיה המרכזית ברכב' },
  ],
  auto_body_technician: [
    { key: 'serviceAddress', label: 'כתובת הרכב', type: 'text', required: true, placeholder: 'עיר, רחוב ומספר' },
    { key: 'serviceCity', label: 'עיר (אם שונה מהכתובת)', type: 'text', required: false, placeholder: 'לדוגמה: תל אביב' },
    { key: 'vehicleBrand', label: 'יצרן רכב', type: 'text', required: true, placeholder: 'לדוגמה: Mazda' },
    { key: 'vehicleYear', label: 'שנת ייצור', type: 'select', required: false, options: buildVehicleYearOptions() },
    { key: 'vehicleModel', label: 'דגם רכב', type: 'text', required: true, placeholder: 'לדוגמה: 3' },
    { key: 'vehicleType', label: 'סוג רכב', type: 'select', required: true, options: ['פרטי', 'מסחרי', 'משאית', 'דו-גלגלי'] },
    { key: 'damageArea', label: 'אזור פגיעה', type: 'text', required: true, placeholder: 'לדוגמה: דלת קדמית שמאל' },
  ],
}

const INDUSTRY_WITH_FULL_OVERRIDE = new Set<string>([
  'auto_electrician',
  'auto_mechanic',
  'auto_body_technician',
  'piano_tuner',
])
const AUTOMOTIVE_INDUSTRIES = new Set<string>([
  'auto_electrician',
  'auto_mechanic',
  'auto_body_technician',
])
const AUTOMOTIVE_FIELD_PRIORITY = ['vehicleType', 'vehicleBrand', 'vehicleYear', 'vehicleModel']

function nowIso(): string {
  return new Date().toISOString()
}

function dedupeFields(fields: IntakeFieldTemplate[]): IntakeFieldTemplate[] {
  const map = new Map<string, IntakeFieldTemplate>()
  fields.forEach((field) => {
    map.set(field.key, field)
  })
  return Array.from(map.values())
}

function reorderFieldsByPriority(
  fields: IntakeFieldTemplate[],
  priority: string[],
): IntakeFieldTemplate[] {
  if (priority.length === 0) return fields
  const weights = new Map(priority.map((key, index) => [key, index]))
  return fields
    .map((field, originalIndex) => ({ field, originalIndex }))
    .sort((left, right) => {
      const leftWeight = weights.get(left.field.key)
      const rightWeight = weights.get(right.field.key)
      if (leftWeight === undefined && rightWeight === undefined) {
        return left.originalIndex - right.originalIndex
      }
      if (leftWeight === undefined) return 1
      if (rightWeight === undefined) return -1
      if (leftWeight !== rightWeight) return leftWeight - rightWeight
      return left.originalIndex - right.originalIndex
    })
    .map((entry) => entry.field)
}

function buildFields(categoryId: string, industryValue: string): IntakeFieldTemplate[] {
  const categoryFields = INDUSTRY_WITH_FULL_OVERRIDE.has(industryValue)
    ? []
    : CATEGORY_FIELDS[categoryId] ?? []
  const overrides = INDUSTRY_OVERRIDES[industryValue] ?? []
  const deduped = dedupeFields([...COMMON_FIELDS, ...categoryFields, ...overrides])
  if (AUTOMOTIVE_INDUSTRIES.has(industryValue)) {
    return reorderFieldsByPriority(deduped, AUTOMOTIVE_FIELD_PRIORITY)
  }
  return deduped
}

export function buildDefaultIntakeTemplates(): TemplateInput[] {
  const templates: TemplateInput[] = []
  SERVICE_PROVIDER_INDUSTRY_CATEGORIES.forEach((category) => {
    category.options.forEach((industryOption) => {
      templates.push({
        id: industryOption.value,
        industry: industryOption.value,
        industryLabel: industryOption.label,
        categoryId: category.id,
        categoryLabel: category.label,
        fields: buildFields(category.id, industryOption.value),
      })
    })
  })
  return templates
}

export function toStoredTemplate(input: TemplateInput): ServiceProviderIntakeTemplate {
  return { ...input, updatedAt: nowIso() }
}
