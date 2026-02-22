import type { FormPreviewSchema } from '../../types/quotation'

const AUTOMOTIVE_FIELD_ORDER = new Map<string, number>([
  ['intake_vehicleType', 1],
  ['intake_vehicleBrand', 2],
  ['intake_vehicleYear', 3],
  ['intake_vehicleModel', 4],
  ['intake_vehicleTrim', 5],
])

export function isClientVisibleField(field: FormPreviewSchema['fields'][number]): boolean {
  return !field.visibleTo || field.visibleTo === 'client'
}

export function shouldRenderField(field: FormPreviewSchema['fields'][number]): boolean {
  if (!isClientVisibleField(field)) return false
  if (field.role === 'input_qty') return false
  if (field.id === 'clientName' || field.id === 'clientEmail') return false
  return true
}

export function fieldSort(
  left: FormPreviewSchema['fields'][number],
  right: FormPreviewSchema['fields'][number],
): number {
  const leftAutomotiveOrder = AUTOMOTIVE_FIELD_ORDER.get(left.id)
  const rightAutomotiveOrder = AUTOMOTIVE_FIELD_ORDER.get(right.id)
  if (leftAutomotiveOrder !== undefined || rightAutomotiveOrder !== undefined) {
    if (leftAutomotiveOrder === undefined) return 1
    if (rightAutomotiveOrder === undefined) return -1
    if (leftAutomotiveOrder !== rightAutomotiveOrder) {
      return leftAutomotiveOrder - rightAutomotiveOrder
    }
  }
  const leftRequirements = left.id === 'requirements' || left.role === 'requirements'
  const rightRequirements = right.id === 'requirements' || right.role === 'requirements'
  if (leftRequirements !== rightRequirements) return leftRequirements ? 1 : -1
  return left.order - right.order
}

export function createInitialFormValues(
  schema: FormPreviewSchema,
  clientName: string,
  clientEmail: string,
): Record<string, string> {
  const values: Record<string, string> = {}
  schema.fields.filter(isClientVisibleField).forEach((field) => {
    values[field.id] = field.type === 'number' ? '0' : ''
  })
  values.clientName = clientName
  values.clientEmail = clientEmail
  return values
}

export function asErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback
}
