import { createHash } from 'node:crypto'
import type { PricingObservation } from '../types/pricing-observation.js'
import type { DatasetSplit } from '../types/training-dataset.js'

type SplitAssignment = Map<string, DatasetSplit>

type ItemObservation = {
  itemKey: string
  documentId: string
}

function splitKey(itemKey: string, documentId: string): string {
  return `${itemKey}::${documentId}`
}

function stableHash(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

function buildItemKey(observation: PricingObservation): string {
  return `${observation.canonicalName}|${observation.unit}`
}

function chooseSplitCounts(totalDocuments: number): {
  train: number
  validation: number
  test: number
} {
  if (totalDocuments <= 2) {
    return { train: totalDocuments, validation: 0, test: 0 }
  }
  if (totalDocuments === 3) {
    return { train: 2, validation: 1, test: 0 }
  }
  if (totalDocuments === 4) {
    return { train: 2, validation: 1, test: 1 }
  }

  const validation = Math.max(1, Math.round(totalDocuments * 0.15))
  const test = Math.max(1, Math.round(totalDocuments * 0.15))
  const train = Math.max(1, totalDocuments - validation - test)
  const remainder = totalDocuments - train - validation - test

  if (remainder <= 0) {
    return { train, validation, test }
  }

  return {
    train: train + remainder,
    validation,
    test,
  }
}

function sortDocumentIds(itemKey: string, documentIds: string[]): string[] {
  return documentIds
    .slice()
    .sort((a, b) => stableHash(`${itemKey}|${a}`).localeCompare(stableHash(`${itemKey}|${b}`)))
}

function assignItemSplits(itemKey: string, documentIds: string[]): SplitAssignment {
  const sorted = sortDocumentIds(itemKey, documentIds)
  const counts = chooseSplitCounts(sorted.length)
  const assignment: SplitAssignment = new Map()

  sorted.forEach((documentId, index) => {
    const split: DatasetSplit =
      index < counts.train
        ? 'train'
        : index < counts.train + counts.validation
          ? 'validation'
          : 'test'
    assignment.set(splitKey(itemKey, documentId), split)
  })

  return assignment
}

function collectUniqueItems(observations: PricingObservation[]): ItemObservation[] {
  const unique = new Set<string>()
  const rows: ItemObservation[] = []

  observations.forEach((observation) => {
    const itemKey = buildItemKey(observation)
    const key = splitKey(itemKey, observation.sourceDocumentId)
    if (unique.has(key)) {
      return
    }
    unique.add(key)
    rows.push({ itemKey, documentId: observation.sourceDocumentId })
  })

  return rows
}

export function assignDatasetSplitsByItemDocument(
  observations: PricingObservation[],
): SplitAssignment {
  const itemDocuments = collectUniqueItems(observations)
  const grouped = new Map<string, string[]>()

  itemDocuments.forEach((row) => {
    const list = grouped.get(row.itemKey) ?? []
    list.push(row.documentId)
    grouped.set(row.itemKey, list)
  })

  const finalAssignment: SplitAssignment = new Map()
  grouped.forEach((documentIds, itemKey) => {
    const itemAssignment = assignItemSplits(itemKey, documentIds)
    itemAssignment.forEach((split, key) => finalAssignment.set(key, split))
  })

  return finalAssignment
}

export function resolveObservationSplit(
  assignment: SplitAssignment,
  observation: PricingObservation,
): DatasetSplit {
  return assignment.get(splitKey(buildItemKey(observation), observation.sourceDocumentId)) ?? 'train'
}
