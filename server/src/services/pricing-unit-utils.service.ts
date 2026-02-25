import type { PricingUnit } from '../types/model-profile.js'

function compactUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/["'׳`״]/g, '')
    .replace(/\s+/g, '')
}

export function mapUnitToken(value: string): PricingUnit | null {
  const compact = compactUnit(value)
  if (!compact) return null

  if (compact === 'sqm' || compact === 'm2' || compact === 'מר' || compact === 'רמ') return 'sqm'
  if (
    compact === 'point' ||
    compact === 'points' ||
    compact === 'visit' ||
    compact === 'visits' ||
    compact === 'ביקור' ||
    compact === 'ביקורים'
  ) {
    return 'point'
  }
  if (compact === 'day' || compact === 'days' || compact === 'יום' || compact === 'ימים') return 'day'
  if (
    compact === 'container' ||
    compact === 'containers' ||
    compact === 'מכולה' ||
    compact === 'מכולות'
  ) {
    return 'container'
  }
  if (compact === 'package' || compact === 'קומפלט') return 'package'
  if (compact === 'percent' || compact === '%' || compact === 'אחוז' || compact === 'אחוזים') {
    return 'percent'
  }
  if (
    compact === 'unit' ||
    compact === 'units' ||
    compact === 'pcs' ||
    compact === 'יחידה' ||
    compact === 'יחידות'
  ) {
    return 'unit'
  }
  if (compact === 'hour' || compact === 'hours' || compact === 'שעה' || compact === 'שעות') {
    return 'hour'
  }
  if (
    compact === 'meter' ||
    compact === 'meters' ||
    compact === 'מטר' ||
    compact === 'מטרים' ||
    compact === 'מ' ||
    compact === 'm'
  ) {
    return 'meter'
  }
  if (compact === 'fixed' || compact === 'מחירקבוע') return 'fixed'
  return null
}
