import type { TrainingStageView } from '../../utils/trainingProgress'
import { Panel } from '../ui/Panel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { ProgressBar } from '../ui/ProgressBar'

type TrainingPanelProps = {
  status: string
  progress: number
  stages: TrainingStageView[]
  isTraining: boolean
  canTrain: boolean
  onStartTraining: () => void
}

export function TrainingPanel({
  status,
  progress,
  stages,
  isTraining,
  canTrain,
  onStartTraining,
}: TrainingPanelProps) {
  return (
    <Panel
      title="\u05e1\u05d8\u05d8\u05d5\u05e1 \u05d0\u05d9\u05de\u05d5\u05df \u05de\u05d5\u05d3\u05dc"
      description={status}
    >
      <ProgressBar value={progress} label="training progress overall" />
      <div className="training-stage-list">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`training-stage-item${stage.isActive ? ' active' : ''}${
              stage.isCompleted ? ' done' : ''
            }`}
          >
            <p className="training-stage-label">{stage.label}</p>
            <ProgressBar value={stage.value} label={`training stage ${stage.key}`} />
          </div>
        ))}
      </div>
      <PrimaryButton type="button" disabled={!canTrain} onClick={onStartTraining}>
        {isTraining
          ? '\u05d4\u05d0\u05d9\u05de\u05d5\u05df \u05d1\u05ea\u05d4\u05dc\u05d9\u05da...'
          : '\u05d4\u05ea\u05d7\u05dc \u05d0\u05d9\u05de\u05d5\u05df'}
      </PrimaryButton>
    </Panel>
  )
}
