import type { TrainingStageView } from '../../utils/trainingProgress'
import { Panel } from '../ui/Panel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ProgressBar } from '../ui/ProgressBar'

type TrainingPanelProps = {
  status: string
  progress: number
  stages: TrainingStageView[]
  isTraining: boolean
  isUploading: boolean
  isValidatingDocuments: boolean
  canTrain: boolean
  onStartTraining: () => void
}

export function TrainingPanel({
  status,
  progress,
  stages,
  isTraining,
  isUploading,
  isValidatingDocuments,
  canTrain,
  onStartTraining,
}: TrainingPanelProps) {
  if (isUploading || isValidatingDocuments) {
    const title = isUploading ? 'מעלה קבצים...' : 'בודק תקינות קבצים...'
    const hint = isUploading
      ? 'הקבצים נטענים למערכת, זה עשוי לקחת זמן.'
      : 'מתבצעת בדיקה לזיהוי קבצים פגומים לפני אימון.'

    return (
      <Panel title="סטטוס אימון מודל" description={status}>
        <div className="training-upload-state" role="status" aria-live="polite">
          <span className="training-upload-spinner" aria-hidden />
          <p className="training-upload-title">{title}</p>
          <p className="training-upload-hint">{hint}</p>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="סטטוס אימון מודל" description={status}>
      <ProgressBar value={progress} label="training progress overall" />
      <div className="training-stage-list">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`training-stage-item${stage.isActive ? ' active' : ''}${
              stage.isCompleted ? ' done' : ''
            }`}
          >
            <div className="training-stage-heading">
              <p className="training-stage-label">{stage.label}</p>
              {stage.isCompleted ? (
                <span className="training-stage-check" aria-label="completed stage">
                  ✓
                </span>
              ) : null}
            </div>
            <ProgressBar value={stage.value} label={`training stage ${stage.key}`} />
          </div>
        ))}
      </div>
      <PrimaryButton type="button" disabled={!canTrain} onClick={onStartTraining}>
        {isTraining ? 'האימון בתהליך...' : 'התחל אימון'}
      </PrimaryButton>
    </Panel>
  )
}
