import type { ProjectType, ScopeLevel, UrgencyLevel } from '../../types/quotation'

export type SelectOption<T extends string> = {
  value: T
  label: string
}

export const projectOptions: SelectOption<ProjectType>[] = [
  { value: 'renovation', label: 'שיפוץ' },
  { value: 'consulting', label: 'ייעוץ מקצועי' },
  { value: 'installation', label: 'התקנה' },
  { value: 'maintenance', label: 'תחזוקה' },
]

export const scopeOptions: SelectOption<ScopeLevel>[] = [
  { value: 'small', label: 'קטן' },
  { value: 'medium', label: 'בינוני' },
  { value: 'large', label: 'גדול' },
]

export const urgencyOptions: SelectOption<UrgencyLevel>[] = [
  { value: 'normal', label: 'רגילה' },
  { value: 'fast', label: 'מהירה' },
  { value: 'immediate', label: 'מיידית' },
]

export const projectLabels: Record<ProjectType, string> = {
  renovation: 'שיפוץ',
  consulting: 'ייעוץ מקצועי',
  installation: 'התקנה',
  maintenance: 'תחזוקה',
}

export const scopeLabels: Record<ScopeLevel, string> = {
  small: 'קטן',
  medium: 'בינוני',
  large: 'גדול',
}

export const urgencyLabels: Record<UrgencyLevel, string> = {
  normal: 'רגילה',
  fast: 'מהירה',
  immediate: 'מיידית',
}
