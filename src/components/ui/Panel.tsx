import type { PropsWithChildren } from 'react'

type PanelProps = PropsWithChildren<{
  title: string
  description?: string
  className?: string
}>

export function Panel({ title, description, className, children }: PanelProps) {
  const panelClassName = className ? `panel ${className}` : 'panel'

  return (
    <article className={panelClassName}>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {children}
    </article>
  )
}
