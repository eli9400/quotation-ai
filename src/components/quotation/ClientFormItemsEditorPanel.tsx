import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteProviderLineItem,
  getProviderLineItemOptions,
  saveProviderLineItemDisplayConfigs,
  type DeleteProviderLineItemResult,
  type MergeProviderLineItemsResult,
} from '../../services/api/modelApi'
import type { ProviderLineItemOption } from '../../types/quotation'
import { Panel } from '../ui/Panel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ClientFormItemsMergePanel } from './ClientFormItemsMergePanel'
import { toUnitLabel } from './unitLabels'

type Props = { authToken: string | null; onSaved: () => void }
type EditableRow = {
  id: string
  canonicalName: string
  unit: string
  clientLabel: string
  visibleToClient: boolean
  sourceType: ProviderLineItemOption['sourceType']
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback
const normalizeLabel = (value: string): string => value.replace(/\s+/g, ' ').trim()

function toSourceLabel(sourceType: ProviderLineItemOption['sourceType']): string {
  if (sourceType === 'provider') return 'שלי'
  if (sourceType === 'industry') return 'ענפי'
  if (sourceType === 'catalog') return 'קטלוג'
  return sourceType
}

function toEditableRows(options: ProviderLineItemOption[]): EditableRow[] {
  return options.filter((option) => !option.isProviderOnly).map((option) => ({
    id: option.id,
    canonicalName: option.canonicalName,
    unit: option.unit,
    clientLabel: option.clientLabel ?? option.canonicalName,
    visibleToClient: option.visibleToClient,
    sourceType: option.sourceType,
  }))
}

const rowsSignature = (rows: EditableRow[]): string =>
  rows.map((row) => `${row.id}|${normalizeLabel(row.clientLabel)}|${row.visibleToClient ? '1' : '0'}`).join('||')

export function ClientFormItemsEditorPanel({ authToken, onSaved }: Props) {
  const [rows, setRows] = useState<EditableRow[]>([])
  const [initialRows, setInitialRows] = useState<EditableRow[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    if (!authToken) {
      setRows([])
      setInitialRows([])
      setStatusMessage(null)
      setErrorMessage(null)
      return
    }
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const nextRows = toEditableRows(await getProviderLineItemOptions(authToken))
      setRows(nextRows)
      setInitialRows(nextRows)
    } catch (error) {
      setRows([])
      setInitialRows([])
      setErrorMessage(toErrorMessage(error, 'טעינת רכיבי טופס הלקוח נכשלה.'))
    } finally {
      setIsLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    const run = async () => {
      setStatusMessage(null)
      await loadRows()
    }
    void run()
    return undefined
  }, [loadRows])

  const initialById = useMemo(() => new Map(initialRows.map((row) => [row.id, row])), [initialRows])
  const hasChanges = rowsSignature(rows) !== rowsSignature(initialRows)
  const disabled = isLoading || isSaving || deletingItemId !== null

  const visibleRows = useMemo(() => {
    const normalizedQuery = normalizeLabel(query).toLowerCase()
    if (!normalizedQuery) return rows
    return rows.filter((row) => row.canonicalName.toLowerCase().includes(normalizedQuery) || row.clientLabel.toLowerCase().includes(normalizedQuery))
  }, [query, rows])

  const handleSave = async () => {
    if (!authToken || !hasChanges || disabled) return
    const changedRows = rows.filter((row) => {
      const current = initialById.get(row.id)
      if (!current) return true
      return normalizeLabel(row.clientLabel) !== normalizeLabel(current.clientLabel) || row.visibleToClient !== current.visibleToClient
    })
    if (changedRows.length === 0) return

    setIsSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      await saveProviderLineItemDisplayConfigs(authToken, changedRows.map((row) => ({
        sourceItemId: row.id,
        customLabel: normalizeLabel(row.clientLabel) === normalizeLabel(row.canonicalName) ? null : normalizeLabel(row.clientLabel),
        visibleToClient: row.visibleToClient,
      })))
      setInitialRows(rows)
      setStatusMessage('תצוגת הלקוח נשמרה.')
      onSaved()
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'שמירת תצוגת טופס הלקוח נכשלה.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleted = async (result: DeleteProviderLineItemResult) => {
    await loadRows()
    setStatusMessage(`הרכיב נמחק לצמיתות. נמחקו ${result.deletedDatasetRows} שורות אימון.`)
    setErrorMessage(null)
    onSaved()
  }

  const handleDelete = async (row: EditableRow) => {
    if (!authToken) return
    const approved = window.confirm(
      `למחוק לצמיתות את "${row.canonicalName}" מהמודל?\n\nהפעולה מוחקת את הרכיב ממסך הלקוח ומהמודל של נותן השירות.`,
    )
    if (!approved) return

    setDeletingItemId(row.id)
    setStatusMessage(null)
    setErrorMessage(null)
    try {
      await handleDeleted(await deleteProviderLineItem(authToken, row.id))
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'מחיקת רכיב מהמודל נכשלה.'))
    } finally {
      setDeletingItemId(null)
    }
  }

  const handleMerged = async (result: MergeProviderLineItemsResult) => {
    await loadRows()
    setStatusMessage(`האיחוד הושלם. עודכנו ${result.updatedDatasetRows} שורות אימון.`)
    setErrorMessage(null)
    onSaved()
  }

  return (
    <Panel title="עריכת טופס לקוח" description='ניתן לשנות שם רכיב ללקוח, להסתיר רכיבים, לאחד כפילויות ולמחוק רכיב לצמיתות.'>
      <ClientFormItemsMergePanel authToken={authToken} rows={rows} disabled={disabled} onMerged={handleMerged} />
      <input className="line-items-editor-search" value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש רכיב..." />

      <div className="line-items-editor-table-wrap">
        <table className="line-items-editor-table">
          <thead>
            <tr>
              <th>רכיב מקור</th><th>יחידה</th><th>תצוגה ללקוח</th><th>מקור</th><th>מוצג</th><th>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td>{row.canonicalName}</td>
                <td>{toUnitLabel(row.unit)}</td>
                <td>
                  <input value={row.clientLabel} disabled={disabled} onChange={(event) => setRows((current) => current.map((item) => (item.id === row.id ? { ...item, clientLabel: event.target.value } : item)))} />
                </td>
                <td>{toSourceLabel(row.sourceType)}</td>
                <td>
                  <input type="checkbox" checked={row.visibleToClient} disabled={disabled} onChange={(event) => setRows((current) => current.map((item) => (item.id === row.id ? { ...item, visibleToClient: event.target.checked } : item)))} />
                </td>
                <td>
                  <button type="button" className="line-items-delete-icon" disabled={disabled} onClick={() => void handleDelete(row)} title="מחיקה לצמיתות" aria-label={`מחק לצמיתות ${row.canonicalName}`}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PrimaryButton type="button" disabled={!hasChanges || disabled} onClick={handleSave}>{isSaving ? 'שומר...' : 'שמור תצוגת לקוח'}</PrimaryButton>
      {statusMessage ? <p className="auth-status auth-status-success">{statusMessage}</p> : null}
      {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
    </Panel>
  )
}
