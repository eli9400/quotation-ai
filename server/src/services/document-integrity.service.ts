import type { ExtractedDocumentText } from './document-text-extractor.service.js'
import { extractPricingObservations } from './pricing-observation-parser.service.js'

export type DocumentIntegrityStatus = 'valid' | 'corrupted'

export type DocumentIntegrityResult = {
  status: DocumentIntegrityStatus
  reason: string | null
  heuristicLineItems: number
  signalScore: number
}

const LETTER_PATTERN = /[A-Za-z\u0590-\u05FF]/g
const DIGIT_PATTERN = /\d/g
const WORD_PATTERN = /[A-Za-z\u0590-\u05FF]{2,}/g
const REPEATED_N_PATTERN = /^(?:n|N){2,}$/

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getMaxCharRatio(text: string): number {
  if (text.length === 0) return 0
  const chars = text.split('')
  const counts = new Map<string, number>()
  chars.forEach((char) => {
    counts.set(char, (counts.get(char) ?? 0) + 1)
  })
  let maxCount = 0
  counts.forEach((count) => {
    if (count > maxCount) {
      maxCount = count
    }
  })
  return maxCount / chars.length
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function computeSignalScore(params: {
  textChars: number
  lettersCount: number
  digitsCount: number
  wordsCount: number
  repeatedNRatio: number
  maxCharRatio: number
  heuristicLineItems: number
}): number {
  const {
    textChars,
    lettersCount,
    digitsCount,
    wordsCount,
    repeatedNRatio,
    maxCharRatio,
    heuristicLineItems,
  } = params

  let score = 0
  score += Math.min(35, wordsCount * 1.5)
  score += Math.min(20, Math.floor(lettersCount / 6))
  score += Math.min(10, digitsCount * 0.8)
  score += Math.min(35, heuristicLineItems * 7)

  if (textChars < 80) score -= 25
  if (lettersCount < 24) score -= 20
  score -= repeatedNRatio * 40
  if (maxCharRatio > 0.58) {
    score -= (maxCharRatio - 0.58) * 100
  }

  return clampScore(score)
}

export function assessExtractedDocumentIntegrity(
  document: ExtractedDocumentText,
): DocumentIntegrityResult {
  const normalizedText = document.text.replace(/\s+/g, ' ').trim()
  const textChars = normalizedText.length
  const lettersCount = (normalizedText.match(LETTER_PATTERN) ?? []).length
  const digitsCount = (normalizedText.match(DIGIT_PATTERN) ?? []).length
  const wordsCount = (normalizedText.match(WORD_PATTERN) ?? []).length

  const tokens = tokenize(normalizedText)
  const repeatedNTokens = tokens.filter((token) => REPEATED_N_PATTERN.test(token)).length
  const repeatedNRatio = tokens.length > 0 ? repeatedNTokens / tokens.length : 0

  const compactChars = normalizedText
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF]/g, '')
  const maxCharRatio = getMaxCharRatio(compactChars)

  const parsed = extractPricingObservations([document])
  const heuristicLineItems = parsed.observations.length

  const signalScore = computeSignalScore({
    textChars,
    lettersCount,
    digitsCount,
    wordsCount,
    repeatedNRatio,
    maxCharRatio,
    heuristicLineItems,
  })

  if (textChars < 60 || wordsCount < 6) {
    return {
      status: 'corrupted',
      reason: 'לא זוהה מספיק טקסט קריא בקובץ.',
      heuristicLineItems,
      signalScore,
    }
  }

  if (repeatedNRatio >= 0.45 && heuristicLineItems === 0) {
    return {
      status: 'corrupted',
      reason: 'הטקסט שחולץ מהקובץ נראה משובש (OCR/פונט לא נתמך).',
      heuristicLineItems,
      signalScore,
    }
  }

  if (maxCharRatio >= 0.72 && heuristicLineItems === 0) {
    return {
      status: 'corrupted',
      reason: 'חילוץ הטקסט לא תקין. נסו קובץ PDF ברור יותר או XLSX.',
      heuristicLineItems,
      signalScore,
    }
  }

  if (heuristicLineItems === 0 && signalScore < 45) {
    return {
      status: 'corrupted',
      reason: 'לא זוהו שורות תמחור תקינות בקובץ.',
      heuristicLineItems,
      signalScore,
    }
  }

  return {
    status: 'valid',
    reason: null,
    heuristicLineItems,
    signalScore,
  }
}
