import { useEffect, useMemo, useRef, useState } from 'react'
import { generateQuote } from '../features/quotation/quoteEngine'
import type { ClientRequestForm, Quote, UploadedDocument } from '../types/quotation'

const INITIAL_FORM: ClientRequestForm = {
  clientName: '',
  projectType: 'renovation',
  scope: 'medium',
  urgency: 'normal',
  requirements: '',
}

function toUploadedDocument(file: File): UploadedDocument {
  return {
    id: `${file.name}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    type: file.type || 'unknown',
    uploadedAt: new Date().toLocaleString('he-IL'),
  }
}

export function useQuotationMvp() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [isTraining, setIsTraining] = useState(false)
  const [trainingReadyAt, setTrainingReadyAt] = useState<string | null>(null)
  const [form, setForm] = useState<ClientRequestForm>(INITIAL_FORM)
  const [quote, setQuote] = useState<Quote | null>(null)
  const trainingTimerRef = useRef<number | null>(null)

  const canTrain = documents.length > 0 && !isTraining
  const modelReady = trainingProgress === 100

  useEffect(() => {
    return () => {
      if (trainingTimerRef.current !== null) {
        window.clearInterval(trainingTimerRef.current)
      }
    }
  }, [])

  const trainingStatus = useMemo(() => {
    if (isTraining) {
      return 'אימון המודל מתבצע...'
    }
    if (modelReady && trainingReadyAt) {
      return `המודל מוכן לשימוש. זמן עדכון אחרון: ${trainingReadyAt}`
    }
    return 'העלה מסמכים כדי להתחיל אימון.'
  }, [isTraining, modelReady, trainingReadyAt])

  const resetModelState = () => {
    setTrainingProgress(0)
    setTrainingReadyAt(null)
    setQuote(null)
  }

  const addDocuments = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    const nextDocuments = Array.from(files).map(toUploadedDocument)
    setDocuments((current) => [...nextDocuments, ...current])
    resetModelState()
  }

  const removeDocument = (documentId: string) => {
    setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    resetModelState()
  }

  const startTraining = () => {
    if (!canTrain) {
      return
    }

    if (trainingTimerRef.current !== null) {
      window.clearInterval(trainingTimerRef.current)
    }

    setIsTraining(true)
    setTrainingProgress(5)
    setQuote(null)

    trainingTimerRef.current = window.setInterval(() => {
      setTrainingProgress((current) => {
        const increment = Math.floor(Math.random() * 16) + 6
        const nextProgress = Math.min(current + increment, 100)
        if (nextProgress >= 100) {
          if (trainingTimerRef.current !== null) {
            window.clearInterval(trainingTimerRef.current)
          }
          trainingTimerRef.current = null
          setIsTraining(false)
          setTrainingReadyAt(new Date().toLocaleString('he-IL'))
        }
        return nextProgress
      })
    }, 450)
  }

  const updateFormField = <K extends keyof ClientRequestForm>(
    field: K,
    value: ClientRequestForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const createQuoteFromForm = () => {
    if (!modelReady) {
      return
    }

    const nextQuote = generateQuote({
      request: form,
      documentCount: documents.length,
    })
    setQuote(nextQuote)
  }

  return {
    documents,
    trainingProgress,
    trainingStatus,
    isTraining,
    canTrain,
    modelReady,
    form,
    quote,
    addDocuments,
    removeDocument,
    startTraining,
    updateFormField,
    createQuoteFromForm,
  }
}
