import { useMemo, useState, type FormEvent } from 'react'
import {
  fetchClientFormSchema,
  fetchClientLineItemOptions,
  listClientQuotes,
  submitClientQuoteRequest,
  submitClientQuoteRevision,
  type ClientExtraRequestedItem,
  type ClientLineItemOption,
} from '../../services/api/clientPortalApi'
import { fetchServiceProviderByCode } from '../../services/api/serviceProvidersApi'
import type { FormPreviewSchema, Quote, StoredQuoteRecord } from '../../types/quotation'
import type { ServiceProviderPublicProfile } from '../../types/serviceProvider'
import { useVehicleCatalogOptions } from '../../hooks/useVehicleCatalogOptions'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ClientDynamicFieldInput } from './ClientDynamicFieldInput'
import { ClientQuotesPanel } from './ClientQuotesPanel'
import { ClientRequestedItemsEditor } from './ClientRequestedItemsEditor'
import {
  asErrorMessage,
  createInitialFormValues,
  fieldSort,
  shouldRenderField,
} from './clientAccessHelpers'

type ClientStage = 'lookup' | 'form'

export function ClientAccessPanel() {
  const [stage, setStage] = useState<ClientStage>('lookup')
  const [serviceCode, setServiceCode] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [serviceProvider, setServiceProvider] = useState<ServiceProviderPublicProfile | null>(null)
  const [schema, setSchema] = useState<FormPreviewSchema | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [clientItemOptions, setClientItemOptions] = useState<ClientLineItemOption[]>([])
  const [extraRequestedItems, setExtraRequestedItems] = useState<ClientExtraRequestedItem[]>([])
  const [quoteRecords, setQuoteRecords] = useState<StoredQuoteRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedManufacturer = formValues.intake_vehicleBrand ?? ''
  const selectedVehicleYear = formValues.intake_vehicleYear ?? ''
  const selectedVehicleType = formValues.intake_vehicleType ?? ''
  const { manufacturerOptions, modelOptions, trimOptions } = useVehicleCatalogOptions(
    schema,
    selectedManufacturer,
    selectedVehicleYear,
    selectedVehicleType,
  )

  const canLookup = useMemo(
    () =>
      serviceCode.trim().length >= 4 &&
      clientName.trim().length > 1 &&
      clientEmail.trim().includes('@'),
    [clientEmail, clientName, serviceCode],
  )

  const loadClientQuotes = async (code: string, email: string) => {
    setIsLoadingQuotes(true)
    try {
      setQuoteRecords(await listClientQuotes(code, email))
    } finally {
      setIsLoadingQuotes(false)
    }
  }

  const refreshClientQuotes = async (code: string, email: string) => {
    try {
      await loadClientQuotes(code, email)
    } catch (error) {
      setErrorMessage(asErrorMessage(error, 'טעינת רשימת ההצעות ללקוח נכשלה.'))
    }
  }

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canLookup || isLoading) return
    setErrorMessage(null)
    setStatusMessage(null)
    setIsLoading(true)
    try {
      const normalizedCode = serviceCode.trim().toUpperCase()
      const normalizedName = clientName.trim()
      const normalizedEmail = clientEmail.trim().toLowerCase()
      const [provider, nextSchema, nextOptions] = await Promise.all([
        fetchServiceProviderByCode(normalizedCode),
        fetchClientFormSchema(normalizedCode),
        fetchClientLineItemOptions(normalizedCode),
      ])
      setServiceCode(normalizedCode)
      setClientName(normalizedName)
      setClientEmail(normalizedEmail)
      setServiceProvider(provider)
      setSchema(nextSchema)
      setClientItemOptions(nextOptions)
      setFormValues(createInitialFormValues(nextSchema, normalizedName, normalizedEmail))
      setExtraRequestedItems([])
      setStage('form')
      await refreshClientQuotes(normalizedCode, normalizedEmail)
    } catch (error) {
      setErrorMessage(asErrorMessage(error, 'טעינת טופס לקוח נכשלה.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleFieldChange = (fieldId: string, value: string) =>
    setFormValues((current) => {
      const next = { ...current, [fieldId]: value }
      if (fieldId === 'intake_vehicleType') {
        next.intake_vehicleBrand = ''
        next.intake_vehicleModel = ''
      }
      if (fieldId === 'intake_vehicleBrand') {
        next.intake_vehicleModel = ''
      }
      return next
    })

  const handleFormReset = () => {
    if (!schema) return
    setFormValues(createInitialFormValues(schema, clientName.trim(), clientEmail.trim()))
    setExtraRequestedItems([])
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!schema || isLoading) return
    setErrorMessage(null)
    setStatusMessage(null)
    setIsLoading(true)
    try {
      const requestId = await submitClientQuoteRequest(serviceCode, formValues, extraRequestedItems)
      setStatusMessage(`הבקשה נשלחה לנותן השירות. מספר מעקב: ${requestId}`)
      await refreshClientQuotes(serviceCode, clientEmail)
    } catch (error) {
      setErrorMessage(asErrorMessage(error, 'שליחת בקשת לקוח נכשלה.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitRevision = async (quoteId: string, quote: Quote) => {
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmittingRevision(true)
    try {
      const updated = await submitClientQuoteRevision(serviceCode, clientEmail, quoteId, quote)
      setQuoteRecords((current) =>
        current.map((record) => (record.id === updated.id ? updated : record)),
      )
      setStatusMessage('הגרסה המעודכנת נשלחה לאישור נותן השירות.')
    } catch (error) {
      setErrorMessage(asErrorMessage(error, 'שליחת עדכון לנותן השירות נכשלה.'))
    } finally {
      setIsSubmittingRevision(false)
    }
  }

  if (stage === 'form' && schema && serviceProvider) {
    const orderedFields = schema.fields.filter(shouldRenderField).slice().sort(fieldSort)
    return (
      <>
        <h2>טופס בקשת לקוח</h2>
        <p>
          נותן שירות: <strong>{serviceProvider.displayName}</strong> ({serviceProvider.serviceProviderCode})
        </p>
        <p className="quote-cpi-caption">
          פרטי לקוח מזוהים אוטומטית: {clientName} | {clientEmail}
        </p>
        <form className="auth-form client-form" onSubmit={handleFormSubmit}>
          <div className="client-form-fields">
            {orderedFields.map((field) => (
              <ClientDynamicFieldInput
                key={field.id}
                field={field}
                value={formValues[field.id] ?? ''}
                disabled={isLoading}
                manufacturerOptions={manufacturerOptions}
                modelOptions={modelOptions}
                trimOptions={trimOptions}
                onChange={(value) => handleFieldChange(field.id, value)}
              />
            ))}
          </div>

          <ClientRequestedItemsEditor
            options={clientItemOptions}
            items={extraRequestedItems}
            disabled={isLoading}
            onChange={setExtraRequestedItems}
          />

          <div className="auth-actions-row">
            <PrimaryButton type="button" disabled={isLoading} onClick={handleFormReset}>ניקוי טופס</PrimaryButton>
            <PrimaryButton type="submit" disabled={isLoading}>{isLoading ? 'שולח בקשה...' : 'שלח בקשה להצעת מחיר'}</PrimaryButton>
          </div>
        </form>

        <ClientQuotesPanel
          records={quoteRecords}
          isLoading={isLoadingQuotes}
          isSubmittingRevision={isSubmittingRevision}
          onRefresh={() => refreshClientQuotes(serviceCode, clientEmail)}
          onSubmitRevision={handleSubmitRevision}
        />

        {statusMessage ? <p className="auth-status auth-status-success">{statusMessage}</p> : null}
        {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
      </>
    )
  }

  return (
    <>
      <h2>כניסת לקוח</h2>
      <p>מלאו קוד נותן שירות ופרטי קשר כדי להמשיך לטופס הדינמי.</p>
      <form className="auth-form" onSubmit={handleLookupSubmit}>
        <label htmlFor="clientServiceCode">קוד נותן שירות</label>
        <input id="clientServiceCode" type="text" value={serviceCode} onChange={(event) => setServiceCode(event.target.value.toUpperCase())} placeholder="לדוגמה: JMR34E7" />
        <label htmlFor="clientName">שם לקוח</label>
        <input id="clientName" type="text" value={clientName} autoComplete="name" onChange={(event) => setClientName(event.target.value)} placeholder="ישראל ישראלי" />
        <label htmlFor="clientEmail">אימייל לקוח</label>
        <input id="clientEmail" type="email" value={clientEmail} autoComplete="email" onChange={(event) => setClientEmail(event.target.value)} placeholder="client@example.com" />
        <PrimaryButton type="submit" disabled={!canLookup || isLoading}>{isLoading ? 'טוען טופס...' : 'המשך לטופס לקוח'}</PrimaryButton>
      </form>
      {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
    </>
  )
}
