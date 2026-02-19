import { useMemo, useState, type FormEvent } from 'react'
import type { Quote, StoredQuoteRecord } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { PrimaryButton } from '../ui/PrimaryButton'
import { QuoteClientViewPreview } from './QuoteClientViewPreview'
import { QuoteCustomFieldsEditor, type EditableCustomField } from './QuoteCustomFieldsEditor'
import {
  emptyCustomField,
  emptyLineItem,
  QUOTE_SOURCE_LABEL,
  quoteStatusLabel,
  QUOTE_UNIT_OPTIONS,
  serializeQuote,
  toFactor,
} from './quoteDetailsPanelHelpers'
import { computeLineTotals } from './quoteLineMath'
import {
  applyCpiFactorToLineItems,
  toEditableState,
  toParsedQuote,
  type EditableLineItem,
  type EditableQuoteState,
} from './quoteDetailsUtils'

type QuoteDetailsPanelProps = {
  record: StoredQuoteRecord
  isSaving: boolean
  isApproving: boolean
  isDeleting: boolean
  onClose: () => void
  onSave: (quoteId: string, quote: Quote) => Promise<void>
  onApprove: (quoteId: string) => Promise<void>
  onDelete: (quoteId: string) => Promise<void>
}

export function QuoteDetailsPanel({
  record,
  isSaving,
  isApproving,
  isDeleting,
  onClose,
  onSave,
  onApprove,
  onDelete,
}: QuoteDetailsPanelProps) {
  const [state, setState] = useState<EditableQuoteState>(() => toEditableState(record))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const parsedQuote = useMemo(() => toParsedQuote(state, record.quote), [state, record.quote])
  const clientPreviewQuote = parsedQuote ?? record.quote

  const totals = useMemo(() => {
    const lineTotals = computeLineTotals(
      state.lineItems.map((line) => ({
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        unit: line.unit,
      })),
    )
    const subtotalBase = lineTotals.reduce((sum, value) => sum + value, 0)
    const subtotal = Number.isFinite(clientPreviewQuote.subtotalBeforeVat)
      ? clientPreviewQuote.subtotalBeforeVat
      : subtotalBase
    const customAdjustment = Math.round((subtotal - subtotalBase) * 100) / 100
    const vatAmount = Number.isFinite(clientPreviewQuote.vatAmount) ? clientPreviewQuote.vatAmount : 0
    const total = Number.isFinite(clientPreviewQuote.estimatedPrice)
      ? clientPreviewQuote.estimatedPrice
      : subtotal + vatAmount
    return { lineTotals, subtotalBase, customAdjustment, subtotal, vatAmount, total }
  }, [clientPreviewQuote, state.lineItems])

  const hasChanges = useMemo(() => {
    if (!parsedQuote) {
      return false
    }
    return serializeQuote(parsedQuote) !== serializeQuote(record.quote)
  }, [parsedQuote, record.quote])

  const canSave = hasChanges && !isSaving && !isApproving && !isDeleting

  const setLine = (index: number, patch: Partial<EditableLineItem>) => {
    setState((current) => ({
      ...current,
      lineItems: current.lineItems.map((line, idx) =>
        idx === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const setCustomField = (index: number, patch: Partial<EditableCustomField>) => {
    setState((current) => ({
      ...current,
      customFields: current.customFields.map((field, idx) =>
        idx === index ? { ...field, ...patch } : field,
      ),
    }))
  }

  const handleCpiEnabledChange = (enabled: boolean) => {
    setState((current) => {
      const factor = toFactor(current.cpiFactor)
      if (enabled === current.cpiEnabled || factor === 1) {
        return { ...current, cpiEnabled: enabled }
      }
      const ratio = enabled ? factor : 1 / factor
      return {
        ...current,
        cpiEnabled: enabled,
        lineItems: applyCpiFactorToLineItems(current.lineItems, ratio),
      }
    })
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parsedQuote) {
      setErrorMessage('נא להזין שורות מחיר וערכים תקינים.')
      return
    }
    if (!hasChanges) {
      return
    }
    setErrorMessage(null)
    await onSave(record.id, parsedQuote)
  }

  return (
    <section className="quote-details-panel">
      <div className="quote-details-header">
        <h4>פרטי הצעה: {record.clientRequest.clientName || 'לקוח ללא שם'}</h4>
        <div className="quote-details-actions">
          <span className={`quote-status-badge ${record.status}`}>{quoteStatusLabel(record)}</span>
          <PrimaryButton type="button" disabled={isSaving || isApproving || isDeleting} onClick={onClose}>
            סגור
          </PrimaryButton>
        </div>
      </div>

      <div className="quote-details-grid">
        <div className="quote-readonly-card">
          <strong>בקשת לקוח</strong>
          <p>שם: {record.clientRequest.clientName}</p>
          <p>אימייל: {record.clientRequest.clientEmail}</p>
          <p>דרישות: {record.clientRequest.requirements || 'ללא דרישות נוספות.'}</p>
          <p>מקור: {QUOTE_SOURCE_LABEL[record.source]}</p>
          <p>נוצר: {new Date(record.createdAt).toLocaleString('he-IL')}</p>
          <p>עודכן: {new Date(record.updatedAt).toLocaleString('he-IL')}</p>
        </div>

        <form className="quote-edit-form" onSubmit={handleSave}>
          <div className="quote-lines-table-wrap">
            <table className="quote-lines-table">
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>יחידה</th>
                  <th>כמות</th>
                  <th>מחיר יחידה</th>
                  <th>סה"כ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.lineItems.map((line, index) => (
                  <tr key={line.id}>
                    <td><input value={line.description} onChange={(e) => setLine(index, { description: e.target.value })} /></td>
                    <td>
                      <select value={line.unit} onChange={(e) => setLine(index, { unit: e.target.value })}>
                        {!QUOTE_UNIT_OPTIONS.some((option) => option.value === line.unit) ? (
                          <option value={line.unit}>{line.unit || 'מותאם אישית'}</option>
                        ) : null}
                        {QUOTE_UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={line.unit === 'percent' || line.unit === '%' ? undefined : 0}
                        value={line.quantity}
                        onChange={(e) => setLine(index, { quantity: e.target.value })}
                      />
                    </td>
                    <td><input type="number" value={line.unitPrice} onChange={(e) => setLine(index, { unitPrice: e.target.value })} /></td>
                    <td>{formatCurrencyIls(totals.lineTotals[index] ?? 0)}</td>
                    <td><button type="button" className="quote-line-remove" onClick={() => setState((c) => ({ ...c, lineItems: c.lineItems.filter((_, i) => i !== index) }))}>הסר</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="quote-cpi-caption">יחידה אחוז מחושבת מתוך סכום השורות הרגילות.</p>

          <button type="button" className="quote-line-add" onClick={() => setState((c) => ({ ...c, lineItems: [...c.lineItems, emptyLineItem()] }))}>
            הוסף רכיב
          </button>

          <div className="quote-totals">
            <label>מע"מ (%)<input type="number" min={0} max={40} value={state.vatRate} onChange={(e) => setState((c) => ({ ...c, vatRate: e.target.value }))} /></label>
            <label className="quote-cpi-toggle"><input type="checkbox" checked={state.cpiEnabled} onChange={(e) => handleCpiEnabledChange(e.target.checked)} /><span>החל מדד בחישוב</span></label>
            <p className="quote-cpi-caption">מקדם מדד אוטומטי: {toFactor(state.cpiFactor).toFixed(4)}</p>
            {state.cpiSourceYear || state.cpiTargetYear ? <p className="quote-cpi-caption">שנת בסיס: {state.cpiSourceYear ?? '-'} | שנת יעד: {state.cpiTargetYear ?? '-'}</p> : null}
            <p>סכום שורות: {formatCurrencyIls(totals.subtotalBase)}</p>
            {Math.abs(totals.customAdjustment) > 0.01 ? <p>תוספת/הפחתת שדות דינמיים: {formatCurrencyIls(totals.customAdjustment)}</p> : null}
            <p>סכום ביניים: {formatCurrencyIls(totals.subtotal)}</p>
            <p>מע"מ: {formatCurrencyIls(totals.vatAmount)}</p>
            <p><strong>סה"כ: {formatCurrencyIls(totals.total)}</strong></p>
          </div>

          <label>סיכום<textarea rows={2} value={state.summary} placeholder="כתוב כאן תקציר להצעה: מה כלול ומה לא כלול." onChange={(e) => setState((c) => ({ ...c, summary: e.target.value }))} /></label>
          <label>הנחות<textarea rows={3} value={state.assumptions} placeholder="כתוב כאן הנחות עבודה, תנאי תשלום והערות מיוחדות." onChange={(e) => setState((c) => ({ ...c, assumptions: e.target.value }))} /></label>

          <QuoteCustomFieldsEditor
            fields={state.customFields}
            onChange={setCustomField}
            onAdd={() => setState((c) => ({ ...c, customFields: [...c.customFields, emptyCustomField()] }))}
            onRemove={(index) => setState((c) => ({ ...c, customFields: c.customFields.filter((_, i) => i !== index) }))}
          />

          <QuoteClientViewPreview quote={clientPreviewQuote} />

          <div className="quote-edit-actions">
            <PrimaryButton type="submit" disabled={!canSave}>{isSaving ? 'שומר...' : 'שמור שינויים'}</PrimaryButton>
            <PrimaryButton type="button" disabled={isSaving || isApproving || isDeleting || record.status === 'approved'} onClick={() => onApprove(record.id)}>{record.status === 'approved' ? 'הצעה אושרה' : isApproving ? 'מאשר...' : 'אשר הצעה'}</PrimaryButton>
            <button type="button" className="quote-line-remove" disabled={isSaving || isApproving || isDeleting} onClick={async () => { if (window.confirm('למחוק את ההצעה?')) await onDelete(record.id) }}>{isDeleting ? 'מוחק...' : 'מחק הצעה'}</button>
          </div>

          {!hasChanges ? <p className="quote-cpi-caption">אין שינויים לשמירה.</p> : null}
          {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
        </form>
      </div>
    </section>
  )
}
