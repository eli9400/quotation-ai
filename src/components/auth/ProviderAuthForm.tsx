import { useMemo, useState, type FormEvent } from 'react'
import type { ServiceProviderIndustry } from '../../types/serviceProvider'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SERVICE_PROVIDER_INDUSTRY_OPTIONS } from './serviceProviderIndustries'

type ProviderAuthFormProps = {
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

type AuthMode = 'sign-in' | 'sign-up'

export function ProviderAuthForm({
  isSigningIn,
  isSigningUp,
  onSignIn,
  onSignUp,
}: ProviderAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [industry, setIndustry] = useState<ServiceProviderIndustry>('general')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const isSubmitting = mode === 'sign-in' ? isSigningIn : isSigningUp
  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false
    if (mode === 'sign-up' && !displayName.trim()) return false
    return true
  }, [displayName, email, mode, password])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || isSubmitting) return
    if (mode === 'sign-in') {
      await onSignIn(email, password)
      return
    }
    await onSignUp(displayName, email, password, industry)
  }

  return (
    <>
      <h2>{mode === 'sign-in' ? 'כניסת נותן שירות' : 'הרשמת נותן שירות'}</h2>
      {mode === 'sign-up' ? (
        <p>צרו חשבון חדש, בחרו ענף שירות והתחילו לטעון הצעות עבר.</p>
      ) : null}

      <div className="auth-mode-switch">
        <button
          type="button"
          className={mode === 'sign-in' ? 'auth-mode-button active' : 'auth-mode-button'}
          onClick={() => setMode('sign-in')}
        >
          התחברות
        </button>
        <button
          type="button"
          className={mode === 'sign-up' ? 'auth-mode-button active' : 'auth-mode-button'}
          onClick={() => setMode('sign-up')}
        >
          הרשמה
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'sign-up' ? (
          <>
            <label htmlFor="authDisplayName">שם נותן השירות</label>
            <input
              id="authDisplayName"
              type="text"
              value={displayName}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="יוסי כהן"
            />

            <label htmlFor="authIndustry">ענף שירות</label>
            <select
              id="authIndustry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value as ServiceProviderIndustry)}
            >
              {SERVICE_PROVIDER_INDUSTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label htmlFor="authEmail">אימייל</label>
        <input
          id="authEmail"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="provider@example.com"
        />

        <label htmlFor="authPassword">סיסמה</label>
        <input
          id="authPassword"
          type="password"
          value={password}
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
        />

        <PrimaryButton type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting
            ? mode === 'sign-in'
              ? 'מתחבר...'
              : 'נרשם...'
            : mode === 'sign-in'
              ? 'התחבר'
              : 'צור חשבון'}
        </PrimaryButton>
      </form>
    </>
  )
}
