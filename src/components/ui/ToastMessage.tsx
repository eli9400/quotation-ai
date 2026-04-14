type ToastMessageProps = {
  message: string | null
  tone?: 'error' | 'success'
}

export function ToastMessage({ message, tone = 'error' }: ToastMessageProps) {
  if (!message) {
    return null
  }

  return (
    <div className={`toast-message toast-${tone}`} role="alert" aria-live="assertive">
      {message}
    </div>
  )
}
