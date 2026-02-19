import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Quote, QuoteSource, StoredQuoteRecord } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { QuoteClientViewPreview } from './QuoteClientViewPreview'
import { QuoteCustomFieldsEditor, type EditableCustomField } from './QuoteCustomFieldsEditor'
import {
  applyCpiFactorToLineItems,
  computeLineTotal,
  toEditableState,
  toParsedQuote,
  type EditableLineItem,
  type EditableQuoteState,
} from './quoteDetailsUtils'
import { PrimaryButton } from '../ui/PrimaryButton'

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

const SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  learned: 'מודל נלמד',
  fallback: 'Fallback',
}

function statusLabel(record: StoredQuoteRecord): string {
  return record.status === 'approved' ? 'מאושר' : 'טיוטה'
}

function toFactor(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return parsed
}

function emptyLineItem(): EditableLineItem {
  return {
    id: crypto.randomUUID(),
    sourceItemId: null,
    description: '',
    unit: 'custom',
    quantity: '0',
    unitPrice: '0',
  }
}

function emptyCustomField(): EditableCustomField {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    valueType: 'text',
    value: '',
    showInQuoteDetails: false,
  }
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

  useEffect(() => {
    setState(toEditableState(record))
    setErrorMessage(null)
  }, [record])

  const totals = useMemo(() => {
    const lineTotals = state.lineItems.map((line) =>
      computeLineTotal(Number(line.quantity) || 0, Number(line.unitPrice) || 0),
    )
    const subtotal = lineTotals.reduce((sum, value) => sum + value, 0)
    const vatAmount = Math.round(((subtotal * (Number(state.vatRate) || 0)) / 100) * 100) / 100
    return { lineTotals, subtotal, vatAmount, total: subtotal + vatAmount }
  }, [state.lineItems, state.vatRate])

  const clientPreviewQuote = useMemo(
    () => toParsedQuote(state, record.quote) ?? record.quote,
    [record.quote, state],
  )

  const setLine = (index: number, patch: Partial<EditableLineItem>) => {
    setState((current) => ({
      ...current,
      lineItems: current.lineItems.map((line, idx) => (idx === index ? { ...line, ...patch } : line)),
    }))
  }

  const setCustomField = (index: number, patch: Partial<EditableCustomField>) => {
    setState((current) => ({
      ...current,
      customFields: current.customFields.map((field, idx) => (idx === index ? { ...field, ...patch } : field)),
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

  const handleCpiFactorChange = (nextFactorRaw: string) => {
    setState((current) => {
      const previousFactor = toFactor(current.cpiFactor)
      const nextFactor = toFactor(nextFactorRaw)
      if (!current.cpiEnabled || previousFactor === nextFactor) {
        return { ...current, cpiFactor: nextFactorRaw }
      }
      return {
        ...current,
        cpiFactor: nextFactorRaw,
        lineItems: applyCpiFactorToLineItems(current.lineItems, nextFactor / previousFactor),
      }
    })
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const quote = toParsedQuote(state, record.quote)
    if (!quote) {
      setErrorMessage('נא להזין שורות מחיר וערכי מדד תקינים.')
      return
    }
    setErrorMessage(null)
    await onSave(record.id, quote)
  }

  return (
    <section className="quote-details-panel">
      <div className="quote-details-header">
        <h4>פרטי הצעה: {record.clientRequest.clientName || 'לקוח ללא שם'}</h4>
        <div className="quote-details-actions">
          <span className={`quote-status-badge ${record.status}`}>{statusLabel(record)}</span>
          <PrimaryButton type="button" disabled={isSaving || isApproving || isDeleting} onClick={onClose}>סגור</PrimaryButton>
        </div>
      </div>

      <div className="quote-details-grid">
        <div className="quote-readonly-card">
          <strong>בקשת לקוח</strong>
          <p>שם: {record.clientRequest.clientName}</p>
          <p>אימייל: {record.clientRequest.clientEmail}</p>
          <p>דרישות: {record.clientRequest.requirements || 'ללא דרישות נוספות.'}</p>
          <p>מקור: {SOURCE_LABEL[record.source]}</p>
          <p>נוצר: {new Date(record.createdAt).toLocaleString('he-IL')}</p>
          <p>עודכן: {new Date(record.updatedAt).toLocaleString('he-IL')}</p>
        </div>

        <form className="quote-edit-form" onSubmit={handleSave}>
          <div className="quote-lines-table-wrap">
            <table className="quote-lines-table">
              <thead>
                <tr><th>תיאור</th><th>יחידה</th><th>כמות</th><th>מחיר יחידה</th><th>סה"כ</th><th></th></tr>
              </thead>
              <tbody>
                {state.lineItems.map((line, index) => (
                  <tr key={line.id}>
                    <td><input value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} /></td>
                    <td><input value={line.unit} onChange={(event) => setLine(index, { unit: event.target.value })} /></td>
                    <td><input type="number" min={0} value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} /></td>
                    <td><input type="number" min={0} value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })} /></td>
                    <td>{formatCurrencyIls(totals.lineTotals[index] ?? 0)}</td>
                    <td><button type="button" className="quote-line-remove" onClick={() => setState((c) => ({ ...c, lineItems: c.lineItems.filter((_, i) => i !== index) }))}>הסר</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="quote-line-add" onClick={() => setState((c) => ({ ...c, lineItems: [...c.lineItems, emptyLineItem()] }))}>הוסף רכיב</button>
          <div className="quote-totals">
            <label>מע"מ (%)<input type="number" min={0} max={40} value={state.vatRate} onChange={(event) => setState((c) => ({ ...c, vatRate: event.target.value }))} /></label>
            <label>מקדם מדד<input type="number" min={0.5} step={0.0001} value={state.cpiFactor} onChange={(event) => handleCpiFactorChange(event.target.value)} /></label>
            <label className="quote-cpi-toggle"><input type="checkbox" checked={state.cpiEnabled} onChange={(event) => handleCpiEnabledChange(event.target.checked)} /><span>החל מדד בחישוב</span></label>
            {state.cpiSourceYear || state.cpiTargetYear ? <p className="quote-cpi-caption">שנת בסיס: {state.cpiSourceYear ?? '-'} | שנת יעד: {state.cpiTargetYear ?? '-'}</p> : null}
            <p>סכום ביניים: {formatCurrencyIls(totals.subtotal)}</p>
            <p>מע"מ: {formatCurrencyIls(totals.vatAmount)}</p>
            <p><strong>סה"כ: {formatCurrencyIls(totals.total)}</strong></p>
          </div>

          <label>סיכום<textarea rows={2} value={state.summary} onChange={(event) => setState((c) => ({ ...c, summary: event.target.value }))} /></label>
          <label>הנחות<textarea rows={3} value={state.assumptions} onChange={(event) => setState((c) => ({ ...c, assumptions: event.target.value }))} /></label>

          <QuoteCustomFieldsEditor
            fields={state.customFields}
            onChange={setCustomField}
            onAdd={() => setState((c) => ({ ...c, customFields: [...c.customFields, emptyCustomField()] }))}
            onRemove={(index) => setState((c) => ({ ...c, customFields: c.customFields.filter((_, i) => i !== index) }))}
          />

          <QuoteClientViewPreview quote={clientPreviewQuote} />

          <div className="quote-edit-actions">
            <PrimaryButton type="submit" disabled={isSaving || isApproving || isDeleting}>{isSaving ? 'שומר...' : 'שמור שינויים'}</PrimaryButton>
            <PrimaryButton type="button" disabled={isSaving || isApproving || isDeleting || record.status === 'approved'} onClick={() => onApprove(record.id)}>{record.status === 'approved' ? 'הצעה אושרה' : isApproving ? 'מאשר...' : 'אשר הצעה'}</PrimaryButton>
            <button type="button" className="quote-line-remove" disabled={isSaving || isApproving || isDeleting} onClick={async () => { if (window.confirm('למחוק את ההצעה?')) await onDelete(record.id) }}>{isDeleting ? 'מוחק...' : 'מחק הצעה'}</button>
          </div>

          {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
        </form>
      </div>
    </section>
  )
}
