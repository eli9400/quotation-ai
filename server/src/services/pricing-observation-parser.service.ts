import type { PricingUnit } from '../types/model-profile.js'
import type {
  PricingObservation,
  PricingObservationParseResult,
} from '../types/pricing-observation.js'
import type { ExtractedDocumentText } from './document-text-extractor.service.js'
import { inferPricingNumbers } from './pricing-number-inference.service.js'
import {
  buildObservation,
  detectUnit,
  extractNumbers,
  hasPriceLabel,
  hasQuantityLabel,
  hasTotalLabel,
  isIgnoredDescription,
  normalizeLine,
  parseNumber,
  pickDescriptionFromLine,
} from './pricing-parser-utils.service.js'

type PendingCandidate = {
  description: string | null
  unit: PricingUnit
  quantity: number | null
  pricePerUnit: number | null
  lineTotal: number | null
  lineIndex: number
  sourceLine: string
}

function flushPendingCandidate(documentId: string, pending: PendingCandidate) {
  if (!pending.description || pending.quantity === null || pending.pricePerUnit === null) {
    return null
  }

  const lineTotal =
    pending.lineTotal ?? Math.max(1, Number((pending.quantity * pending.pricePerUnit).toFixed(2)))
  return buildObservation(
    documentId,
    pending.sourceLine,
    pending.description,
    pending.unit,
    pending.quantity,
    pending.pricePerUnit,
    lineTotal,
  )
}

function tryParseTabularLine(documentId: string, line: string) {
  if (!line.includes('\t')) {
    return null
  }

  const cells = line
    .split('\t')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)

  if (cells.length < 4) {
    return null
  }

  const numbers = cells.map((cell) => parseNumber(cell))
  const numericIndexes = numbers
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value !== null)

  if (numericIndexes.length < 3) {
    return null
  }

  const inferred = inferPricingNumbers(numericIndexes.map((item) => item.value))
  if (!inferred) {
    return null
  }

  const quantity = inferred.quantity
  const pricePerUnit = inferred.pricePerUnit
  const lineTotal = inferred.lineTotal
  const firstNumericIndex = numericIndexes[0].index
  const description = cells
    .slice(0, Math.max(1, firstNumericIndex - 1))
    .join(' ')
    .trim()
  const unitCell = firstNumericIndex > 0 ? cells[firstNumericIndex - 1] : ''
  const unit = detectUnit(unitCell || line)

  if (!description || isIgnoredDescription(description)) {
    return null
  }

  return buildObservation(
    documentId,
    line,
    description,
    unit,
    quantity,
    pricePerUnit,
    lineTotal,
  )
}

function parseDocumentText(document: ExtractedDocumentText): PricingObservationParseResult {
  const lines = document.text
    .split('\n')
    .map((line) => line.replace(/\r/g, '').trim())
    .filter((line) => line.length > 0)
  const observations: PricingObservation[] = []
  let skippedLines = 0
  let lastDescription: string | null = null
  let pending: PendingCandidate | null = null

  lines.forEach((rawLine, index) => {
    const tabularObservation = tryParseTabularLine(document.documentId, rawLine)
    if (tabularObservation) {
      observations.push(tabularObservation)
      return
    }

    const line = normalizeLine(rawLine)
    const numbers = extractNumbers(line)
    const description = pickDescriptionFromLine(line)
    const unit = detectUnit(line)
    const quantityLabel = hasQuantityLabel(line)
    const priceLabel = hasPriceLabel(line)
    const totalLabel = hasTotalLabel(line)

    if (
      description &&
      !isIgnoredDescription(description) &&
      numbers.length === 0 &&
      !quantityLabel &&
      !priceLabel
    ) {
      lastDescription = description
    }

    if (pending && index - pending.lineIndex > 3) {
      const flushed = flushPendingCandidate(document.documentId, pending)
      if (flushed) {
        observations.push(flushed)
      } else {
        skippedLines += 1
      }
      pending = null
    }

    if (numbers.length >= 2 && description) {
      const inferred = inferPricingNumbers(numbers)
      if (!inferred) {
        skippedLines += 1
        return
      }
      const observation = buildObservation(
        document.documentId,
        line,
        description,
        unit,
        inferred.quantity,
        inferred.pricePerUnit,
        inferred.lineTotal,
      )
      if (observation) {
        observations.push(observation)
      } else {
        skippedLines += 1
      }
      return
    }

    if (numbers.length === 0) {
      return
    }

    pending = pending ?? {
      description: description ?? lastDescription,
      unit,
      quantity: null,
      pricePerUnit: null,
      lineTotal: null,
      lineIndex: index,
      sourceLine: line,
    }

    pending.lineIndex = index
    pending.sourceLine = `${pending.sourceLine} | ${line}`
    pending.description = pending.description ?? description ?? lastDescription
    if (pending.unit === 'unknown' && unit !== 'unknown') {
      pending.unit = unit
    }

    if (quantityLabel && numbers.length >= 1) {
      pending.quantity = numbers[0]
    } else if (priceLabel && numbers.length >= 1) {
      pending.pricePerUnit = numbers[numbers.length - 1]
    } else if (totalLabel && numbers.length >= 1) {
      pending.lineTotal = numbers[numbers.length - 1]
    } else if (numbers.length >= 2 && pending.quantity === null && pending.pricePerUnit === null) {
      const inferred = inferPricingNumbers(numbers)
      if (inferred) {
        pending.quantity = inferred.quantity
        pending.pricePerUnit = inferred.pricePerUnit
        pending.lineTotal = inferred.lineTotal
      }
    }

    const flushed = flushPendingCandidate(document.documentId, pending)
    if (flushed) {
      observations.push(flushed)
      pending = null
    }
  })

  if (pending) {
    const flushed = flushPendingCandidate(document.documentId, pending)
    if (flushed) {
      observations.push(flushed)
    } else {
      skippedLines += 1
    }
  }

  return { observations, skippedLines }
}

export function extractPricingObservations(
  documents: ExtractedDocumentText[],
): PricingObservationParseResult {
  const observations: PricingObservation[] = []
  let skippedLines = 0

  documents.forEach((document) => {
    const parsed = parseDocumentText(document)
    observations.push(...parsed.observations)
    skippedLines += parsed.skippedLines
  })

  return { observations, skippedLines }
}
