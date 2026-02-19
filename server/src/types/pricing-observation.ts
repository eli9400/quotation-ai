import type { PricingUnit } from './model-profile.js'
import type { MaterialsMode, VatMode } from './pricing-context.js'

export type PricingObservation = {
  sourceDocumentId: string
  sourceQuoteDate: string | null
  sourceLine: string
  rawName: string
  canonicalName: string
  unit: PricingUnit
  quantity: number
  pricePerUnit: number
  lineTotal: number
  cpiAdjustmentFactor: number
  vatMode: VatMode
  vatRate: number | null
  materialsMode: MaterialsMode
  discountPercent: number | null
  discountAmount: number | null
}

export type PricingObservationParseResult = {
  observations: PricingObservation[]
  skippedLines: number
}
