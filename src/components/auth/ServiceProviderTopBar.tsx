import type { ServiceProviderProfile } from '../../types/serviceProvider'
import { PrimaryButton } from '../ui/PrimaryButton'

type ServiceProviderTopBarProps = {
  serviceProvider: ServiceProviderProfile
  isSigningOut: boolean
  onSignOut: () => Promise<void>
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
          <strong>קוד זיהוי:</strong> {serviceProvider.serviceProviderCode}
        </p>
      </div>

      <PrimaryButton type="button" disabled={isSigningOut} onClick={onSignOut}>
        {isSigningOut ? 'מתנתק...' : 'התנתק'}
      </PrimaryButton>
    </section>
  )
}
