import type { ChangeEventHandler } from 'react'
import { FieldLabel } from './FieldLabel'

type TextInputFieldProps = {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: ChangeEventHandler<HTMLInputElement>
}

export function TextInputField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: TextInputFieldProps) {
  return (
    <FieldLabel htmlFor={id} label={label}>
      <input id={id} value={value} placeholder={placeholder} onChange={onChange} />
    </FieldLabel>
  )
}
