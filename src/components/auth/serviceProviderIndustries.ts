import type { ServiceProviderIndustry } from '../../types/serviceProvider'

export const SERVICE_PROVIDER_INDUSTRY_OPTIONS: Array<{
  value: ServiceProviderIndustry
  label: string
}> = [
  { value: 'general', label: 'כללי' },
  { value: 'renovation', label: 'שיפוצים' },
  { value: 'electrical', label: 'חשמל' },
  { value: 'plumbing', label: 'אינסטלציה' },
  { value: 'painting', label: 'צביעה' },
  { value: 'cleaning', label: 'ניקיון' },
  { value: 'hvac', label: 'מיזוג אוויר' },
  { value: 'gardening', label: 'גינון' },
]
