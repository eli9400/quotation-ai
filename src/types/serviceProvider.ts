export type ServiceProviderIndustry = string

export type ServiceProviderIndustryOption = {
  value: string
  label: string
}

export type ServiceProviderIndustryCategory = {
  id: string
  label: string
  options: ServiceProviderIndustryOption[]
}

export type ServiceProviderProfile = {
  uid: string
  serviceProviderCode: string
  email: string
  displayName: string
  industry: ServiceProviderIndustry
  industryLabel: string
  industryCategoryId: string
  industryCategoryLabel: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export type ServiceProviderPublicProfile = {
  uid: string
  serviceProviderCode: string
  displayName: string
  industry: ServiceProviderIndustry
  industryLabel: string
  industryCategoryId: string
  industryCategoryLabel: string
}

