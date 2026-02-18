import type { ChangeEventHandler } from 'react'
import { FieldLabel } from './FieldLabel'

type TextInputFieldProps = {
  id: string
  label: string
  value: string
  type?: 'text' | 'email'
  autoComplete?: string
  placeholder?: string
  onChange: ChangeEventHandler<HTMLInputElement>
}

export function TextInputField({
  id,
  label,
  value,
  type = 'text',
  autoComplete,
  placeholder,
  onChange,
}: TextInputFieldProps) {
  return (
    <FieldLabel htmlFor={id} label={label}>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={onChange}
      />
    </FieldLabel>
  )
}
