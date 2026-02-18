import type { ChangeEventHandler } from 'react'
import { FieldLabel } from './FieldLabel'

type TextAreaFieldProps = {
  id: string
  label: string
  value: string
  placeholder?: string
  rows?: number
  onChange: ChangeEventHandler<HTMLTextAreaElement>
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  rows = 4,
  onChange,
}: TextAreaFieldProps) {
  return (
    <FieldLabel htmlFor={id} label={label}>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={onChange}
      />
    </FieldLabel>
  )
}
