import { Panel } from '../ui/Panel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ProgressBar } from '../ui/ProgressBar'

type TrainingPanelProps = {
  status: string
  progress: number
  isTraining: boolean
  canTrain: boolean
  onStartTraining: () => void
}

export function TrainingPanel({
  status,
  progress,
  isTraining,
  canTrain,
  onStartTraining,
}: TrainingPanelProps) {
  return (
    <Panel title="סטטוס אימון מודל" description={status}>
      <ProgressBar value={progress} label="training progress" />
      <PrimaryButton type="button" disabled={!canTrain} onClick={onStartTraining}>
        {isTraining ? 'האימון בתהליך...' : 'התחל אימון'}
      </PrimaryButton>
    </Panel>
  )
}
