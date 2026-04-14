import type { PricingUnit } from '../types/model-profile.js'

const HE = {
  sqmA: '\u05DE\u05E8',
  sqmB: '\u05E8\u05DE',
  visit: '\u05D1\u05D9\u05E7\u05D5\u05E8',
  visits: '\u05D1\u05D9\u05E7\u05D5\u05E8\u05D9\u05DD',
  day: '\u05D9\u05D5\u05DD',
  days: '\u05D9\u05DE\u05D9\u05DD',
  container: '\u05DE\u05DB\u05D5\u05DC\u05D4',
  containers: '\u05DE\u05DB\u05D5\u05DC\u05D5\u05EA',
  package: '\u05E7\u05D5\u05DE\u05E4\u05DC\u05D8',
  percent: '\u05D0\u05D7\u05D5\u05D6',
  percents: '\u05D0\u05D7\u05D5\u05D6\u05D9\u05DD',
  unit: '\u05D9\u05D7\u05D9\u05D3\u05D4',
  units: '\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA',
  hour: '\u05E9\u05E2\u05D4',
  hours: '\u05E9\u05E2\u05D5\u05EA',
  meter: '\u05DE\u05D8\u05E8',
  meters: '\u05DE\u05D8\u05E8\u05D9\u05DD',
  mShort: '\u05DE',
  fixed: '\u05DE\u05D7\u05D9\u05E8\u05E7\u05D1\u05D5\u05E2',
} as const

function compactUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/["'׳³`׳´]/g, '')
    .replace(/[._/\\-]+/g, '')
    .replace(/\s+/g, '')
}

export function mapUnitToken(value: string): PricingUnit | null {
  const compact = compactUnit(value)
  if (!compact) return null

  if (
    compact === 'sqm' ||
    compact === 'm2' ||
    compact === 'sqmeter' ||
    compact === 'sqmeters' ||
    compact === 'squaremeter' ||
    compact === 'squaremeters' ||
    compact === HE.sqmA ||
    compact === HE.sqmB
  ) {
    return 'sqm'
  }

  if (
    compact === 'point' ||
    compact === 'points' ||
    compact === 'visit' ||
    compact === 'visits' ||
    compact === 'servicecall' ||
    compact === 'callout' ||
    compact === HE.visit ||
    compact === HE.visits
  ) {
    return 'point'
  }

  if (compact === 'day' || compact === 'days' || compact === HE.day || compact === HE.days) return 'day'

  if (
    compact === 'container' ||
    compact === 'containers' ||
    compact === HE.container ||
    compact === HE.containers
  ) {
    return 'container'
  }

  if (compact === 'package' || compact === HE.package) return 'package'
  if (compact === 'percent' || compact === '%' || compact === HE.percent || compact === HE.percents) return 'percent'

  if (
    compact === 'unit' ||
    compact === 'units' ||
    compact === 'pcs' ||
    compact === HE.unit ||
    compact === HE.units
  ) {
    return 'unit'
  }

  if (compact === 'hour' || compact === 'hours' || compact === HE.hour || compact === HE.hours) return 'hour'

  if (
    compact === 'meter' ||
    compact === 'meters' ||
    compact === 'lm' ||
    compact === 'linemeter' ||
    compact === 'linearmeter' ||
    compact === HE.meter ||
    compact === HE.meters ||
    compact === HE.mShort ||
    compact === 'm'
  ) {
    return 'meter'
  }

  if (compact === 'fixed' || compact === HE.fixed) return 'fixed'
  return null
}
