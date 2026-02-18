import type { FormPreviewSchema } from '../../types/quotation'
import { Panel } from '../ui/Panel'

type ClientFormPreviewPanelProps = {
  schema: FormPreviewSchema | null
  isLoading: boolean
}

function renderPreviewControl(field: FormPreviewSchema['fields'][number]) {
  if (field.type === 'textarea') {
    return <textarea disabled rows={3} placeholder={field.placeholder ?? ''} />
  }

  if (field.type === 'select') {
    return (
      <select disabled defaultValue="">
        <option value="">בחרו</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      disabled
      type={field.type === 'number' ? 'number' : 'text'}
      placeholder={field.placeholder ?? ''}
    />
  )
}

function schemaDescription(schema: FormPreviewSchema | null): string {
  if (!schema) {
    return 'התצוגה תופיע אחרי אימון ראשון או כשיש מודל שמור.'
  }

  const dynamicCount = schema.fields.filter((field) => field.sourceItemId !== null).length
  const generatedAt = new Date(schema.generatedAt).toLocaleString('he-IL')
  return `השדות נבנו לפי האימון האחרון. שדות דינמיים: ${dynamicCount}. עדכון: ${generatedAt}.`
}

export function ClientFormPreviewPanel({ schema, isLoading }: ClientFormPreviewPanelProps) {
  return (
    <Panel title="תצוגת טופס ללקוח" description={schemaDescription(schema)}>
      {isLoading ? (
        <p className="empty">טוען תצוגת טופס...</p>
      ) : !schema || schema.fields.length === 0 ? (
        <p className="empty">לא נמצא מודל שמור. העלו מסמכים והריצו אימון.</p>
      ) : (
        <form className="preview-form">
          {schema.fields
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((field) => (
              <label key={field.id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {renderPreviewControl(field)}
              </label>
            ))}
        </form>
      )}
    </Panel>
  )
}
