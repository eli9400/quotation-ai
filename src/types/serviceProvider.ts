export type ServiceProviderIndustry =
  | 'general'
  | 'renovation'
  | 'electrical'
  | 'plumbing'
  | 'painting'
  | 'cleaning'
  | 'hvac'
  | 'gardening'

export type ServiceProviderProfile = {
  uid: string
  serviceProviderCode: string
  email: string
  displayName: string
  industry: ServiceProviderIndustry
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export type ServiceProviderPublicProfile = {
  uid: string
  serviceProviderCode: string
  displayName: string
  industry: ServiceProviderIndustry
}
