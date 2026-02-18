export type TrainingStatus = 'running' | 'completed' | 'failed'

export type TrainingJob = {
  id: string
  serviceProviderUid: string
  status: TrainingStatus
  progress: number
  documentIds: string[]
  startedAt: string
  updatedAt: string
  completedAt: string | null
  errorMessage: string | null
}
