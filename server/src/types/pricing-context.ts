export type VatMode = 'included' | 'excluded' | 'unknown'

export type MaterialsMode = 'included' | 'excluded' | 'unknown'

export type DocumentPricingContext = {
  vatMode: VatMode
  vatRate: number | null
  discountPercent: number | null
  discountAmount: number | null
  materialsMode: MaterialsMode
}
