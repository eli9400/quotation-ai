const DATE_KEYWORDS = ['date', 'תאריך', 'הצעה', 'issued', 'invoice']

type Candidate = {
  date: Date
  index: number
  score: number
}

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function normalizeYear(year: number): number {
  if (year < 100) {
    return 2000 + year
  }
  return year
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function candidateScore(text: string, index: number): number {
  const contextStart = Math.max(0, index - 24)
  const contextEnd = Math.min(text.length, index + 24)
  const context = text.slice(contextStart, contextEnd).toLowerCase()
  const keywordScore = DATE_KEYWORDS.some((word) => context.includes(word)) ? 2 : 0
  const earlyBonus = Math.max(0, 1 - index / Math.max(1, text.length))
  return keywordScore + earlyBonus
}

function pushCandidate(
  candidates: Candidate[],
  text: string,
  index: number,
  year: number,
  month: number,
  day: number,
): void {
  if (!isValidDate(year, month, day)) {
    return
  }
  candidates.push({
    date: new Date(Date.UTC(year, month - 1, day)),
    index,
    score: candidateScore(text, index),
  })
}

function parsePatternDmy(text: string, candidates: Candidate[]): void {
  const pattern = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const day = Number(match[1])
    const month = Number(match[2])
    const year = normalizeYear(Number(match[3]))
    pushCandidate(candidates, text, index, year, month, day)
  }
}

function parsePatternYmd(text: string, candidates: Candidate[]): void {
  const pattern = /\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/g
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    pushCandidate(candidates, text, index, year, month, day)
  }
}

function parsePatternTextMonth(text: string, candidates: Candidate[]): void {
  const patternA =
    /\b(\d{1,2})\s+([a-zA-Z]{3,9})\.?,?\s+(\d{2,4})\b/g
  const patternB =
    /\b([a-zA-Z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/g

  for (const match of text.matchAll(patternA)) {
    const index = match.index ?? 0
    const day = Number(match[1])
    const monthLabel = match[2].toLowerCase()
    const year = normalizeYear(Number(match[3]))
    const month = MONTH_ALIASES[monthLabel]
    if (!month) {
      continue
    }
    pushCandidate(candidates, text, index, year, month, day)
  }

  for (const match of text.matchAll(patternB)) {
    const index = match.index ?? 0
    const monthLabel = match[1].toLowerCase()
    const day = Number(match[2])
    const year = normalizeYear(Number(match[3]))
    const month = MONTH_ALIASES[monthLabel]
    if (!month) {
      continue
    }
    pushCandidate(candidates, text, index, year, month, day)
  }
}

function parsePatternCompact(text: string, candidates: Candidate[]): void {
  const pattern = /\b(\d{2})(\d{2})(\d{4})\b/g
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    pushCandidate(candidates, text, index, year, month, day)
  }
}

function pickBestDate(candidates: Candidate[]): Date | null {
  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return a.index - b.index
  })
  return candidates[0].date
}

export function extractQuoteDateFromText(text: string): string | null {
  const source = text.trim()
  if (!source) {
    return null
  }

  const candidates: Candidate[] = []
  parsePatternDmy(source, candidates)
  parsePatternYmd(source, candidates)
  parsePatternTextMonth(source, candidates)
  parsePatternCompact(source, candidates)
  const best = pickBestDate(candidates)
  return best ? toIsoDate(best) : null
}
