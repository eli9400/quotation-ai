import type { PropsWithChildren } from 'react'

type FieldLabelProps = PropsWithChildren<{
  htmlFor: string
  label: string
}>

export function FieldLabel({ htmlFor, label, children }: FieldLabelProps) {
  return (
    <>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </>
  )
}
