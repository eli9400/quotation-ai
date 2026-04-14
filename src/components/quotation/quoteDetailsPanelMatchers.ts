import type { EditableLineItem } from './quoteDetailsUtils'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mergeLineByIdentity(current: EditableLineItem, nextLine: EditableLineItem): boolean {
  const sameSource = !!nextLine.sourceItemId && current.sourceItemId === nextLine.sourceItemId
  const sameUnit = current.unit.trim().toLowerCase() === nextLine.unit.trim().toLowerCase()
  if (sameSource && sameUnit) return true
  return normalizeText(current.description) === normalizeText(nextLine.description) && sameUnit
}

export function normalizeCustomFieldKey(value: string): string {
  return value.trim().toLowerCase()
}

export function isSameLabel(left: string, right: string): boolean {
  return normalizeText(left) === normalizeText(right)
}
