import type {
  DatasetExampleSource,
  DatasetSplit,
  DatasetSplitCounts,
  TrainingDatasetExample,
  TrainingDatasetStats,
} from '../types/training-dataset.js'

const MAX_ITEM_STATS = 120

function nowIso(): string {
  return new Date().toISOString()
}

function createSplitCounts(): DatasetSplitCounts {
  return { train: 0, validation: 0, test: 0 }
}

function addSplit(splitCounts: DatasetSplitCounts, split: DatasetSplit): void {
  splitCounts[split] += 1
}

export function buildTrainingDatasetStats(
  serviceProviderUid: string,
  examples: TrainingDatasetExample[],
): TrainingDatasetStats {
  const splitCounts = createSplitCounts()
  const sourceCounts: Record<DatasetExampleSource, number> = {
    uploaded_document: 0,
    approved_quote: 0,
  }
  const itemAggregation = new Map<
    string,
    { itemName: string; unit: TrainingDatasetExample['unit']; exampleCount: number; documents: Set<string> }
  >()

  examples.forEach((example) => {
    addSplit(splitCounts, example.split)
    sourceCounts[example.source] += 1

    const current = itemAggregation.get(example.itemKey) ?? {
      itemName: example.itemName,
      unit: example.unit,
      exampleCount: 0,
      documents: new Set<string>(),
    }
    current.exampleCount += 1
    if (example.sourceDocumentId) {
      current.documents.add(example.sourceDocumentId)
    }
    itemAggregation.set(example.itemKey, current)
  })

  const itemStats = Array.from(itemAggregation.entries())
    .map(([itemKey, item]) => ({
      itemKey,
      itemName: item.itemName,
      unit: item.unit,
      exampleCount: item.exampleCount,
      documentCount: item.documents.size,
    }))
    .sort((a, b) => b.exampleCount - a.exampleCount || b.documentCount - a.documentCount)
    .slice(0, MAX_ITEM_STATS)

  return {
    id: serviceProviderUid,
    serviceProviderUid,
    totalExamples: examples.length,
    splitCounts,
    uniqueItems: itemAggregation.size,
    sourceCounts,
    itemStats,
    generatedAt: nowIso(),
  }
}
