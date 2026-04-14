import { useMemo, useState } from 'react'
import {
  mergeProviderLineItems,
  type MergeProviderLineItemsResult,
} from '../../services/api/modelApi'
import { toUnitLabel } from './unitLabels'
import { PrimaryButton } from '../ui/PrimaryButton'

type MergeRow = {
  id: string
  canonicalName: string
  unit: string
  sourceType: 'provider' | 'industry' | 'catalog'
}

type ClientFormItemsMergePanelProps = {
  authToken: string | null
  rows: MergeRow[]
  disabled?: boolean
  onMerged: (result: MergeProviderLineItemsResult) => Promise<void> | void
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return 'איחוד רכיבים נכשל.'
}

function toLabel(row: MergeRow): string {
  return `${row.canonicalName} (${toUnitLabel(row.unit)})`
}

export function ClientFormItemsMergePanel({
  authToken,
  rows,
  disabled = false,
  onMerged,
}: ClientFormItemsMergePanelProps) {
  const [sourceItemId, setSourceItemId] = useState('')
  const [targetItemId, setTargetItemId] = useState('')
  const [isMerging, setIsMerging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const providerRows = useMemo(
    () =>
      rows
        .filter((row) => row.sourceType === 'provider')
        .slice()
        .sort((left, right) => toLabel(left).localeCompare(toLabel(right), 'he')),
    [rows],
  )

  const source = providerRows.find((row) => row.id === sourceItemId) ?? null
  const targetOptions = source
    ? providerRows.filter((row) => row.id !== source.id && row.unit === source.unit)
    : []

  const canMerge = Boolean(authToken && source && targetItemId && !disabled && !isMerging)

  const handleMerge = async () => {
    if (!authToken || !source || !targetItemId || !canMerge) return
    const target = providerRows.find((row) => row.id === targetItemId)
    if (!target) return

    const approved = window.confirm(
      `לאחד "${toLabel(source)}" אל "${toLabel(target)}"?`,
    )
    if (!approved) return

    setIsMerging(true)
    setErrorMessage(null)
    try {
      const result = await mergeProviderLineItems(authToken, source.id, target.id)
      await onMerged(result)
      setSourceItemId('')
      setTargetItemId('')
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsMerging(false)
    }
  }

  if (providerRows.length < 2) {
    return null
  }

  return (
    <section className="line-items-merge-panel">
      <h4>איחוד כפילויות במודל</h4>
      <p>בחר/י רכיב מקור ורכיב יעד (אותה יחידה). האיחוד יעדכן גם את נתוני האימון.</p>
      <div className="line-items-merge-controls">
        <select
          value={sourceItemId}
          disabled={disabled || isMerging}
          onChange={(event) => {
            setSourceItemId(event.target.value)
            setTargetItemId('')
          }}
        >
          <option value="">בחר רכיב מקור</option>
          {providerRows.map((row) => (
            <option key={row.id} value={row.id}>
              {toLabel(row)}
            </option>
          ))}
        </select>

        <select
          value={targetItemId}
          disabled={disabled || isMerging || !source}
          onChange={(event) => setTargetItemId(event.target.value)}
        >
          <option value="">בחר רכיב יעד</option>
          {targetOptions.map((row) => (
            <option key={row.id} value={row.id}>
              {toLabel(row)}
            </option>
          ))}
        </select>

        <PrimaryButton type="button" disabled={!canMerge} onClick={handleMerge}>
          {isMerging ? 'מאחד...' : 'אחד רכיבים'}
        </PrimaryButton>
      </div>
      {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
    </section>
  )
}
