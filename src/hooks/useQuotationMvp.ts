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
const TOAST_AUTO_CLOSE_MS = 2000
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'שגיאה לא צפויה.'
}
function idsSignature(ids: string[]): string { return ids.slice().sort().join('|') }
function toDisplayDate(value: string): string { return new Date(value).toLocaleString('he-IL') }
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
  const errorTimerRef = useRef<number | null>(null)
  const pollInFlightRef = useRef(false)
  const tokenRef = useRef<string | null>(authToken)
  useEffect(() => { tokenRef.current = authToken }, [authToken])
  const clearError = useCallback(() => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    setErrorMessage(null)
  }, [])
  const pushError = useCallback((message: string) => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current)
    }
    setErrorMessage(message)
    errorTimerRef.current = window.setTimeout(() => {
      setErrorMessage(null)
      errorTimerRef.current = null
    }, TOAST_AUTO_CLOSE_MS)
  }, [])
  const clearTrainingPolling = useCallback(() => {
    if (trainingTimerRef.current !== null) {
      window.clearInterval(trainingTimerRef.current)
      trainingTimerRef.current = null
    }
  }, [])
  const clearRunningState = useCallback(() => {
    clearTrainingPolling()
    pollInFlightRef.current = false
    setIsTraining(false)
  }, [clearTrainingPolling])
  const { quoteHistory, isLoadingQuotes, clearQuoteHistory } = useQuoteHistory({ authToken, onError: pushError })
  const currentDocumentIds = useMemo(() => documents.map((doc) => doc.id), [documents])
  const pendingDocuments = useMemo(() => {
    if (!trainedDocumentIds) {
      return documents
    }
    const trainedSet = new Set(trainedDocumentIds)
    return documents.filter((doc) => !trainedSet.has(doc.id))
  }, [documents, trainedDocumentIds])
  const modelReady = trainedDocumentIds !== null && trainingJobId !== null
  const hasPendingTrainingChanges = useMemo(() => {
    if (documents.length === 0) return false
    if (!trainedDocumentIds) return true
    return idsSignature(currentDocumentIds) !== idsSignature(trainedDocumentIds)
  }, [currentDocumentIds, documents.length, trainedDocumentIds])
  const showTrainingPanel =
    isTraining || isUploading || (documents.length > 0 && (!modelReady || hasPendingTrainingChanges))
  const canTrain = hasPendingTrainingChanges && !isTraining && !isUploading
  useEffect(
    () => () => {
      clearTrainingPolling()
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current)
      }
    },
    [clearTrainingPolling],
  )
  useEffect(() => {
    if (!authToken) {
      clearRunningState()
      clearError()
      setDocuments([])
      setIsUploading(false)
      setTrainingProgress(0)
      setTrainedDocumentIds(null)
      setTrainingReadyAt(null)
      setTrainingJobId(null)
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
        if (!latestTrainingJob) {
          setTrainingProgress(0)
          setTrainingJobId(null)
          setTrainedDocumentIds(null)
          setTrainingReadyAt(null)
          return
        }
        setTrainingProgress(100)
        setTrainingJobId(latestTrainingJob.id)
        setTrainedDocumentIds(latestTrainingJob.documentIds)
        setTrainingReadyAt(toDisplayDate(latestTrainingJob.completedAt ?? latestTrainingJob.updatedAt))
      } catch (error) {
        if (active) {
          pushError(toErrorMessage(error))
        }
      }
    }
    void loadInitialData()
    return () => {
      active = false
    }
  }, [authToken, clearError, clearQuoteHistory, clearRunningState, pushError])
  const trainingStatus = useMemo(() => {
    if (isUploading) return 'מעלה קבצים...'
    if (isTraining) return 'האימון מתבצע...'
    if (documents.length === 0) return 'העלה מסמכים כדי להתחיל.'
    if (hasPendingTrainingChanges) {
      return `יש ${pendingDocuments.length} קבצים חדשים שממתינים לאימון.`
    }
    if (modelReady && trainingReadyAt) {
      return `המודל מעודכן. אימון אחרון: ${trainingReadyAt}`
    }
    return 'המסמכים הועלו. לחץ על "התחל אימון".'
  }, [documents.length, hasPendingTrainingChanges, isTraining, isUploading, modelReady, pendingDocuments.length, trainingReadyAt])
  const addDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!authToken) {
      pushError('יש להתחבר לפני העלאת מסמכים.')
      return
    }
    clearError()
    setIsUploading(true)
    try {
      const uploaded = await uploadDocuments(authToken, Array.from(files))
      setDocuments((current) => [...uploaded, ...current])
    } catch (error) {
      pushError(toErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }
  const removeDocument = async (documentId: string) => {
    if (!authToken) {
      pushError('יש להתחבר לפני הסרת מסמכים.')
      return
    }
    clearError()
    setIsUploading(true)
    try {
      await deleteDocument(authToken, documentId)
      setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    } catch (error) {
      pushError(toErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }
  const pollTrainingStatus = (jobId: string) => {
    clearTrainingPolling()
    trainingTimerRef.current = window.setInterval(async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const activeToken = tokenRef.current
        if (!activeToken) {
          clearRunningState()
          pushError('ההתחברות פגה. התחבר מחדש כדי להמשיך מעקב אימון.')
          return
        }
        const job = await getTrainingJob(activeToken, jobId)
        setTrainingProgress(job.progress)
        if (job.status === 'completed') {
          clearRunningState()
          setTrainingProgress(100)
          setTrainingJobId(job.id)
          setTrainedDocumentIds(job.documentIds)
          setTrainingReadyAt(toDisplayDate(job.completedAt ?? job.updatedAt))
          return
        }
        if (job.status === 'failed') {
          clearRunningState()
          pushError(job.errorMessage ?? 'האימון נכשל בשרת.')
        }
      } catch (error) {
        clearRunningState()
        pushError(toErrorMessage(error))
      } finally {
        pollInFlightRef.current = false
      }
    }, TRAINING_POLL_MS)
  }
  const startModelTraining = async () => {
    if (!canTrain || !authToken) return
    clearError()
    setIsTraining(true)
    try {
      const job = await startTraining(authToken, currentDocumentIds)
      setTrainingJobId(job.id)
      setTrainingProgress(job.progress)
      setTrainingReadyAt(null)
      pollTrainingStatus(job.id)
    } catch (error) {
      clearRunningState()
      pushError(toErrorMessage(error))
    }
  }
  return {
    documents: pendingDocuments,
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
