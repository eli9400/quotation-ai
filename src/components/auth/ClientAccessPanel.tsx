import { useMemo, useState, type FormEvent } from 'react'
import { fetchClientFormSchema, submitClientQuoteRequest } from '../../services/api/clientPortalApi'
import { fetchServiceProviderByCode } from '../../services/api/serviceProvidersApi'
import type { FormPreviewSchema } from '../../types/quotation'
import type { ServiceProviderPublicProfile } from '../../types/serviceProvider'
import { PrimaryButton } from '../ui/PrimaryButton'

type ClientStage = 'lookup' | 'form' | 'submitted'

function initialFieldValue(field: FormPreviewSchema['fields'][number]): string {
  return field.type === 'number' ? '0' : ''
}

function createInitialFormValues(
  schema: FormPreviewSchema,
  clientName: string,
  clientEmail: string,
): Record<string, string> {
  const values: Record<string, string> = {}
  schema.fields.forEach((field) => {
    values[field.id] = initialFieldValue(field)
  })
  values.clientName = clientName
  values.clientEmail = clientEmail
  return values
}

export function ClientAccessPanel() {
  const [stage, setStage] = useState<ClientStage>('lookup')
  const [serviceCode, setServiceCode] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [serviceProvider, setServiceProvider] = useState<ServiceProviderPublicProfile | null>(null)
  const [schema, setSchema] = useState<FormPreviewSchema | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canLookup = useMemo(() => {
    const hasEmail = clientEmail.trim().includes('@')
    return serviceCode.trim().length >= 4 && clientName.trim().length > 1 && hasEmail
  }, [clientEmail, clientName, serviceCode])

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canLookup || isLoading) {
      return
    }

    setErrorMessage(null)
    setIsLoading(true)
    try {
      const normalizedCode = serviceCode.trim().toUpperCase()
      const [provider, nextSchema] = await Promise.all([
        fetchServiceProviderByCode(normalizedCode),
        fetchClientFormSchema(normalizedCode),
      ])

      setServiceCode(normalizedCode)
      setServiceProvider(provider)
      setSchema(nextSchema)
      setFormValues(createInitialFormValues(nextSchema, clientName.trim(), clientEmail.trim()))
      setStage('form')
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'טעינת טופס לקוח נכשלה.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormValues((current) => ({ ...current, [fieldId]: value }))
  }

  const handleFormReset = () => {
    if (!schema) {
      return
    }
    setFormValues(createInitialFormValues(schema, clientName.trim(), clientEmail.trim()))
    setErrorMessage(null)
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!schema || isLoading) {
      return
    }

    setErrorMessage(null)
    setIsLoading(true)
    try {
      const requestId = await submitClientQuoteRequest(serviceCode, formValues)
      setCreatedRequestId(requestId)
      setStage('submitted')
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'שליחת בקשת לקוח נכשלה.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (stage === 'submitted') {
    return (
      <>
        <h2>הבקשה נשלחה</h2>
        <p>
          הבקשה שלך נשלחה לנותן השירות לבדיקה ואישור. מספר מעקב: <strong>{createdRequestId}</strong>
        </p>
        <PrimaryButton
          type="button"
          disabled={isLoading}
          onClick={() => {
            setStage('lookup')
            setSchema(null)
            setServiceProvider(null)
            setFormValues({})
            setCreatedRequestId(null)
            setErrorMessage(null)
          }}
        >
          שליחת בקשה חדשה
        </PrimaryButton>
      </>
    )
  }

  if (stage === 'form' && schema && serviceProvider) {
    const orderedFields = schema.fields.slice().sort((a, b) => a.order - b.order)

    return (
      <>
        <h2>טופס בקשת לקוח</h2>
        <p>
          נותן שירות: <strong>{serviceProvider.displayName}</strong> ({serviceProvider.serviceProviderCode})
        </p>

        <form className="auth-form client-form" onSubmit={handleFormSubmit}>
          <div className="client-form-fields">
            {orderedFields.map((field) => (
              <label key={field.id}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.type === 'textarea' ? (
                  <textarea
                    rows={4}
                    value={formValues[field.id] ?? ''}
                    onChange={(event) => handleFieldChange(field.id, event.target.value)}
                    placeholder={field.placeholder ?? ''}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formValues[field.id] ?? ''}
                    onChange={(event) => handleFieldChange(field.id, event.target.value)}
                  >
                    <option value="">בחרו</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    min={field.type === 'number' ? 0 : undefined}
                    value={formValues[field.id] ?? ''}
                    onChange={(event) => handleFieldChange(field.id, event.target.value)}
                    placeholder={field.placeholder ?? ''}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="auth-actions-row">
            <PrimaryButton type="button" disabled={isLoading} onClick={handleFormReset}>
              ניקוי טופס
            </PrimaryButton>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? 'שולח בקשה...' : 'שלח בקשה להצעת מחיר'}
            </PrimaryButton>
          </div>
        </form>

        {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
      </>
    )
  }

  return (
    <>
      <h2>כניסת לקוח</h2>
      <p>מלאו קוד נותן שירות ופרטי קשר כדי להמשיך לטופס הבקשה הדינמי.</p>

      <form className="auth-form" onSubmit={handleLookupSubmit}>
        <label htmlFor="clientServiceCode">קוד נותן שירות</label>
        <input
          id="clientServiceCode"
          type="text"
          value={serviceCode}
          onChange={(event) => setServiceCode(event.target.value.toUpperCase())}
          placeholder="לדוגמה: JMR34E7"
        />

        <label htmlFor="clientName">שם לקוח</label>
        <input
          id="clientName"
          type="text"
          value={clientName}
          autoComplete="name"
          onChange={(event) => setClientName(event.target.value)}
          placeholder="ישראל ישראלי"
        />

        <label htmlFor="clientEmail">אימייל לקוח</label>
        <input
          id="clientEmail"
          type="email"
          value={clientEmail}
          autoComplete="email"
          onChange={(event) => setClientEmail(event.target.value)}
          placeholder="client@example.com"
        />

        <PrimaryButton type="submit" disabled={!canLookup || isLoading}>
          {isLoading ? 'טוען טופס...' : 'המשך לטופס לקוח'}
        </PrimaryButton>
      </form>

      {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
    </>
  )
}
