import type {
  ProviderCustomFeatureOption,
  ProviderLineItemOption,
  StoredQuoteRecord,
} from '../../types/quotation'
import type { FormEvent } from 'react'
import { formatCurrencyIls } from '../../utils/formatters'
import { PrimaryButton } from '../ui/PrimaryButton'
import { QuoteCustomFieldPicker } from './QuoteCustomFieldPicker'
import { QuoteCustomFieldsEditor, type EditableCustomField } from './QuoteCustomFieldsEditor'
import { QuoteLineItemPicker } from './QuoteLineItemPicker'
import { QuoteLineItemsTable } from './QuoteLineItemsTable'
import { QUOTE_UNIT_OPTIONS } from './quoteDetailsPanelHelpers'
import type { EditableLineItem, EditableQuoteState } from './quoteDetailsUtils'

type QuoteDetailsTotals = {
  lineTotals: number[]
  subtotalBase: number
  customAdjustment: number
  subtotal: number
  vatAmount: number
  total: number
}

type QuoteDetailsFormProps = {
  record: StoredQuoteRecord
  state: EditableQuoteState
  isBusy: boolean
  isReadOnly: boolean
  isSaving: boolean
  isApproving: boolean
  isDeleting: boolean
  isCompleting: boolean
  canSave: boolean
  hasChanges: boolean
  errorMessage: string | null
  totals: QuoteDetailsTotals
  autoSummary: string
  autoAssumptions: string
  lineItemOptions: ProviderLineItemOption[]
  customFeatureOptions: ProviderCustomFeatureOption[]
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSetVatRate: (value: string) => void
  onToggleCpi: (enabled: boolean) => void
  onSetSummary: (value: string, isManual: boolean) => void
  onSetAssumptions: (value: string, isManual: boolean) => void
  onSetLine: (index: number, patch: Partial<EditableLineItem>) => void
  onRemoveLine: (index: number) => void
  onAddLineItem: (option: ProviderLineItemOption | null, customLabel: string) => void
  onAddCustomField: (feature: ProviderCustomFeatureOption | null, customLabel: string) => void
  onSetCustomField: (index: number, patch: Partial<EditableCustomField>) => void
  onAddEmptyCustomField: () => void
  onRemoveCustomField: (index: number) => void
  onOpenPreview: () => void
  onApprove: () => Promise<void>
  onDelete: () => Promise<void>
  onComplete: () => Promise<void>
}

export function QuoteDetailsForm(props: QuoteDetailsFormProps) {
  const {
    record,
    state,
    isBusy,
    isReadOnly,
    isSaving,
    isApproving,
    isDeleting,
    isCompleting,
    canSave,
    hasChanges,
    errorMessage,
    totals,
    autoSummary,
    autoAssumptions,
    lineItemOptions,
    customFeatureOptions,
    onSave,
    onSetVatRate,
    onToggleCpi,
    onSetSummary,
    onSetAssumptions,
    onSetLine,
    onRemoveLine,
    onAddLineItem,
    onAddCustomField,
    onSetCustomField,
    onAddEmptyCustomField,
    onRemoveCustomField,
    onOpenPreview,
    onApprove,
    onDelete,
    onComplete,
  } = props

  const editorDisabled = isBusy || isReadOnly

  return (
    <form className="quote-edit-form" onSubmit={onSave}>
      <QuoteLineItemPicker options={lineItemOptions} disabled={editorDisabled} onAdd={onAddLineItem} />
      <QuoteLineItemsTable
        lineItems={state.lineItems}
        lineTotals={totals.lineTotals}
        unitOptions={QUOTE_UNIT_OPTIONS}
        disabled={editorDisabled}
        onLineChange={onSetLine}
        onRemoveLine={onRemoveLine}
      />
      <p className="quote-cpi-caption">שורות כחולות הן רכיבים שלא זוהו במודל ונטענו מהלקוח.</p>
      <p className="quote-cpi-caption">שורת אחוז מחושבת מתוך סכום השורות הרגילות. להנחה השתמש בערך שלילי.</p>

      <div className="quote-totals">
        <label>
          מע"מ (%)
          <input
            type="number"
            min={0}
            max={40}
            disabled={editorDisabled}
            value={state.vatRate}
            onChange={(event) => onSetVatRate(event.target.value)}
          />
        </label>

        <label className="quote-cpi-toggle">
          <input
            type="checkbox"
            disabled={editorDisabled}
            checked={state.cpiEnabled}
            onChange={(event) => onToggleCpi(event.target.checked)}
          />
          <span>החל מדד בחישוב</span>
        </label>

        <p className="quote-cpi-caption">מקדם מדד אוטומטי: {Number(state.cpiFactor || 1).toFixed(4)}</p>
        {state.cpiSourceYear || state.cpiTargetYear ? (
          <p className="quote-cpi-caption">
            שנת בסיס: {state.cpiSourceYear ?? '-'} | שנת יעד: {state.cpiTargetYear ?? '-'}
          </p>
        ) : null}
        <p>סכום שורות: {formatCurrencyIls(totals.subtotalBase)}</p>
        {Math.abs(totals.customAdjustment) > 0.01 ? (
          <p>תוספת/הפחתת שדות דינמיים: {formatCurrencyIls(totals.customAdjustment)}</p>
        ) : null}
        <p>סכום ביניים: {formatCurrencyIls(totals.subtotal)}</p>
        <p>מע"מ: {formatCurrencyIls(totals.vatAmount)}</p>
        <p><strong>סה"כ: {formatCurrencyIls(totals.total)}</strong></p>
      </div>

      <label>
        סיכום
        <textarea
          rows={2}
          disabled={editorDisabled}
          value={state.summary}
          placeholder="כתוב כאן תקציר להצעה: מה כלול ומה לא כלול."
          onChange={(event) => {
            const value = event.target.value
            onSetSummary(value, value.trim().length > 0 && value !== autoSummary)
          }}
        />
      </label>

      <label>
        הנחות
        <textarea
          rows={3}
          disabled={editorDisabled}
          value={state.assumptions}
          placeholder="כתוב כאן הנחות עבודה, תנאי תשלום והערות מיוחדות."
          onChange={(event) => {
            const value = event.target.value
            onSetAssumptions(value, value.trim().length > 0 && value !== autoAssumptions)
          }}
        />
      </label>

      <QuoteCustomFieldPicker options={customFeatureOptions} disabled={editorDisabled} onAdd={onAddCustomField} />
      <QuoteCustomFieldsEditor
        fields={state.customFields}
        disabled={editorDisabled}
        onChange={onSetCustomField}
        onAdd={onAddEmptyCustomField}
        onRemove={onRemoveCustomField}
      />

      <div className="quote-preview-launcher">
        <PrimaryButton type="button" disabled={isBusy} onClick={onOpenPreview}>
          תצוגת הצעה ללקוח (PDF)
        </PrimaryButton>
      </div>

      <div className="quote-edit-actions">
        <PrimaryButton type="submit" disabled={!canSave}>
          {isSaving ? 'שומר...' : 'שמור שינויים'}
        </PrimaryButton>
        <PrimaryButton type="button" disabled={isBusy || record.status !== 'draft'} onClick={() => void onApprove()}>
          {record.status === 'draft'
            ? isApproving
              ? 'מאשר...'
              : 'אשר הצעה'
            : record.status === 'completed'
              ? 'בוצעה'
              : 'ההצעה אושרה'}
        </PrimaryButton>
        {record.status === 'draft' ? (
          <button type="button" className="quote-line-remove" disabled={isBusy} onClick={() => void onDelete()}>
            {isDeleting ? 'מוחק...' : 'מחק הצעה'}
          </button>
        ) : null}
        {record.status === 'approved' ? (
          <PrimaryButton type="button" disabled={isBusy} onClick={() => void onComplete()}>
            {isCompleting ? 'מסמן...' : 'העבודה בוצעה'}
          </PrimaryButton>
        ) : null}
      </div>

      {isReadOnly ? <p className="quote-cpi-caption">הצעה מאושרת ניתנת לעריכה רק בצד הלקוח.</p> : null}
      {!hasChanges ? <p className="quote-cpi-caption">אין שינויים לשמירה.</p> : null}
      {errorMessage ? <p className="auth-status auth-status-error">{errorMessage}</p> : null}
    </form>
  )
}
