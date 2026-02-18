import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type PrimaryButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>

export function PrimaryButton({ children, className, ...rest }: PrimaryButtonProps) {
  const buttonClassName = className ? `primary-btn ${className}` : 'primary-btn'
  return (
    <button {...rest} className={buttonClassName}>
      {children}
    </button>
  )
}
