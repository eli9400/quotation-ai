import type { DynamicFormField } from '../types/model-profile.js'

export function baseContactFields(): DynamicFormField[] {
  return [
    {
      id: 'clientName',
      label: 'שם לקוח',
      type: 'text',
      role: 'contact',
      visibleTo: 'client',
      editableBy: 'client',
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
      role: 'contact',
      visibleTo: 'client',
      editableBy: 'client',
      required: true,
      order: 2,
      sourceItemId: null,
      placeholder: 'client@example.com',
      hint: null,
      options: [],
    },
  ]
}

export function requirementsField(order: number): DynamicFormField {
  return {
    id: 'requirements',
    label: 'הערות ודרישות',
    type: 'textarea',
    role: 'requirements',
    visibleTo: 'client',
    editableBy: 'client',
    required: false,
    order,
    sourceItemId: null,
    placeholder: 'פרטים נוספים על העבודה',
    hint: null,
    options: [],
  }
}

