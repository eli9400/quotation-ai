import type { ServiceProviderProfile } from '../../types/serviceProvider'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SERVICE_PROVIDER_INDUSTRY_OPTIONS } from './serviceProviderIndustries'

type ServiceProviderTopBarProps = {
  serviceProvider: ServiceProviderProfile
  isSigningOut: boolean
  onSignOut: () => Promise<void>
}

function industryLabel(industry: ServiceProviderProfile['industry']): string {
  return (
    SERVICE_PROVIDER_INDUSTRY_OPTIONS.find((option) => option.value === industry)?.label ??
    'כללי'
  )
}

export function ServiceProviderTopBar({
  serviceProvider,
  isSigningOut,
  onSignOut,
}: ServiceProviderTopBarProps) {
  return (
    <section className="service-provider-bar">
      <div>
        <p>
          <strong>נותן שירות:</strong> {serviceProvider.displayName}
        </p>
        <p>
          <strong>ענף:</strong> {industryLabel(serviceProvider.industry)}
        </p>
        <p>
          <strong>קוד זיהוי:</strong> {serviceProvider.serviceProviderCode}
        </p>
      </div>

      <PrimaryButton type="button" disabled={isSigningOut} onClick={onSignOut}>
        {isSigningOut ? 'מתנתק...' : 'התנתק'}
      </PrimaryButton>
    </section>
  )
}
