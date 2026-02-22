import { useState } from 'react'
import type { ServiceProviderIndustry } from '../../types/serviceProvider'
import { ClientAccessPanel } from './ClientAccessPanel'
import { ProviderAuthForm } from './ProviderAuthForm'

type ServiceProviderAuthPanelProps = {
  isSigningIn: boolean
  isSigningUp: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (
    displayName: string,
    email: string,
    password: string,
    industry: ServiceProviderIndustry,
  ) => Promise<void>
}

type EntryRole = 'provider' | 'client'

const AUTH_ROLE_STORAGE_KEY = 'quotation-ai-auth-role'

function loadStoredRole(): EntryRole {
  if (typeof window === 'undefined') return 'provider'
  const value = window.localStorage.getItem(AUTH_ROLE_STORAGE_KEY)
  return value === 'client' ? 'client' : 'provider'
}

function saveRole(role: EntryRole) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_ROLE_STORAGE_KEY, role)
}

export function ServiceProviderAuthPanel(props: ServiceProviderAuthPanelProps) {
  const [role, setRole] = useState<EntryRole>(() => loadStoredRole())

  const switchRole = (nextRole: EntryRole) => {
    setRole(nextRole)
    saveRole(nextRole)
  }

  return (
    <section className="auth-panel">
      <div className="auth-role-switch">
        <button
          type="button"
          className={role === 'provider' ? 'auth-role-button active' : 'auth-role-button'}
          onClick={() => switchRole('provider')}
        >
          נותן שירות
        </button>
        <button
          type="button"
          className={role === 'client' ? 'auth-role-button active' : 'auth-role-button'}
          onClick={() => switchRole('client')}
        >
          לקוח
        </button>
      </div>

      {role === 'provider' ? (
        <ProviderAuthForm
          isSigningIn={props.isSigningIn}
          isSigningUp={props.isSigningUp}
          onSignIn={props.onSignIn}
          onSignUp={props.onSignUp}
        />
      ) : (
        <ClientAccessPanel />
      )}
    </section>
  )
}
