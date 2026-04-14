import { useCallback, useMemo, useState, type FormEvent } from 'react'
import type {
  ProviderCustomFeatureOption,
  ProviderLineItemOption,
  Quote,
  StoredQuoteRecord,
} from '../../types/quotation'
import { PrimaryButton } from '../ui/PrimaryButton'
import { QuoteDetailsForm } from './QuoteDetailsForm'
import { QuotePreviewModal } from './QuotePreviewModal'
import {
  findProviderCustomFeatureByText,
  toEditableCustomFieldFromFeature,
} from './providerCustomFieldOptions'
import { estimateLineItemUnitPrice, findLineItemOptionByText } from './providerLineItemOptions'
import { isSameLabel, mergeLineByIdentity, normalizeCustomFieldKey } from './quoteDetailsPanelMatchers'
import {
  emptyCustomField,
  emptyLineItem,
  QUOTE_SOURCE_LABEL,
  quoteStatusLabel,
  serializeQuote,
  toFactor,
} from './quoteDetailsPanelHelpers'
import { computeLineTotals, isPercentLineUnit } from './quoteLineMath'
import { applyCpiFactorToLineItems, toEditableState, toParsedQuote, type EditableLineItem, type EditableQuoteState } from './quoteDetailsUtils'
import { useQuoteAutoTextSync } from './useQuoteAutoTextSync'

type QuoteDetailsPanelProps = {
  record: StoredQuoteRecord
  lineItemOptions: ProviderLineItemOption[]
  customFeatureOptions: ProviderCustomFeatureOption[]
  isSaving: boolean
  isApproving: boolean
  isDeleting: boolean
  onClose: () => void
  onSave: (quoteId: string, quote: Quote) => Promise<void>
  onApprove: (quoteId: string, quote?: Quote) => Promise<void>
  onComplete: (quoteId: string) => Promise<void>
  onDelete: (quoteId: string) => Promise<void>
}

const DISCOUNT_LABEL_PATTERN = /הנחה|discount|זיכוי|credit/i

function normalizePercentUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase()
  return normalized === '%' || normalized === 'pct' ? 'percent' : unit
}

function defaultPercentUnitPrice(description: string): number {
  return DISCOUNT_LABEL_PATTERN.test(description) ? -1 : 1
}

function withPercentDefaults(line: EditableLineItem): EditableLineItem {
  if (!isPercentLineUnit(line.unit)) return line
  const unitPrice = Number(line.unitPrice)
  const quantity = Number(line.quantity)
  return {
    ...line,
    unit: 'percent',
    quantity: Number.isFinite(quantity) ? String(quantity) : '0',
    unitPrice:
      !Number.isFinite(unitPrice) || unitPrice === 0
        ? String(defaultPercentUnitPrice(line.description))
        : String(unitPrice),
  }
}

export function QuoteDetailsPanel(props: QuoteDetailsPanelProps) {
  const { record, lineItemOptions, customFeatureOptions, isSaving, isApproving, isDeleting, onClose, onSave, onApprove, onComplete, onDelete } = props
  const [state, setState] = useState<EditableQuoteState>(() => toEditableState(record))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [summaryWasEdited, setSummaryWasEdited] = useState(false)
  const [assumptionsWereEdited, setAssumptionsWereEdited] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const isBusy = isSaving || isApproving || isDeleting || isCompleting
  const isReadOnly = record.status !== 'draft'
  const optionsById = useMemo(() => new Map(lineItemOptions.map((item) => [item.id, item])), [lineItemOptions])
  const parsedQuote = useMemo(() => toParsedQuote(state, record.quote), [record.quote, state])
  const clientPreviewQuote = parsedQuote ?? record.quote
  const syncAutoText = useCallback((summary: string, assumptions: string) => setState((current) => ({ ...current, summary, assumptions })), [])
  const autoText = useQuoteAutoTextSync({ lineItems: state.lineItems, customFields: state.customFields, summary: state.summary, assumptions: state.assumptions, summaryWasEdited, assumptionsWereEdited, onSync: syncAutoText })
  const hasChanges = useMemo(() => !!parsedQuote && serializeQuote(parsedQuote) !== serializeQuote(record.quote), [parsedQuote, record.quote])
  const canSave = hasChanges && !isBusy && !isReadOnly
  const totals = useMemo(() => {
    const lineTotals = computeLineTotals(state.lineItems.map((line) => ({ quantity: Number(line.quantity) || 0, unitPrice: Number(line.unitPrice) || 0, unit: line.unit })))
    const subtotalBase = lineTotals.reduce((sum, value) => sum + value, 0)
    const subtotal = Number.isFinite(clientPreviewQuote.subtotalBeforeVat) ? clientPreviewQuote.subtotalBeforeVat : subtotalBase
    const customAdjustment = Math.round((subtotal - subtotalBase) * 100) / 100
    const vatAmount = Number.isFinite(clientPreviewQuote.vatAmount) ? clientPreviewQuote.vatAmount : 0
    const total = Number.isFinite(clientPreviewQuote.estimatedPrice) ? clientPreviewQuote.estimatedPrice : subtotal + vatAmount
    return { lineTotals, subtotalBase, customAdjustment, subtotal, vatAmount, total }
  }, [clientPreviewQuote, state.lineItems])

  const withAutoPrice = (line: EditableLineItem): EditableLineItem => {
    const normalized = withPercentDefaults({ ...line, unit: normalizePercentUnit(line.unit) })
    if (isPercentLineUnit(normalized.unit)) return { ...normalized, autoPriced: false }
    if (!normalized.autoPriced || !normalized.sourceItemId) return normalized
    const option = optionsById.get(normalized.sourceItemId)
    if (!option) return normalized
    const estimated = estimateLineItemUnitPrice(option, Number(normalized.quantity))
    if (!Number.isFinite(estimated) || estimated <= 0) return normalized
    return { ...normalized, unitPrice: String(estimated) }
  }

  const setLine = (index: number, patch: Partial<EditableLineItem>) => setState((current) => ({
    ...current,
    lineItems: current.lineItems.map((line, idx) => {
      if (idx !== index) return line
      let nextPatch = patch
      if (typeof patch.description === 'string') {
        const option = findLineItemOptionByText(lineItemOptions, patch.description)
        nextPatch = option ? { ...nextPatch, sourceItemId: option.id, unit: option.unit, autoPriced: true } : line.sourceItemId ? { ...nextPatch, sourceItemId: null, autoPriced: false } : nextPatch
      }
      if (patch.unit !== undefined || patch.unitPrice !== undefined) {
        nextPatch = { ...nextPatch, autoPriced: false, sourceItemId: patch.unit ? null : nextPatch.sourceItemId }
      }
      return withAutoPrice({ ...line, ...nextPatch })
    }),
  }))

  const addLineItem = (option: ProviderLineItemOption | null, customLabel: string) => {
    const nextLine = emptyLineItem()
    if (!option) {
      nextLine.description = customLabel
      setState((current) => ({ ...current, lineItems: [...current.lineItems, nextLine] }))
      return
    }
    nextLine.description = option.canonicalName
    nextLine.sourceItemId = option.id
    nextLine.unit = normalizePercentUnit(option.unit)
    if (isPercentLineUnit(nextLine.unit)) {
      nextLine.quantity = '0'
      nextLine.unitPrice = String(defaultPercentUnitPrice(nextLine.description))
      nextLine.autoPriced = false
    } else {
      nextLine.quantity = '1'
      nextLine.autoPriced = true
      const estimated = estimateLineItemUnitPrice(option, 1)
      nextLine.unitPrice = estimated > 0 ? String(estimated) : '0'
    }
    setState((current) => {
      const existingIndex = current.lineItems.findIndex((line) => mergeLineByIdentity(line, nextLine))
      if (existingIndex < 0) return { ...current, lineItems: [...current.lineItems, nextLine] }
      return { ...current, lineItems: current.lineItems.map((line, index) => index === existingIndex ? withAutoPrice({ ...line, sourceItemId: line.sourceItemId ?? nextLine.sourceItemId, autoPriced: line.autoPriced || nextLine.autoPriced, quantity: String(Math.round(((Number(line.quantity) || 0) + (Number(nextLine.quantity) || 0)) * 100) / 100) }) : line) }
    })
  }

  const addCustomField = (feature: ProviderCustomFeatureOption | null, customLabel: string) => {
    const resolved = feature ?? findProviderCustomFeatureByText(customFeatureOptions, customLabel)
    setState((current) => {
      if (!resolved) {
        const label = customLabel.trim()
        if (!label || current.customFields.some((field) => isSameLabel(field.label, label))) return current
        return { ...current, customFields: [...current.customFields, { ...emptyCustomField(), label }] }
      }
      const mapped = toEditableCustomFieldFromFeature(resolved)
      const existingIndex = current.customFields.findIndex((field) => normalizeCustomFieldKey(field.key) === normalizeCustomFieldKey(mapped.key))
      if (existingIndex < 0) return { ...current, customFields: [...current.customFields, mapped] }
      return { ...current, customFields: current.customFields.map((field, index) => index === existingIndex ? { ...field, valueType: mapped.valueType, showInQuoteDetails: mapped.showInQuoteDetails, value: field.value.trim().length > 0 ? field.value : mapped.value } : field) }
    })
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isReadOnly) return
    if (!parsedQuote) {
      setErrorMessage('יש להזין לפחות שורת מחיר אחת עם ערכים תקינים.')
      return
    }
    if (!hasChanges) return
    setErrorMessage(null)
    await onSave(record.id, parsedQuote)
  }

  const handleDelete = async () => {
    if (window.confirm('למחוק את ההצעה?')) await onDelete(record.id)
  }

  const handleApprove = async () => {
    if (record.status !== 'draft') return
    if (hasChanges) {
      if (!parsedQuote) {
        setErrorMessage('יש לשמור שינויים תקינים לפני אישור ההצעה.')
        return
      }
      setErrorMessage(null)
      await onApprove(record.id, parsedQuote)
      return
    }
    setErrorMessage(null)
    await onApprove(record.id)
  }

  const handleComplete = async () => {
    setErrorMessage(null)
    setIsCompleting(true)
    try {
      await onComplete(record.id)
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <section className={record.clientRevisionPending ? 'quote-details-panel quote-details-panel-review' : 'quote-details-panel'}>
      <div className="quote-details-header">
        <h4>פרטי הצעה: {record.clientRequest.clientName || 'לקוח ללא שם'}</h4>
        <div className="quote-details-actions">
          <span className={`quote-status-badge ${record.status}`}>{quoteStatusLabel(record)}</span>
          <PrimaryButton type="button" disabled={isBusy} onClick={onClose}>סגור</PrimaryButton>
        </div>
      </div>
      <div className="quote-details-grid">
        <div className="quote-readonly-card">
          <strong>בקשת לקוח</strong><p>שם: {record.clientRequest.clientName}</p><p>אימייל: {record.clientRequest.clientEmail}</p>
          <p>דרישות: {record.clientRequest.requirements || 'ללא דרישות נוספות.'}</p><p>מקור: {QUOTE_SOURCE_LABEL[record.source]}</p>
          <p>נוצר: {new Date(record.createdAt).toLocaleString('he-IL')}</p><p>עודכן: {new Date(record.updatedAt).toLocaleString('he-IL')}</p>
          {record.clientRevisionPending ? <p className="quote-review-alert">הלקוח עדכן את ההצעה וממתין לאישור מחדש.</p> : null}
        </div>
        <QuoteDetailsForm
          record={record}
          state={state}
          isBusy={isBusy}
          isReadOnly={isReadOnly}
          isSaving={isSaving}
          isApproving={isApproving}
          isDeleting={isDeleting}
          isCompleting={isCompleting}
          canSave={canSave}
          hasChanges={hasChanges}
          errorMessage={errorMessage}
          totals={totals}
          autoSummary={autoText.summary}
          autoAssumptions={autoText.assumptions}
          lineItemOptions={lineItemOptions}
          customFeatureOptions={customFeatureOptions}
          onSave={handleSave}
          onSetVatRate={(value) => setState((current) => ({ ...current, vatRate: value }))}
          onToggleCpi={(enabled) => setState((current) => ({ ...current, cpiEnabled: enabled, lineItems: applyCpiFactorToLineItems(current.lineItems, enabled ? toFactor(current.cpiFactor) : 1 / toFactor(current.cpiFactor)) }))}
          onSetSummary={(value, isManual) => { setSummaryWasEdited(isManual); setState((current) => ({ ...current, summary: value })) }}
          onSetAssumptions={(value, isManual) => { setAssumptionsWereEdited(isManual); setState((current) => ({ ...current, assumptions: value })) }}
          onSetLine={setLine}
          onRemoveLine={(index) => setState((current) => ({ ...current, lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index) }))}
          onAddLineItem={addLineItem}
          onAddCustomField={addCustomField}
          onSetCustomField={(index, patch) => setState((current) => ({ ...current, customFields: current.customFields.map((field, idx) => idx === index ? { ...field, ...patch } : field) }))}
          onAddEmptyCustomField={() => setState((current) => ({ ...current, customFields: [...current.customFields, emptyCustomField()] }))}
          onRemoveCustomField={(index) => setState((current) => ({ ...current, customFields: current.customFields.filter((_, i) => i !== index) }))}
          onOpenPreview={() => setIsPreviewOpen(true)}
          onApprove={handleApprove}
          onDelete={handleDelete}
          onComplete={handleComplete}
        />
      </div>
      <QuotePreviewModal open={isPreviewOpen} quote={clientPreviewQuote} clientName={record.clientRequest.clientName} onClose={() => setIsPreviewOpen(false)} />
    </section>
  )
}
