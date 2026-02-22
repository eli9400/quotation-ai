export type IntakeFieldTemplateType = 'text' | 'number' | 'select' | 'textarea' | 'date'

export type IntakeFieldTemplate = {
  key: string
  label: string
  type: IntakeFieldTemplateType
  required: boolean
  placeholder?: string
  hint?: string
  options?: string[]
}

export type ServiceProviderIntakeTemplate = {
  id: string
  industry: string
  industryLabel: string
  categoryId: string
  categoryLabel: string
  fields: IntakeFieldTemplate[]
  updatedAt: string
}
