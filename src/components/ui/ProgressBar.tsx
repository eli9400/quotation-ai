type ProgressBarProps = {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div>
      <div className="progress-track" aria-label={label ?? 'progress'}>
        <div
          className="progress-fill"
          style={{ width: `${safeValue}%` }}
          role="progressbar"
          aria-valuenow={safeValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="progress-value">{safeValue}%</p>
    </div>
  )
}
