import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteDocument,
  getLatestCompletedTrainingJob,
  getTrainingJob,
  listDocuments,
  startTraining,
  uploadDocuments,
} from '../services/api/quotationApi'
import type { UploadedDocument } from '../types/quotation'
import { useQuoteHistory } from './useQuoteHistory'

const TRAINING_POLL_MS = 850
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'אירעה שגיאה בלתי צפויה.'
}
function idsSignature(ids: string[]): string {
  return ids.slice().sort().join('|')
}
function toDisplayDate(value: string): string {
  return new Date(value).toLocaleString('he-IL')
}

export function useQuotationMvp(authToken: string | null) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [isTraining, setIsTraining] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [trainedDocumentIds, setTrainedDocumentIds] = useState<string[] | null>(null)
  const [trainingReadyAt, setTrainingReadyAt] = useState<string | null>(null)
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const trainingTimerRef = useRef<number | null>(null)
  const pollInFlightRef = useRef(false)

  const handleQuoteHistoryError = useCallback((message: string) => {
    setErrorMessage(message)
  }, [])

  const { quoteHistory, isLoadingQuotes, clearQuoteHistory } = useQuoteHistory({
    authToken,
    onError: handleQuoteHistoryError,
  })

  const currentDocumentIds = useMemo(() => documents.map((doc) => doc.id), [documents])
  const modelReady = trainedDocumentIds !== null && trainingJobId !== null
  const hasPendingTrainingChanges = useMemo(() => {
    if (documents.length === 0) return false
    if (!trainedDocumentIds) return true
    return idsSignature(currentDocumentIds) !== idsSignature(trainedDocumentIds)
  }, [currentDocumentIds, documents.length, trainedDocumentIds])
  const showTrainingPanel = isTraining || isUploading || (documents.length > 0 && (!modelReady || hasPendingTrainingChanges))
  const canTrain = hasPendingTrainingChanges && !isTraining && !isUploading

  useEffect(
    () => () => {
      if (trainingTimerRef.current !== null) {
        window.clearInterval(trainingTimerRef.current)
      }
    },
    [],
  )

  const clearTrainingPolling = () => {
    if (trainingTimerRef.current === null) return
    window.clearInterval(trainingTimerRef.current)
    trainingTimerRef.current = null
  }

  const clearRunningState = () => {
    clearTrainingPolling()
    pollInFlightRef.current = false
    setIsTraining(false)
  }

  useEffect(() => {
    if (!authToken) {
      clearRunningState()
      setDocuments([])
      setIsUploading(false)
      setTrainingProgress(0)
      setTrainedDocumentIds(null)
      setTrainingReadyAt(null)
      setTrainingJobId(null)
      setErrorMessage(null)
      clearQuoteHistory()
      return
    }

    let active = true
    const loadInitialData = async () => {
      try {
        const [storedDocuments, latestTrainingJob] = await Promise.all([
          listDocuments(authToken),
          getLatestCompletedTrainingJob(authToken),
        ])

        if (!active) return

        setDocuments(storedDocuments)
        if (latestTrainingJob) {
          setTrainingProgress(100)
          setTrainingJobId(latestTrainingJob.id)
          setTrainedDocumentIds(latestTrainingJob.documentIds)
          setTrainingReadyAt(toDisplayDate(latestTrainingJob.completedAt ?? latestTrainingJob.updatedAt))
        } else {
          setTrainingProgress(0)
          setTrainingJobId(null)
          setTrainedDocumentIds(null)
          setTrainingReadyAt(null)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(getErrorMessage(error))
        }
      }
    }

    void loadInitialData()
    return () => {
      active = false
    }
  }, [authToken])

  const trainingStatus = useMemo(() => {
    if (isUploading) return 'מעלה מסמכים לשרת...'
    if (isTraining) return 'אימון המודל מתבצע על השרת...'
    if (documents.length === 0) return 'העלו מסמכים כדי להתחיל אימון.'
    if (hasPendingTrainingChanges) return 'זוהה שינוי במסמכים. לחצו על "התחל אימון" כדי לעדכן את המודל.'
    if (modelReady && trainingReadyAt) {
      return `המודל מעודכן ואין שינויים במסמכים. עדכון אחרון: ${trainingReadyAt}`
    }
    return 'המסמכים הועלו. לחצו על "התחל אימון".'
  }, [documents.length, hasPendingTrainingChanges, isTraining, isUploading, modelReady, trainingReadyAt])

  const addDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!authToken) {
      setErrorMessage('יש להתחבר כנותן שירות לפני העלאת מסמכים.')
      return
    }

    setErrorMessage(null)
    setIsUploading(true)
    try {
      const uploaded = await uploadDocuments(authToken, Array.from(files))
      setDocuments((current) => [...uploaded, ...current])
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const removeDocument = async (documentId: string) => {
    if (!authToken) {
      setErrorMessage('יש להתחבר כנותן שירות לפני הסרת מסמך.')
      return
    }

    setErrorMessage(null)
    setIsUploading(true)
    try {
      await deleteDocument(authToken, documentId)
      setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const pollTrainingStatus = (jobId: string, idToken: string) => {
    clearTrainingPolling()
    trainingTimerRef.current = window.setInterval(async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const job = await getTrainingJob(idToken, jobId)
        setTrainingProgress(job.progress)

        if (job.status === 'completed') {
          clearRunningState()
          setTrainingProgress(100)
          setTrainingJobId(job.id)
          setTrainedDocumentIds(job.documentIds)
          setTrainingReadyAt(toDisplayDate(job.completedAt ?? job.updatedAt))
        } else if (job.status === 'failed') {
          clearRunningState()
          setErrorMessage(job.errorMessage ?? 'האימון נכשל בשרת.')
        }
      } catch (error) {
        clearRunningState()
        setErrorMessage(getErrorMessage(error))
      } finally {
        pollInFlightRef.current = false
      }
    }, TRAINING_POLL_MS)
  }

  const startModelTraining = async () => {
    if (!canTrain || !authToken) return

    setErrorMessage(null)
    setIsTraining(true)
    try {
      const job = await startTraining(authToken, currentDocumentIds)
      setTrainingJobId(job.id)
      setTrainingProgress(job.progress)
      setTrainingReadyAt(null)
      pollTrainingStatus(job.id, authToken)
    } catch (error) {
      clearRunningState()
      setErrorMessage(getErrorMessage(error))
    }
  }

  return {
    documents,
    trainingProgress,
    trainingStatus,
    isTraining,
    isUploading,
    canTrain,
    modelReady,
    showTrainingPanel,
    quoteHistory,
    isLoadingQuotes,
    errorMessage,
    addDocuments,
    removeDocument,
    startTraining: startModelTraining,
  }
}
