export type CustomFeatureValueType = 'number' | 'text' | 'boolean'

export type CustomFeatureValue = string | number | boolean | null

export type ServiceProviderCustomFeature = {
  id: string
  serviceProviderUid: string
  key: string
  label: string
  valueType: CustomFeatureValueType
  defaultValue: CustomFeatureValue
  showInQuoteDetails: boolean
  createdAt: string
  updatedAt: string
}
