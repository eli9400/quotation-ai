import { useEffect, useMemo, useState } from 'react'
import {
  getProviderCustomFeatureOptions,
  getProviderLineItemOptions,
} from '../../services/api/modelApi'
import {
  approveQuoteRecord,
  completeQuoteRecord,
  deleteQuoteRecord,
  updateQuoteRecord,
} from '../../services/api/providerQuotesApi'
import type {
  ProviderCustomFeatureOption,
  ProviderLineItemOption,
  Quote,
  QuoteSource,
  StoredQuoteRecord,
} from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { Panel } from '../ui/Panel'
import { QuoteDetailsPanel } from './QuoteDetailsPanel'

type QuotesHistoryPanelProps = {
  authToken: string | null
  records: StoredQuoteRecord[]
  isLoading: boolean
}

type StatusFilter = 'all' | 'draft' | 'approved' | 'completed'

const SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  learned: 'מודל נלמד',
  fallback: 'Fallback',
}

const STATUS_LABEL: Record<StatusFilter | StoredQuoteRecord['status'], string> = {
  all: 'כל הסטטוסים',
  draft: 'מחכה לאישור',
  approved: 'אושרה',
  completed: 'בוצעה',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return 'עדכון ההצעה נכשל.'
}

function inDateRange(record: StoredQuoteRecord, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true
  const created = new Date(record.createdAt)
  if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false
  if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false
  return true
}

function rowClassName(record: StoredQuoteRecord, selectedId: string | null): string {
  const classes = ['quote-row']
  if (record.id === selectedId) classes.push('active')
  if (record.clientRevisionPending) classes.push('needs-review')
  return classes.join(' ')
}

export function QuotesHistoryPanel({ authToken, records, isLoading }: QuotesHistoryPanelProps) {
  const [localRecords, setLocalRecords] = useState<StoredQuoteRecord[]>(records)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lineItemOptions, setLineItemOptions] = useState<ProviderLineItemOption[]>([])
  const [customFeatureOptions, setCustomFeatureOptions] = useState<ProviderCustomFeatureOption[]>([])

  useEffect(() => setLocalRecords(records), [records])

  useEffect(() => {
    if (!selectedId) return
    if (!localRecords.some((record) => record.id === selectedId)) setSelectedId(null)
  }, [localRecords, selectedId])

  useEffect(() => {
    if (!authToken) {
      setLineItemOptions([])
      setCustomFeatureOptions([])
      return
    }
    let cancelled = false
    Promise.all([getProviderLineItemOptions(authToken), getProviderCustomFeatureOptions(authToken)])
      .then(([items, features]) => {
        if (cancelled) return
        setLineItemOptions(items)
        setCustomFeatureOptions(features)
      })
      .catch(() => {
        if (cancelled) return
        setLineItemOptions([])
        setCustomFeatureOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [authToken])

  const selectedRecord = useMemo(() => localRecords.find((record) => record.id === selectedId) ?? null, [localRecords, selectedId])
  const filteredRecords = useMemo(() => {
    return localRecords.filter((record) => {
      const statusOk = statusFilter === 'all' ? true : record.status === statusFilter
      return statusOk && inDateRange(record, dateFrom, dateTo)
    })
  }, [localRecords, statusFilter, dateFrom, dateTo])

  const updateLocalRecord = (nextRecord: StoredQuoteRecord) => {
    setLocalRecords((current) => current.map((record) => (record.id === nextRecord.id ? nextRecord : record)))
  }

  const withAuth = (message: string): string | null => (!authToken ? message : null)

  const handleSave = async (quoteId: string, quote: Quote) => {
    const noAuthMessage = withAuth('נדרש להתחבר מחדש כדי לערוך הצעה.')
    if (noAuthMessage) return setErrorMessage(noAuthMessage)
    setErrorMessage(null)
    setIsSaving(true)
    try {
      updateLocalRecord(await updateQuoteRecord(authToken as string, quoteId, quote))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async (quoteId: string) => {
    const noAuthMessage = withAuth('נדרש להתחבר מחדש כדי לאשר הצעה.')
    if (noAuthMessage) return setErrorMessage(noAuthMessage)
    setErrorMessage(null)
    setIsApproving(true)
    try {
      updateLocalRecord(await approveQuoteRecord(authToken as string, quoteId))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsApproving(false)
    }
  }

  const handleComplete = async (quoteId: string) => {
    const noAuthMessage = withAuth('נדרש להתחבר מחדש כדי לסמן עבודה שבוצעה.')
    if (noAuthMessage) return setErrorMessage(noAuthMessage)
    setErrorMessage(null)
    setIsCompleting(true)
    try {
      updateLocalRecord(await completeQuoteRecord(authToken as string, quoteId))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDelete = async (quoteId: string) => {
    const noAuthMessage = withAuth('נדרש להתחבר מחדש כדי למחוק הצעה.')
    if (noAuthMessage) return setErrorMessage(noAuthMessage)
    setErrorMessage(null)
    setIsDeleting(true)
    try {
      const deletedId = await deleteQuoteRecord(authToken as string, quoteId)
      setLocalRecords((current) => current.filter((record) => record.id !== deletedId))
      if (selectedId === deletedId) setSelectedId(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <Panel title="טבלת לקוחות והצעות"><p className="empty">טוען הצעות קיימות...</p></Panel>
  }

  return (
    <Panel title="טבלת לקוחות והצעות">
      <div className="quotes-filters">
        <label>סטטוס
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">{STATUS_LABEL.all}</option>
            <option value="draft">{STATUS_LABEL.draft}</option>
            <option value="approved">{STATUS_LABEL.approved}</option>
            <option value="completed">{STATUS_LABEL.completed}</option>
          </select>
        </label>
        <label>מתאריך<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>עד תאריך<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      </div>

      {filteredRecords.length === 0 ? (
        <p className="empty">אין הצעות לפי הסינון שנבחר.</p>
      ) : (
        <div className="quotes-table-wrap">
          <table className="quotes-table">
            <thead><tr><th>לקוח</th><th>אימייל</th><th>מחיר</th><th>מקור</th><th>סטטוס</th><th>נוצר</th></tr></thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className={rowClassName(record, selectedId)} onClick={() => { setSelectedId(record.id); setErrorMessage(null) }}>
                  <td>{record.clientRequest.clientName || 'לקוח ללא שם'}</td>
                  <td>{record.clientRequest.clientEmail || '-'}</td>
                  <td>{formatCurrencyIls(record.quote.estimatedPrice)}</td>
                  <td>{SOURCE_LABEL[record.source]}</td>
                  <td>{STATUS_LABEL[record.status]}</td>
                  <td>{new Date(record.createdAt).toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRecord ? (
        <QuoteDetailsPanel
          key={`${selectedRecord.id}:${selectedRecord.updatedAt}:${selectedRecord.clientRevisionPending}`}
          record={selectedRecord}
          lineItemOptions={lineItemOptions}
          customFeatureOptions={customFeatureOptions}
          isSaving={isSaving}
          isApproving={isApproving}
          isDeleting={isDeleting}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          onApprove={handleApprove}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      ) : null}

      {isCompleting ? <p className="quote-cpi-caption">מעדכן סטטוס "בוצעה"...</p> : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </Panel>
  )
}
