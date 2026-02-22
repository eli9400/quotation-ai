import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchServiceProviderIndustryCatalog } from '../../services/api/serviceProvidersApi'
import type { ServiceProviderIndustryCategory } from '../../types/serviceProvider'
import { PrimaryButton } from '../ui/PrimaryButton'

type ProviderAuthFormProps = {
  isSigningIn: boolean
  isSigningUp: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (
    displayName: string,
    email: string,
    password: string,
    industry: string,
  ) => Promise<void>
}

type AuthMode = 'sign-in' | 'sign-up'

const FALLBACK_CATEGORIES: ServiceProviderIndustryCategory[] = [
  {
    id: 'construction_renovation',
    label: 'בנייה ושיפוצים',
    options: [{ value: 'general_service_provider', label: 'נותן שירות כללי' }],
  },
]

function firstIndustryValue(categories: ServiceProviderIndustryCategory[]): string {
  return categories[0]?.options[0]?.value ?? 'general_service_provider'
}

export function ProviderAuthForm({
  isSigningIn,
  isSigningUp,
  onSignIn,
  onSignUp,
}: ProviderAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [industry, setIndustry] = useState(firstIndustryValue(FALLBACK_CATEGORIES))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [industryCategories, setIndustryCategories] =
    useState<ServiceProviderIndustryCategory[]>(FALLBACK_CATEGORIES)
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadCatalog = async () => {
      setIsCatalogLoading(true)
      setCatalogError(null)
      try {
        const categories = await fetchServiceProviderIndustryCatalog()
        if (!active) return
        if (categories.length > 0) {
          setIndustryCategories(categories)
          setIndustry((current) =>
            categories.some((category) =>
              category.options.some((option) => option.value === current),
            )
              ? current
              : firstIndustryValue(categories),
          )
          return
        }
        setCatalogError('לא נמצאו תחומי שירות מוגדרים. מוצג מצב ברירת מחדל.')
      } catch {
        if (!active) return
        setCatalogError('טעינת תחומי השירות נכשלה. אפשר להמשיך עם ברירת מחדל.')
      } finally {
        if (active) setIsCatalogLoading(false)
      }
    }

    void loadCatalog()
    return () => {
      active = false
    }
  }, [])

  const isSubmitting = mode === 'sign-in' ? isSigningIn : isSigningUp
  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false
    if (mode === 'sign-up') {
      if (!displayName.trim()) return false
      if (!industry.trim()) return false
      if (isCatalogLoading) return false
    }
    return true
  }, [displayName, email, industry, isCatalogLoading, mode, password])

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
        <p>צרו חשבון חדש, בחרו תחום התמחות והתחילו לטעון הצעות עבר.</p>
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

            <label htmlFor="authIndustry">תחום התמחות</label>
            <select
              id="authIndustry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              disabled={isCatalogLoading}
            >
              {industryCategories.map((category) => (
                <optgroup key={category.id} label={category.label}>
                  {category.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {catalogError ? <p className="auth-status auth-status-error">{catalogError}</p> : null}
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

