import type { QuoteCustomField } from '../../types/quotation'

export type EditableCustomField = {
  id: string
  key: string
  label: string
  valueType: QuoteCustomField['valueType'] | 'percent'
  value: string
  showInQuoteDetails: boolean
}

type QuoteCustomFieldsEditorProps = {
  fields: EditableCustomField[]
  disabled?: boolean
  onChange: (index: number, patch: Partial<EditableCustomField>) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

const FIELD_TYPE_OPTIONS: Array<{ value: EditableCustomField['valueType']; label: string }> = [
  { value: 'text', label: 'טקסט' },
  { value: 'number', label: 'מספר' },
  { value: 'percent', label: 'אחוז מסכום ביניים' },
  { value: 'boolean', label: 'כן/לא' },
]

function valuePlaceholder(type: EditableCustomField['valueType']): string {
  if (type === 'number') return '0'
  if (type === 'percent') return '9'
  if (type === 'boolean') return ''
  return 'ערך'
}

function normalizeBooleanValue(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return 'true'
  if (normalized === 'false') return 'false'
  return ''
}

export function QuoteCustomFieldsEditor({
  fields,
  disabled = false,
  onChange,
  onAdd,
  onRemove,
}: QuoteCustomFieldsEditorProps) {
  return (
    <section className="quote-custom-fields">
      <h5>שדות דינמיים להצעה</h5>
      <p className="quote-custom-fields-hint">
        הוסיפו שדה פנימי/עסקי. המפתח הטכני נוצר אוטומטית לפי התווית, לכן אין צורך להקליד Key
        ידנית.
      </p>

      {fields.length === 0 ? (
        <p className="empty">אין שדות דינמיים בהצעה זו.</p>
      ) : (
        <div className="quote-custom-fields-table-wrap">
          <table className="quote-custom-fields-table">
            <thead>
              <tr>
                <th>תווית</th>
                <th>סוג ערך</th>
                <th>ערך</th>
                <th>הצג ללקוח</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td>
                    <input
                      value={field.label}
                      disabled={disabled}
                      placeholder="תכנון/ניהול פרויקט"
                      onChange={(event) => onChange(index, { label: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={field.valueType}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextType = event.target.value as EditableCustomField['valueType']
                        const nextPatch: Partial<EditableCustomField> = { valueType: nextType }
                        if (nextType === 'boolean') {
                          nextPatch.value = normalizeBooleanValue(field.value)
                        }
                        onChange(index, nextPatch)
                      }}
                    >
                      {FIELD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {field.valueType === 'boolean' ? (
                      <select
                        value={normalizeBooleanValue(field.value)}
                        disabled={disabled}
                        onChange={(event) => onChange(index, { value: event.target.value })}
                      >
                        <option value="">בחרו</option>
                        <option value="true">כן</option>
                        <option value="false">לא</option>
                      </select>
                    ) : (
                      <input
                        value={field.value}
                        disabled={disabled}
                        placeholder={valuePlaceholder(field.valueType)}
                        onChange={(event) => onChange(index, { value: event.target.value })}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={field.showInQuoteDetails}
                      onChange={(event) =>
                        onChange(index, { showInQuoteDetails: event.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="quote-line-remove"
                      disabled={disabled}
                      onClick={() => onRemove(index)}
                    >
                      הסר
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="quote-line-add" disabled={disabled} onClick={onAdd}>
        הוסף שדה דינמי
      </button>
    </section>
  )
}
