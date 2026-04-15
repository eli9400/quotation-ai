import { useMemo, useState } from 'react'
import type { Quote, QuoteLineItem, StoredQuoteRecord } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { QuotePreviewModal } from '../quotation/QuotePreviewModal'
import { computeCustomFieldsAdjustment } from '../quotation/quoteCustomFieldMath'
import { computeLineTotals } from '../quotation/quoteLineMath'
import { toUnitLabel } from '../quotation/unitLabels'
import { PrimaryButton } from '../ui/PrimaryButton'

type ClientQuotesPanelProps = {
  records: StoredQuoteRecord[]
  isLoading: boolean
  isSubmittingRevision: boolean
  onRefresh: () => Promise<void>
  onSubmitRevision: (quoteId: string, quote: Quote) => Promise<void>
}

type ClientQuoteStatusFilter = 'pending' | 'all' | 'approved' | 'completed'

const CLIENT_EDITABLE_UNITS: Array<{ value: string; label: string }> = [
  { value: 'custom', label: 'מותאם' },
  { value: 'sqm', label: 'מ"ר' },
  { value: 'unit', label: 'יחידה' },
  { value: 'point', label: 'יחידה (ביקור)' },
  { value: 'day', label: 'יום' },
  { value: 'hour', label: 'שעה' },
  { value: 'meter', label: 'מטר' },
  { value: 'container', label: 'מכולה' },
  { value: 'package', label: 'קומפלט' },
  { value: 'percent', label: 'אחוז (%)' },
]

function isPendingApproval(record: StoredQuoteRecord): boolean {
  return record.status === 'draft' || record.clientRevisionPending
}

function statusLabel(record: StoredQuoteRecord): string {
  if (record.clientRevisionPending) return 'מחכה לאישור נותן שירות'
  if (record.status === 'completed') return 'בוצעה'
  if (record.status === 'approved') return 'אושרה'
  return 'בטיפול נותן שירות'
}

function toRevisionQuote(base: Quote, lineItems: QuoteLineItem[]): Quote {
  const normalizedItems = lineItems.map((line) => ({
    ...line,
    quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
  }))

  const totals = computeLineTotals(
    normalizedItems.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unit: line.unit,
    })),
  )

  const withTotals = normalizedItems.map((line, index) => ({
    ...line,
    lineTotal: totals[index] ?? 0,
  }))

  const lineSubtotal = withTotals.reduce((sum, line) => sum + line.lineTotal, 0)
  const customAdjustment = computeCustomFieldsAdjustment(base.customFields, lineSubtotal)
  const subtotalBeforeVat = Math.max(0, lineSubtotal + customAdjustment)
  const vatAmount = Math.round(((subtotalBeforeVat * base.vatRate) / 100) * 100) / 100
  const estimatedPrice = Math.round((subtotalBeforeVat + vatAmount) * 100) / 100

  return {
    ...base,
    lineItems: withTotals,
    subtotalBeforeVat,
    vatAmount,
    estimatedPrice,
  }
}

function cloneQuote(quote: Quote): Quote {
  return {
    ...quote,
    lineItems: quote.lineItems.map((line) => ({ ...line })),
    customFields: quote.customFields.map((field) => ({ ...field })),
    assumptions: [...quote.assumptions],
  }
}

export function ClientQuotesPanel({
  records,
  isLoading,
  isSubmittingRevision,
  onRefresh,
  onSubmitRevision,
}: ClientQuotesPanelProps) {
  const [statusFilter, setStatusFilter] = useState<ClientQuoteStatusFilter>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftQuote, setDraftQuote] = useState<Quote | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records
    if (statusFilter === 'approved') {
      return records.filter((record) => record.status === 'approved' && !record.clientRevisionPending)
    }
    if (statusFilter === 'completed') {
      return records.filter((record) => record.status === 'completed')
    }
    return records.filter(isPendingApproval)
  }, [records, statusFilter])

  const selected = useMemo(
    () => filteredRecords.find((record) => record.id === selectedId) ?? null,
    [filteredRecords, selectedId],
  )

  const revisionAllowed = selected?.status === 'approved' && draftQuote !== null

  const openQuote = (record: StoredQuoteRecord) => {
    setSelectedId(record.id)
    setDraftQuote(record.status === 'approved' ? cloneQuote(record.quote) : null)
  }

  const updateLine = (lineId: string, patch: Partial<QuoteLineItem>) => {
    if (!draftQuote) return
    const nextLines = draftQuote.lineItems.map((line) =>
      line.id === lineId ? { ...line, ...patch } : line,
    )
    setDraftQuote(toRevisionQuote(draftQuote, nextLines))
  }

  const handleSubmitRevision = async () => {
    if (!selected || !draftQuote || !revisionAllowed) return
    await onSubmitRevision(selected.id, draftQuote)
  }

  return (
    <section className="client-quotes-panel">
      <div className="client-quotes-header">
        <h3>ההצעות שלי</h3>
        <PrimaryButton
          type="button"
          disabled={isLoading || isSubmittingRevision}
          onClick={() => void onRefresh()}
        >
          {isLoading ? 'מרענן...' : 'רענון רשימה'}
        </PrimaryButton>
      </div>

      {records.length > 0 ? (
        <div className="quotes-filters">
          <label>
            סינון סטטוס
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ClientQuoteStatusFilter)}
            >
              <option value="pending">ממתין לאישור</option>
              <option value="all">הכל</option>
              <option value="approved">מאושר</option>
              <option value="completed">בוצע</option>
            </select>
          </label>
        </div>
      ) : null}

      {records.length === 0 ? (
        <p className="auth-status">עדיין אין הצעות מחיר שנשלחו ללקוח זה.</p>
      ) : filteredRecords.length === 0 ? (
        <p className="auth-status">אין הצעות להצגה עבור הסינון שנבחר.</p>
      ) : (
        <div className="quotes-table-wrap">
          <table className="quotes-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>סטטוס</th>
                <th>סה"כ</th>
                <th>פעולה</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className={record.id === selectedId ? 'quote-row active' : 'quote-row'}>
                  <td>{new Date(record.createdAt).toLocaleString('he-IL')}</td>
                  <td>{statusLabel(record)}</td>
                  <td>
                    {record.status === 'approved' || record.status === 'completed'
                      ? formatCurrencyIls(record.quote.estimatedPrice)
                      : 'ממתין לאישור'}
                  </td>
                  <td>
                    <button type="button" className="quote-line-add" onClick={() => openQuote(record)}>
                      פרטים
                    </button>
                    {record.status === 'approved' ? (
                      <button
                        type="button"
                        className="quote-line-add"
                        onClick={() => {
                          openQuote(record)
                          setIsPreviewOpen(true)
                        }}
                      >
                        PDF
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="client-selected-quote">
          <h4>הצעה נבחרת</h4>
          <p>סטטוס: {statusLabel(selected)}</p>
          {selected.status === 'approved' ? (
            <>
              <p className="quote-cpi-caption">ניתן לערוך כמויות בלבד. מחיר יחידה נקבע על ידי נותן השירות.</p>
              <div className="quote-lines-table-wrap">
                <table className="quote-lines-table">
                  <thead>
                    <tr>
                      <th>תיאור</th>
                      <th>יחידה</th>
                      <th>כמות</th>
                      <th>מחיר יחידה</th>
                      <th>סה"כ שורה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draftQuote ?? selected.quote).lineItems.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="text"
                            value={line.description}
                            disabled={isSubmittingRevision}
                            onChange={(event) => updateLine(line.id, { description: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            value={line.unit}
                            disabled={isSubmittingRevision}
                            onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                          >
                            {!CLIENT_EDITABLE_UNITS.some((option) => option.value === line.unit) ? (
                              <option value={line.unit}>{toUnitLabel(line.unit)}</option>
                            ) : null}
                            {CLIENT_EDITABLE_UNITS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={line.quantity}
                            disabled={isSubmittingRevision}
                            onChange={(event) => {
                              const quantity = Number(event.target.value)
                              if (!Number.isFinite(quantity) || quantity < 0) return
                              updateLine(line.id, { quantity })
                            }}
                          />
                        </td>
                        <td>{formatCurrencyIls(line.unitPrice)}</td>
                        <td>{formatCurrencyIls(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>סכום ביניים: {formatCurrencyIls((draftQuote ?? selected.quote).subtotalBeforeVat)}</p>
              <p>מע"מ: {formatCurrencyIls((draftQuote ?? selected.quote).vatAmount)}</p>
              <p>
                <strong>סה"כ: {formatCurrencyIls((draftQuote ?? selected.quote).estimatedPrice)}</strong>
              </p>
              <div className="auth-actions-row">
                <PrimaryButton type="button" disabled={isSubmittingRevision} onClick={() => setIsPreviewOpen(true)}>
                  תצוגת PDF
                </PrimaryButton>
                <PrimaryButton
                  type="button"
                  disabled={isSubmittingRevision || !revisionAllowed}
                  onClick={() => void handleSubmitRevision()}
                >
                  {isSubmittingRevision ? 'שולח...' : 'שליחה לאישור נותן שירות'}
                </PrimaryButton>
              </div>
            </>
          ) : (
            <p className="quote-cpi-caption">הצעה זו אינה פתוחה לעריכת לקוח כרגע.</p>
          )}
        </div>
      ) : null}

      {selected ? (
        <QuotePreviewModal
          open={isPreviewOpen}
          quote={draftQuote ?? selected.quote}
          clientName={selected.clientRequest.clientName}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </section>
  )
}
