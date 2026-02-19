import type { QuoteCustomField } from '../../types/quotation'

export type EditableCustomField = {
  id: string
  key: string
  label: string
  valueType: QuoteCustomField['valueType']
  value: string
  showInQuoteDetails: boolean
}

type QuoteCustomFieldsEditorProps = {
  fields: EditableCustomField[]
  onChange: (index: number, patch: Partial<EditableCustomField>) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

const FIELD_TYPE_OPTIONS: Array<{ value: QuoteCustomField['valueType']; label: string }> = [
  { value: 'text', label: 'טקסט' },
  { value: 'number', label: 'מספר' },
  { value: 'boolean', label: 'כן/לא' },
]

function valuePlaceholder(type: QuoteCustomField['valueType']): string {
  if (type === 'number') {
    return '0'
  }
  if (type === 'boolean') {
    return 'true / false'
  }
  return 'ערך'
}

export function QuoteCustomFieldsEditor({
  fields,
  onChange,
  onAdd,
  onRemove,
}: QuoteCustomFieldsEditorProps) {
  return (
    <section className="quote-custom-fields">
      <h5>שדות דינמיים להצעה</h5>
      <p className="quote-custom-fields-hint">
        אפשר להוסיף שדות חופשיים (למשל עודפי מלאי / מספר עובדים) ולבחור אם יוצגו ללקוח בפירוט
        ההצעה.
      </p>

      {fields.length === 0 ? (
        <p className="empty">אין שדות דינמיים בהצעה זו.</p>
      ) : (
        <div className="quote-custom-fields-table-wrap">
          <table className="quote-custom-fields-table">
            <thead>
              <tr>
                <th>מפתח</th>
                <th>תווית</th>
                <th>סוג ערך</th>
                <th>ערך</th>
                <th>להציג ללקוח</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td>
                    <input
                      value={field.key}
                      placeholder="inventory_surplus"
                      onChange={(event) => onChange(index, { key: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={field.label}
                      placeholder="עודפי מלאי"
                      onChange={(event) => onChange(index, { label: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={field.valueType}
                      onChange={(event) =>
                        onChange(index, { valueType: event.target.value as QuoteCustomField['valueType'] })
                      }
                    >
                      {FIELD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={field.value}
                      placeholder={valuePlaceholder(field.valueType)}
                      onChange={(event) => onChange(index, { value: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={field.showInQuoteDetails}
                      onChange={(event) =>
                        onChange(index, { showInQuoteDetails: event.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="quote-line-remove" onClick={() => onRemove(index)}>
                      הסר
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="quote-line-add" onClick={onAdd}>
        הוסף שדה דינמי
      </button>
    </section>
  )
}
