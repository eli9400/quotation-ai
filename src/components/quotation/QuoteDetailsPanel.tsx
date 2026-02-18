import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Quote, QuoteLineItem, QuoteSource, StoredQuoteRecord } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
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

type EditableQuoteState = {
  lineItems: Array<{
    id: string
    sourceItemId: string | null
    description: string
    unit: string
    quantity: string
    unitPrice: string
  }>
  vatRate: string
  summary: string
  assumptions: string
}

const SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  learned: 'מודל נלמד',
  fallback: 'Fallback',
}

function toEditableState(record: StoredQuoteRecord): EditableQuoteState {
  return {
    lineItems: record.quote.lineItems.map((item) => ({
      id: item.id,
      sourceItemId: item.sourceItemId,
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
    vatRate: String(record.quote.vatRate),
    summary: record.quote.summary,
    assumptions: record.quote.assumptions.join('\n'),
  }
}

function toNumber(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function computeLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

function statusLabel(record: StoredQuoteRecord): string {
  return record.status === 'approved' ? 'מאושר' : 'טיוטה'
}

function parseQuote(state: EditableQuoteState, baseQuote: Quote): Quote | null {
  const vatRate = toNumber(state.vatRate)
  if (vatRate === null) {
    return null
  }

  const parsedItems: QuoteLineItem[] = state.lineItems
    .map((line) => {
      const quantity = toNumber(line.quantity)
      const unitPrice = toNumber(line.unitPrice)
      if (!line.description.trim() || quantity === null || unitPrice === null || quantity < 0 || unitPrice < 0) {
        return null
      }
      return {
        id: line.id || crypto.randomUUID(),
        sourceItemId: line.sourceItemId,
        description: line.description.trim(),
        unit: line.unit || 'custom',
        quantity,
        unitPrice,
        lineTotal: computeLineTotal(quantity, unitPrice),
      }
    })
    .filter((line): line is QuoteLineItem => line !== null)

  if (parsedItems.length === 0) {
    return null
  }

  const subtotalBeforeVat = parsedItems.reduce((sum, line) => sum + line.lineTotal, 0)
  const vatAmount = Math.round(((subtotalBeforeVat * vatRate) / 100) * 100) / 100
  const estimatedPrice = Math.round((subtotalBeforeVat + vatAmount) * 100) / 100
  const assumptions = state.assumptions
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return {
    ...baseQuote,
    lineItems: parsedItems,
    subtotalBeforeVat: Math.round(subtotalBeforeVat * 100) / 100,
    vatRate: Math.max(0, Math.min(40, vatRate)),
    vatAmount: Math.round(vatAmount * 100) / 100,
    estimatedPrice,
    estimatedDays: Math.max(1, Math.round(baseQuote.estimatedDays || 1)),
    confidence: Math.max(0, Math.min(100, Math.round(baseQuote.confidence || 0))),
    summary: state.summary.trim(),
    assumptions,
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
    const lineTotals = state.lineItems.map((line) => {
      const quantity = Number(line.quantity) || 0
      const unitPrice = Number(line.unitPrice) || 0
      return computeLineTotal(quantity, unitPrice)
    })
    const subtotal = lineTotals.reduce((sum, value) => sum + value, 0)
    const vatRate = Number(state.vatRate) || 0
    const vatAmount = Math.round(((subtotal * vatRate) / 100) * 100) / 100
    return {
      lineTotals,
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
    }
  }, [state.lineItems, state.vatRate])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedQuote = parseQuote(state, record.quote)
    if (!parsedQuote) {
      setErrorMessage('נא להזין רכיבי מחיר תקינים (תיאור, כמות, מחיר יחידה).')
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
          <p>מקור חישוב: {SOURCE_LABEL[record.source]}</p>
          <p>נוצר: {new Date(record.createdAt).toLocaleString('he-IL')}</p>
          <p>עודכן: {new Date(record.updatedAt).toLocaleString('he-IL')}</p>
          <p>אושר: {record.approvedAt ? new Date(record.approvedAt).toLocaleString('he-IL') : 'עדיין לא'}</p>
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
                    <td><input value={line.description} onChange={(event) => setState((c) => ({ ...c, lineItems: c.lineItems.map((item, i) => i === index ? { ...item, description: event.target.value } : item) }))} /></td>
                    <td><input value={line.unit} onChange={(event) => setState((c) => ({ ...c, lineItems: c.lineItems.map((item, i) => i === index ? { ...item, unit: event.target.value } : item) }))} /></td>
                    <td><input type="number" min={0} value={line.quantity} onChange={(event) => setState((c) => ({ ...c, lineItems: c.lineItems.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item) }))} /></td>
                    <td><input type="number" min={0} value={line.unitPrice} onChange={(event) => setState((c) => ({ ...c, lineItems: c.lineItems.map((item, i) => i === index ? { ...item, unitPrice: event.target.value } : item) }))} /></td>
                    <td>{formatCurrencyIls(totals.lineTotals[index] ?? 0)}</td>
                    <td><button type="button" className="quote-line-remove" onClick={() => setState((c) => ({ ...c, lineItems: c.lineItems.filter((_, i) => i !== index) }))}>הסר</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="quote-line-add" onClick={() => setState((c) => ({ ...c, lineItems: [...c.lineItems, { id: crypto.randomUUID(), sourceItemId: null, description: '', unit: 'custom', quantity: '0', unitPrice: '0' }] }))}>הוסף רכיב</button>

          <div className="quote-totals">
            <label>מע"מ (%)<input type="number" min={0} max={40} value={state.vatRate} onChange={(event) => setState((c) => ({ ...c, vatRate: event.target.value }))} /></label>
            <p>סכום ביניים: {formatCurrencyIls(totals.subtotal)}</p>
            <p>מע"מ: {formatCurrencyIls(totals.vatAmount)}</p>
            <p><strong>סה"כ להצעה: {formatCurrencyIls(totals.total)}</strong></p>
          </div>
          <label>סיכום חישוב<textarea rows={2} value={state.summary} onChange={(event) => setState((c) => ({ ...c, summary: event.target.value }))} /></label>
          <label>הנחות חישוב<textarea rows={3} value={state.assumptions} onChange={(event) => setState((c) => ({ ...c, assumptions: event.target.value }))} /></label>

          <div className="quote-edit-actions">
            <PrimaryButton type="submit" disabled={isSaving || isApproving || isDeleting}>{isSaving ? 'שומר...' : 'שמור שינויים'}</PrimaryButton>
            <PrimaryButton type="button" disabled={isSaving || isApproving || isDeleting || record.status === 'approved'} onClick={() => onApprove(record.id)}>
              {record.status === 'approved' ? 'הצעה אושרה' : isApproving ? 'מאשר...' : 'אשר הצעה'}
            </PrimaryButton>
            <button
              type="button"
              className="quote-line-remove"
              disabled={isSaving || isApproving || isDeleting}
              onClick={async () => {
                if (!window.confirm('למחוק את ההצעה הזו?')) {
                  return
                }
                await onDelete(record.id)
              }}
            >
              {isDeleting ? 'מוחק...' : 'מחק הצעה'}
            </button>
          </div>

          {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
        </form>
      </div>
    </section>
  )
}
