const UNIT_LABELS: Record<string, string> = {
  sqm: 'מ"ר',
  unit: 'יחידה',
  point: 'יחידה (ביקור)',
  day: 'יום',
  hour: 'שעה',
  meter: 'מטר',
  container: 'מכולה',
  package: 'קומפלט',
  percent: 'אחוז (%)',
  fixed: 'מחיר קבוע',
  unknown: 'לא ידוע',
}

export function toUnitLabel(unit: string): string {
  const key = unit.trim().toLowerCase()
  return UNIT_LABELS[key] ?? unit
}
