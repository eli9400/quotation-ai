import type { ChangeEventHandler } from 'react'
import { FieldLabel } from './FieldLabel'
import type { SelectOption } from '../../features/quotation/options'

type SelectFieldProps<T extends string> = {
  id: string
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: ChangeEventHandler<HTMLSelectElement>
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <FieldLabel htmlFor={id} label={label}>
      <select id={id} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldLabel>
  )
}
