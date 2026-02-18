import type { FormEvent } from 'react'
import { projectOptions, scopeOptions, urgencyOptions } from '../../features/quotation/options'
import type {
  ClientRequestForm,
  ProjectType,
  ScopeLevel,
  UrgencyLevel,
} from '../../types/quotation'
import { SelectField } from '../forms/SelectField'
import { TextAreaField } from '../forms/TextAreaField'
import { TextInputField } from '../forms/TextInputField'
import { Panel } from '../ui/Panel'
import { PrimaryButton } from '../ui/PrimaryButton'

type OnFieldChange = <K extends keyof ClientRequestForm>(
  field: K,
  value: ClientRequestForm[K],
) => void

type QuoteRequestPanelProps = {
  form: ClientRequestForm
  disabled: boolean
  isSubmitting: boolean
  onFieldChange: OnFieldChange
  onSubmit: () => void
}

export function QuoteRequestPanel({
  form,
  disabled,
  isSubmitting,
  onFieldChange,
  onSubmit,
}: QuoteRequestPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <Panel title="נתוני בקשת לקוח">
      <form className="quote-form" onSubmit={handleSubmit}>
        <TextInputField
          id="clientName"
          label="שם לקוח"
          value={form.clientName}
          placeholder="לדוגמה: חברת אלפא"
          onChange={(event) => onFieldChange('clientName', event.target.value)}
        />

        <SelectField
          id="projectType"
          label="סוג פרויקט"
          value={form.projectType}
          options={projectOptions}
          onChange={(event) =>
            onFieldChange('projectType', event.target.value as ProjectType)
          }
        />

        <SelectField
          id="scope"
          label="היקף עבודה"
          value={form.scope}
          options={scopeOptions}
          onChange={(event) => onFieldChange('scope', event.target.value as ScopeLevel)}
        />

        <SelectField
          id="urgency"
          label="רמת דחיפות"
          value={form.urgency}
          options={urgencyOptions}
          onChange={(event) => onFieldChange('urgency', event.target.value as UrgencyLevel)}
        />

        <TextAreaField
          id="requirements"
          label="דרישות מיוחדות"
          value={form.requirements}
          placeholder="תיאור חופשי של הצורך של הלקוח"
          rows={5}
          onChange={(event) => onFieldChange('requirements', event.target.value)}
        />

        <PrimaryButton type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? 'מפיק הצעה...' : 'הפק הצעת מחיר אוטומטית'}
        </PrimaryButton>
      </form>
    </Panel>
  )
}
