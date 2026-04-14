const HE = {
  include: '\u05DB\u05D5\u05DC\u05DC',
  work: '\u05E2\u05D1\u05D5\u05D3\u05D4',
  works: '\u05E2\u05D1\u05D5\u05D3\u05D5\u05EA',
  visit: '\u05D1\u05D9\u05E7\u05D5\u05E8',
  visits: '\u05D1\u05D9\u05E7\u05D5\u05E8\u05D9\u05DD',
  visitCanonical: '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA',
  fixed: '\u05E7\u05D1\u05D5\u05E2',
  price: '\u05DE\u05D7\u05D9\u05E8',
  unit: '\u05D9\u05D7\u05D9\u05D3\u05D4',
  units: '\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA',
  point: '\u05E0\u05E7\u05D5\u05D3\u05D4',
  points: '\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA',
  hour: '\u05E9\u05E2\u05D4',
  hours: '\u05E9\u05E2\u05D5\u05EA',
  day: '\u05D9\u05D5\u05DD',
  days: '\u05D9\u05DE\u05D9\u05DD',
  service: '\u05E9\u05D9\u05E8\u05D5\u05EA',
  services: '\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD',
  odyEl: '\u05E2\u05D5\u05D3\u05D9 \u05D0\u05DC',
  nil: '\u05E0\u05D9\u05DC',
  rokiv: '\u05E8\u05D5\u05E7\u05D9\u05D1',
  reverseVisits: '\u05DD\u05D9\u05E8\u05D5\u05E7\u05D9\u05D1',
} as const

const STOPWORDS = new Set([
  HE.include,
  HE.work,
  HE.works,
  HE.visit,
  HE.visits,
  `${HE.price} ${HE.fixed}`,
  'including',
  'work',
  'visit',
  'fixed price',
  'fixed',
  'transport',
  'service call',
  'service_call',
  'callout',
  'call',
  'retem',
  HE.odyEl,
])

const PLURAL_TO_SINGULAR = new Map<string, string>([
  [HE.works, HE.work],
  [HE.visits, HE.visit],
  [HE.units, HE.unit],
  [HE.points, HE.point],
  [HE.hours, HE.hour],
  [HE.days, HE.day],
  [HE.services, HE.service],
  ['services', 'service'],
  ['visits', 'visit'],
  ['units', 'unit'],
  ['points', 'point'],
  ['hours', 'hour'],
  ['days', 'day'],
  ['meters', 'meter'],
])

const ALLOWED_LATIN_TOKENS = new Set([
  'pvc',
  'pex',
  'cpvc',
  'hdpe',
  'dn',
  'mm',
  'cm',
  'kw',
  'hp',
  'amp',
  'volt',
  'ac',
  'dc',
  'led',
  'wifi',
  'ip',
  'cat6',
  'cat5',
])

const NOISY_SUFFIX_TOKENS = new Set([
  HE.rokiv,
  HE.reverseVisits,
  '\u05E2\u05D5\u05D3\u05D9',
  '\u05D0\u05DC',
  'retem',
  'transport',
  'callout',
])

const VISIT_ALIAS_TOKENS = new Set([
  HE.visit,
  HE.visits,
  HE.reverseVisits,
  'visit',
  'visits',
  'service',
  'callout',
  'servicecall',
  'service_call',
])

const VISIT_PREFIX_TOKENS = new Set([HE.service, 'service', HE.visit, HE.visits, 'visit', 'callout'])

const TRAILING_UNIT_TOKEN =
  /\s+(sqm|m2|unit|point|visit|meter|hour|day|container|package|fixed|percent)\s*$/i
const INSTALL_POINT_PREFIX_PATTERN =
  /^(?:install(?:ation)?|\u05D4\u05EA\u05E7\u05E0\u05EA|\u05D4\u05EA\u05E7\u05E0\u05D4)\s+(?=(?:\u05E0\u05E7\u05D5\u05D3\u05EA|water\s+point|point)(?:\s|$))/i

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function containsHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value)
}

function normalizeToken(token: string): string {
  const lowered = token.toLowerCase().replace(/["'׳³ֲ´׳³ֲ³]/g, '')
  return PLURAL_TO_SINGULAR.get(lowered) ?? lowered
}

function stripStopwords(text: string): string {
  const normalized = normalizeSpaces(text.toLowerCase())
  let output = normalized
  STOPWORDS.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    output = output.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi'), ' ')
  })
  return normalizeSpaces(output)
}

function dropLatinNoiseTokens(tokens: string[]): string[] {
  const hasHebrew = tokens.some((token) => containsHebrew(token))
  if (!hasHebrew) return tokens
  return tokens.filter((token) => {
    if (!/^[a-z0-9]+$/i.test(token)) return true
    return ALLOWED_LATIN_TOKENS.has(token)
  })
}

function trimNoisySuffixTokens(tokens: string[]): string[] {
  if (tokens.length <= 2) return tokens
  const output = [...tokens]
  while (output.length > 2 && NOISY_SUFFIX_TOKENS.has(output[output.length - 1])) {
    output.pop()
  }
  return output
}

function mapToVisitCanonicalName(tokens: string[], source: string): string | null {
  const normalizedSource = source.toLowerCase()
  if (/(service[_\s-]*call|callout)/i.test(normalizedSource)) return HE.visitCanonical
  if (tokens.length === 0) return null
  if (VISIT_PREFIX_TOKENS.has(tokens[0])) return HE.visitCanonical
  if (tokens.some((token) => VISIT_ALIAS_TOKENS.has(token))) return HE.visitCanonical
  return null
}

export function normalizeGenericTrainingItemName(input: string): string {
  let output = normalizeSpaces(input)
  const sourceForAliasMapping = output
  output = output.replace(/\u05E2\u05D5\u05D3\u05D9\s+\u05D0\u05DC/gi, ' ')
  output = output.replace(INSTALL_POINT_PREFIX_PATTERN, '')
  output = output.replace(/\([^)]*\)/g, ' ')
  output = output.replace(/[_]/g, ' ')
  output = output.replace(/\s*[-/]\s*/g, ' ')
  output = output.replace(/\s+\d+\s*$/g, ' ')
  output = stripStopwords(output)

  const tokens = normalizeSpaces(output)
    .split(' ')
    .map(normalizeToken)
    .filter((token) => token.length > 0)
  const visitCanonical = mapToVisitCanonicalName(tokens, sourceForAliasMapping)
  if (visitCanonical) return visitCanonical
  output = trimNoisySuffixTokens(dropLatinNoiseTokens(tokens)).join(' ')
  while (TRAILING_UNIT_TOKEN.test(output)) output = output.replace(TRAILING_UNIT_TOKEN, ' ')
  return normalizeSpaces(output)
}
