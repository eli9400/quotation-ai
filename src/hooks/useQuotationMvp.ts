import { useEffect, useMemo, useRef, useState } from 'react'
import {
  generateQuote,
  getTrainingJob,
  startTraining,
  uploadDocuments,
} from '../services/api/quotationApi'
import type {
  ClientRequestForm,
  Quote,
  QuoteSource,
  UploadedDocument,
} from '../types/quotation'

const INITIAL_FORM: ClientRequestForm = {
  clientName: '',
  projectType: 'renovation',
  scope: 'medium',
  urgency: 'normal',
  requirements: '',
}
const TRAINING_POLL_MS = 850

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'אירעה שגיאה בלתי צפויה.'
}

export function useQuotationMvp() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [isTraining, setIsTraining] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false)
  const [trainingReadyAt, setTrainingReadyAt] = useState<string | null>(null)
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [form, setForm] = useState<ClientRequestForm>(INITIAL_FORM)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteSource, setQuoteSource] = useState<QuoteSource | null>(null)
  const trainingTimerRef = useRef<number | null>(null)
  const pollInFlightRef = useRef(false)

  const canTrain = documents.length > 0 && !isTraining && !isUploading
  const modelReady = trainingProgress === 100 && trainingJobId !== null

  useEffect(() => {
    return () => {
      if (trainingTimerRef.current !== null) {
        window.clearInterval(trainingTimerRef.current)
      }
    }
  }, [])

  const trainingStatus = useMemo(() => {
    if (isUploading) {
      return 'מעלה מסמכים לשרת...'
    }
    if (isTraining) {
      return 'אימון המודל מתבצע על השרת...'
    }
    if (modelReady && trainingReadyAt) {
      return `המודל מוכן לשימוש. זמן עדכון אחרון: ${trainingReadyAt}`
    }
    if (documents.length > 0) {
      return 'המסמכים הועלו. לחץ על "התחל אימון".'
    }
    return 'העלה מסמכים כדי להתחיל אימון.'
  }, [documents.length, isTraining, isUploading, modelReady, trainingReadyAt])

  const clearTrainingPolling = () => {
    if (trainingTimerRef.current !== null) {
      window.clearInterval(trainingTimerRef.current)
      trainingTimerRef.current = null
    }
  }

  const resetTrainingState = () => {
    clearTrainingPolling()
    pollInFlightRef.current = false
    setIsTraining(false)
    setTrainingProgress(0)
    setTrainingReadyAt(null)
    setTrainingJobId(null)
    setQuote(null)
    setQuoteSource(null)
  }

  const addDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    setErrorMessage(null)
    setIsUploading(true)

    try {
      const uploaded = await uploadDocuments(Array.from(files))
      resetTrainingState()
      setDocuments((current) => [...uploaded, ...current])
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const removeDocument = (documentId: string) => {
    setErrorMessage(null)
    setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    resetTrainingState()
  }

  const pollTrainingStatus = (jobId: string) => {
    clearTrainingPolling()

    trainingTimerRef.current = window.setInterval(async () => {
      if (pollInFlightRef.current) {
        return
      }

      pollInFlightRef.current = true
      try {
        const job = await getTrainingJob(jobId)
        setTrainingProgress(job.progress)

        if (job.status === 'completed') {
          clearTrainingPolling()
          setIsTraining(false)
          setTrainingReadyAt(
            new Date(job.completedAt ?? job.updatedAt).toLocaleString('he-IL'),
          )
        } else if (job.status === 'failed') {
          clearTrainingPolling()
          setIsTraining(false)
          setErrorMessage(job.errorMessage ?? 'האימון נכשל בשרת.')
        }
      } catch (error) {
        clearTrainingPolling()
        setIsTraining(false)
        setErrorMessage(getErrorMessage(error))
      } finally {
        pollInFlightRef.current = false
      }
    }, TRAINING_POLL_MS)
  }

  const startModelTraining = async () => {
    if (!canTrain) {
      return
    }

    setErrorMessage(null)
    setIsTraining(true)
    setQuote(null)
    setQuoteSource(null)

    try {
      const job = await startTraining(documents.map((doc) => doc.id))
      setTrainingJobId(job.id)
      setTrainingProgress(job.progress)
      setTrainingReadyAt(null)
      pollTrainingStatus(job.id)
    } catch (error) {
      clearTrainingPolling()
      setIsTraining(false)
      setErrorMessage(getErrorMessage(error))
    }
  }

  const updateFormField = <K extends keyof ClientRequestForm>(
    field: K,
    value: ClientRequestForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const createQuoteFromForm = async () => {
    if (!modelReady || !trainingJobId || isGeneratingQuote) {
      return
    }

    setErrorMessage(null)
    setIsGeneratingQuote(true)

    try {
      const result = await generateQuote(trainingJobId, form)
      setQuote(result.quote)
      setQuoteSource(result.source)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsGeneratingQuote(false)
    }
  }

  return {
    documents,
    trainingProgress,
    trainingStatus,
    isTraining,
    isUploading,
    isGeneratingQuote,
    canTrain,
    modelReady,
    form,
    quote,
    quoteSource,
    errorMessage,
    addDocuments,
    removeDocument,
    startTraining: startModelTraining,
    updateFormField,
    createQuoteFromForm,
  }
}
