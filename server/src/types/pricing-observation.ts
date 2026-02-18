import type { PricingUnit } from './model-profile.js'

export type PricingObservation = {
  sourceDocumentId: string
  sourceLine: string
  rawName: string
  canonicalName: string
  unit: PricingUnit
  quantity: number
  pricePerUnit: number
  lineTotal: number
}

export type PricingObservationParseResult = {
  observations: PricingObservation[]
  skippedLines: number
}
