export type ServiceProviderProfile = {
  uid: string
  serviceProviderCode: string
  email: string
  displayName: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export type ServiceProviderPublicProfile = {
  uid: string
  serviceProviderCode: string
  displayName: string
}
