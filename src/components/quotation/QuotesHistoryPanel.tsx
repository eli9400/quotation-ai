import { useEffect, useMemo, useState } from 'react'
import {
  approveQuoteRecord,
  deleteQuoteRecord,
  updateQuoteRecord,
} from '../../services/api/providerQuotesApi'
import type { Quote, QuoteSource, StoredQuoteRecord } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { QuoteDetailsPanel } from './QuoteDetailsPanel'
import { Panel } from '../ui/Panel'

type QuotesHistoryPanelProps = {
  authToken: string | null
  records: StoredQuoteRecord[]
  isLoading: boolean
}

const SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  learned: 'מודל נלמד',
  fallback: 'Fallback',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'עדכון ההצעה נכשל.'
}

export function QuotesHistoryPanel({ authToken, records, isLoading }: QuotesHistoryPanelProps) {
  const [localRecords, setLocalRecords] = useState<StoredQuoteRecord[]>(records)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setLocalRecords(records)
    if (!selectedId) {
      return
    }
    const exists = records.some((record) => record.id === selectedId)
    if (!exists) {
      setSelectedId(null)
    }
  }, [records, selectedId])

  const selectedRecord = useMemo(
    () => localRecords.find((record) => record.id === selectedId) ?? null,
    [localRecords, selectedId],
  )

  const updateLocalRecord = (nextRecord: StoredQuoteRecord) => {
    setLocalRecords((current) =>
      current.map((record) => (record.id === nextRecord.id ? nextRecord : record)),
    )
  }

  const handleSave = async (quoteId: string, quote: Quote) => {
    if (!authToken) {
      setErrorMessage('נדרש להתחבר מחדש כדי לערוך הצעה.')
      return
    }
    setErrorMessage(null)
    setIsSaving(true)
    try {
      const updated = await updateQuoteRecord(authToken, quoteId, quote)
      updateLocalRecord(updated)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async (quoteId: string) => {
    if (!authToken) {
      setErrorMessage('נדרש להתחבר מחדש כדי לאשר הצעה.')
      return
    }
    setErrorMessage(null)
    setIsApproving(true)
    try {
      const updated = await approveQuoteRecord(authToken, quoteId)
      updateLocalRecord(updated)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsApproving(false)
    }
  }

  const handleDelete = async (quoteId: string) => {
    if (!authToken) {
      setErrorMessage('נדרש להתחבר מחדש כדי למחוק הצעה.')
      return
    }
    setErrorMessage(null)
    setIsDeleting(true)
    try {
      const deletedId = await deleteQuoteRecord(authToken, quoteId)
      setLocalRecords((current) => current.filter((record) => record.id !== deletedId))
      if (selectedId === deletedId) {
        setSelectedId(null)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <Panel title="טבלת לקוחות והצעות">
        <p className="empty">טוען הצעות קיימות...</p>
      </Panel>
    )
  }

  return (
    <Panel title="טבלת לקוחות והצעות">
      {localRecords.length === 0 ? (
        <p className="empty">עדיין לא נוצרו הצעות מחיר ללקוחות.</p>
      ) : (
        <div className="quotes-table-wrap">
          <table className="quotes-table">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>אימייל</th>
                <th>מחיר</th>
                <th>מקור</th>
                <th>סטטוס</th>
                <th>נוצר</th>
              </tr>
            </thead>
            <tbody>
              {localRecords.map((record) => (
                <tr
                  key={record.id}
                  className={record.id === selectedId ? 'quote-row active' : 'quote-row'}
                  onClick={() => {
                    setSelectedId(record.id)
                    setErrorMessage(null)
                  }}
                >
                  <td>{record.clientRequest.clientName || 'לקוח ללא שם'}</td>
                  <td>{record.clientRequest.clientEmail || '-'}</td>
                  <td>{formatCurrencyIls(record.quote.estimatedPrice)}</td>
                  <td>{SOURCE_LABEL[record.source]}</td>
                  <td>{record.status === 'approved' ? 'מאושר' : 'טיוטה'}</td>
                  <td>{new Date(record.createdAt).toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRecord ? (
        <QuoteDetailsPanel
          record={selectedRecord}
          isSaving={isSaving}
          isApproving={isApproving}
          isDeleting={isDeleting}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      ) : null}

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </Panel>
  )
}
