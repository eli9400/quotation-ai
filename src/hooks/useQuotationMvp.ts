import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteDocument,
  extractDocumentsText,
  getLatestCompletedTrainingJob,
  getLatestRunningTrainingJob,
  getTrainingJob,
  listDocuments,
  startTraining,
  uploadDocuments,
} from '../services/api/quotationApi'
import type { DocumentValidation, TrainingJob, UploadedDocument } from '../types/quotation'
import { toTrainingStageView } from '../utils/trainingProgress'
import { useQuoteHistory } from './useQuoteHistory'

const TRAINING_POLL_MS = 850
const TOAST_AUTO_CLOSE_MS = 2000
const EXTRACT_TEXT_CHUNK_SIZE = 25

const DEFAULT_DOCUMENT_VALIDATION: DocumentValidation = {
  status: 'unchecked',
  reason: null,
  heuristicLineItems: 0,
  signalScore: 0,
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return 'שגיאה לא צפויה.'
}

function idsSignature(ids: string[]): string {
  return ids.slice().sort().join('|')
}

function toDisplayDate(value: string): string {
  return new Date(value).toLocaleString('he-IL')
}

function createValidationState(
  status: DocumentValidation['status'],
  reason: string | null = null,
): DocumentValidation {
  return {
    status,
    reason,
    heuristicLineItems: 0,
    signalScore: 0,
  }
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  if (ids.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }
  return chunks
}

function showUploadSummaryPopup(newCount: number, totalCount: number): void {
  if (totalCount <= 0) return
  if (newCount <= 0) {
    window.alert('לא נמצא קובץ חדש שלא קיים במודל. נא להעלות קבצים חדשים.')
    return
  }
  if (newCount === totalCount) {
    window.alert(`נמצאו ${newCount} קבצים חדשים מתוך ${totalCount} שהועלו.`)
    return
  }
  const duplicateCount = totalCount - newCount
  window.alert(
    `נמצאו ${newCount} קבצים חדשים מתוך ${totalCount} שהועלו. ${duplicateCount} כבר קיימים במודל.`,
  )
}

function showValidationSummaryPopup(validCount: number, corruptedCount: number): void {
  if (corruptedCount <= 0) return
  if (validCount <= 0) {
    window.alert(
      `כל ${corruptedCount} הקבצים החדשים זוהו כפגומים או לא קריאים. האימון חסום עד להסרה/החלפה שלהם.`,
    )
    return
  }
  window.alert(
    `זוהו ${corruptedCount} קבצים פגומים. האימון ירוץ רק על ${validCount} קבצים תקינים.`,
  )
}

function removeDocumentValidations(
  current: Record<string, DocumentValidation>,
  ids: string[],
): Record<string, DocumentValidation> {
  if (ids.length === 0) return current
  let changed = false
  const next = { ...current }
  ids.forEach((id) => {
    if (id in next) {
      delete next[id]
      changed = true
    }
  })
  return changed ? next : current
}

export function useQuotationMvp(authToken: string | null) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [isTraining, setIsTraining] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidatingDocuments, setIsValidatingDocuments] = useState(false)
  const [trainedDocumentIds, setTrainedDocumentIds] = useState<string[] | null>(null)
  const [trainingReadyAt, setTrainingReadyAt] = useState<string | null>(null)
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null)
  const [latestTrainingJobState, setLatestTrainingJobState] = useState<TrainingJob | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [documentValidationById, setDocumentValidationById] = useState<
    Record<string, DocumentValidation>
  >({})

  const trainingTimerRef = useRef<number | null>(null)
  const errorTimerRef = useRef<number | null>(null)
  const pollInFlightRef = useRef(false)
  const tokenRef = useRef<string | null>(authToken)

  useEffect(() => {
    tokenRef.current = authToken
  }, [authToken])

  const clearError = useCallback(() => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    setErrorMessage(null)
  }, [])

  const pushError = useCallback((message: string) => {
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
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

  const pollTrainingStatus = useCallback(
    (jobId: string) => {
      clearTrainingPolling()
      trainingTimerRef.current = window.setInterval(async () => {
        if (pollInFlightRef.current) return
        pollInFlightRef.current = true
        try {
          const activeToken = tokenRef.current
          if (!activeToken) {
            clearRunningState()
            pushError('פג תוקף החיבור. התחבר מחדש כדי להמשיך מעקב אימון.')
            return
          }
          const job = await getTrainingJob(activeToken, jobId)
          setTrainingProgress(job.progress)
          setLatestTrainingJobState(job)
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
    },
    [clearRunningState, clearTrainingPolling, pushError],
  )

  const validateUploadedDocuments = useCallback(
    async (idToken: string, documentIds: string[]) => {
      const uniqueIds = Array.from(new Set(documentIds))
      if (uniqueIds.length === 0) return

      setIsValidatingDocuments(true)
      setDocumentValidationById((current) => {
        const next = { ...current }
        uniqueIds.forEach((id) => {
          next[id] = createValidationState('checking')
        })
        return next
      })

      try {
        const extractedDocuments = []
        for (const idsChunk of chunkIds(uniqueIds, EXTRACT_TEXT_CHUNK_SIZE)) {
          extractedDocuments.push(...(await extractDocumentsText(idToken, idsChunk)))
        }

        let validCount = 0
        let corruptedCount = 0
        const nextById: Record<string, DocumentValidation> = {}

        extractedDocuments.forEach((document) => {
          const normalizedStatus =
            document.validation.status === 'corrupted' ? 'corrupted' : 'valid'
          const validation: DocumentValidation = {
            ...document.validation,
            status: normalizedStatus,
            reason: normalizedStatus === 'corrupted' ? document.validation.reason : null,
          }
          nextById[document.id] = validation
        })

        uniqueIds.forEach((id) => {
          const validation = nextById[id]
          if (!validation) {
            nextById[id] = createValidationState(
              'unchecked',
              'לא התקבל סטטוס תקינות מהשרת.',
            )
            return
          }
          if (validation.status === 'corrupted') {
            corruptedCount += 1
            return
          }
          validCount += 1
        })

        setDocumentValidationById((current) => ({
          ...current,
          ...nextById,
        }))
        showValidationSummaryPopup(validCount, corruptedCount)
      } catch (error) {
        setDocumentValidationById((current) => {
          const next = { ...current }
          uniqueIds.forEach((id) => {
            next[id] = createValidationState('unchecked', 'בדיקת התקינות נכשלה.')
          })
          return next
        })
        pushError(`בדיקת תקינות קבצים נכשלה: ${toErrorMessage(error)}`)
      } finally {
        setIsValidatingDocuments(false)
      }
    },
    [pushError],
  )

  const { quoteHistory, isLoadingQuotes, clearQuoteHistory } = useQuoteHistory({
    authToken,
    onError: pushError,
  })

  const currentDocumentIds = useMemo(() => documents.map((doc) => doc.id), [documents])
  const pendingDocuments = useMemo(() => {
    if (!trainedDocumentIds) return documents
    const trainedSet = new Set(trainedDocumentIds)
    return documents.filter((doc) => !trainedSet.has(doc.id))
  }, [documents, trainedDocumentIds])

  const pendingDocumentsWithValidation = useMemo(
    () =>
      pendingDocuments.map((document) => ({
        document,
        validation: documentValidationById[document.id] ?? DEFAULT_DOCUMENT_VALIDATION,
      })),
    [documentValidationById, pendingDocuments],
  )

  const corruptedPendingDocuments = useMemo(
    () =>
      pendingDocumentsWithValidation
        .filter((item) => item.validation.status === 'corrupted')
        .map((item) => item.document),
    [pendingDocumentsWithValidation],
  )

  const uncheckedPendingDocumentIds = useMemo(
    () =>
      pendingDocumentsWithValidation
        .filter(
          (item) => item.validation.status === 'unchecked' && item.validation.reason === null,
        )
        .map((item) => item.document.id),
    [pendingDocumentsWithValidation],
  )

  const trainablePendingDocumentIds = useMemo(
    () =>
      pendingDocumentsWithValidation
        .filter((item) => item.validation.status !== 'corrupted')
        .map((item) => item.document.id),
    [pendingDocumentsWithValidation],
  )

  const modelReady = trainedDocumentIds !== null && trainingJobId !== null
  const hasPendingTrainingChanges = useMemo(() => {
    if (documents.length === 0) return false
    if (!trainedDocumentIds) return true
    return idsSignature(currentDocumentIds) !== idsSignature(trainedDocumentIds)
  }, [currentDocumentIds, documents.length, trainedDocumentIds])

  const isDocumentProcessing = isUploading || isValidatingDocuments
  const showTrainingPanel =
    isTraining ||
    isDocumentProcessing ||
    (documents.length > 0 && (!modelReady || hasPendingTrainingChanges))
  const canTrain =
    hasPendingTrainingChanges &&
    uncheckedPendingDocumentIds.length === 0 &&
    trainablePendingDocumentIds.length > 0 &&
    !isTraining &&
    !isDocumentProcessing

  const shouldResetVisualProgress =
    !isTraining && hasPendingTrainingChanges && latestTrainingJobState?.status === 'completed'
  const trainingStages = useMemo(
    () => toTrainingStageView(shouldResetVisualProgress ? null : latestTrainingJobState),
    [latestTrainingJobState, shouldResetVisualProgress],
  )
  const displayTrainingProgress = shouldResetVisualProgress ? 0 : trainingProgress

  const corruptedPendingCount = corruptedPendingDocuments.length
  const trainablePendingCount = trainablePendingDocumentIds.length

  useEffect(
    () => () => {
      clearTrainingPolling()
      if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
    },
    [clearTrainingPolling],
  )

  useEffect(() => {
    if (!authToken) {
      clearRunningState()
      clearError()
      setDocuments([])
      setIsUploading(false)
      setIsValidatingDocuments(false)
      setTrainingProgress(0)
      setTrainedDocumentIds(null)
      setTrainingReadyAt(null)
      setTrainingJobId(null)
      setLatestTrainingJobState(null)
      setDocumentValidationById({})
      clearQuoteHistory()
      return
    }
    let active = true
    const loadInitialData = async () => {
      try {
        const [storedDocuments, latestCompletedJob, latestRunningJob] = await Promise.all([
          listDocuments(authToken),
          getLatestCompletedTrainingJob(authToken),
          getLatestRunningTrainingJob(authToken),
        ])
        if (!active) return
        setDocuments(storedDocuments)
        setDocumentValidationById({})
        if (latestRunningJob) {
          setIsTraining(true)
          setTrainingProgress(latestRunningJob.progress)
          setTrainingJobId(latestRunningJob.id)
          setLatestTrainingJobState(latestRunningJob)
          if (latestCompletedJob) {
            setTrainedDocumentIds(latestCompletedJob.documentIds)
            setTrainingReadyAt(toDisplayDate(latestCompletedJob.completedAt ?? latestCompletedJob.updatedAt))
          } else {
            setTrainedDocumentIds(null)
            setTrainingReadyAt(null)
          }
          pollTrainingStatus(latestRunningJob.id)
          return
        }
        if (!latestCompletedJob) {
          setTrainingProgress(0)
          setTrainingJobId(null)
          setTrainedDocumentIds(null)
          setTrainingReadyAt(null)
          setLatestTrainingJobState(null)
          return
        }
        setTrainingProgress(100)
        setTrainingJobId(latestCompletedJob.id)
        setLatestTrainingJobState(latestCompletedJob)
        setTrainedDocumentIds(latestCompletedJob.documentIds)
        setTrainingReadyAt(toDisplayDate(latestCompletedJob.completedAt ?? latestCompletedJob.updatedAt))
      } catch (error) {
        if (active) pushError(toErrorMessage(error))
      }
    }
    void loadInitialData()
    return () => {
      active = false
    }
  }, [authToken, clearError, clearQuoteHistory, clearRunningState, pollTrainingStatus, pushError])

  useEffect(() => {
    const existingIds = new Set(documents.map((doc) => doc.id))
    setDocumentValidationById((current) => {
      let changed = false
      const next: Record<string, DocumentValidation> = {}
      Object.entries(current).forEach(([id, validation]) => {
        if (!existingIds.has(id)) {
          changed = true
          return
        }
        next[id] = validation
      })
      return changed ? next : current
    })
  }, [documents])

  useEffect(() => {
    if (!authToken) return
    if (isValidatingDocuments || isUploading) return
    if (uncheckedPendingDocumentIds.length === 0) return
    void validateUploadedDocuments(authToken, uncheckedPendingDocumentIds)
  }, [
    authToken,
    isUploading,
    isValidatingDocuments,
    uncheckedPendingDocumentIds,
    validateUploadedDocuments,
  ])

  const trainingStatus = useMemo(() => {
    if (isUploading) return 'מעלה קבצים...'
    if (isValidatingDocuments) return 'בודק תקינות קבצים...'
    if (isTraining) return 'האימון מתבצע...'
    if (latestTrainingJobState?.status === 'failed') {
      return latestTrainingJobState.errorMessage
        ? `האימון נכשל: ${latestTrainingJobState.errorMessage}`
        : 'האימון נכשל. נסה שוב.'
    }
    if (documents.length === 0) return 'העלה מסמכים כדי להתחיל.'
    if (corruptedPendingCount > 0 && trainablePendingCount <= 0) {
      return `כל ${corruptedPendingCount} הקבצים החדשים פגומים. הסר אותם והעלה קבצים תקינים.`
    }
    if (corruptedPendingCount > 0) {
      return `יש ${trainablePendingCount} קבצים תקינים ו-${corruptedPendingCount} קבצים פגומים. האימון ירוץ רק על התקינים.`
    }
    if (uncheckedPendingDocumentIds.length > 0) {
      return `יש ${uncheckedPendingDocumentIds.length} קבצים שממתינים לבדיקת תקינות.`
    }
    if (hasPendingTrainingChanges) {
      return `יש ${pendingDocuments.length} קבצים חדשים שממתינים לאימון.`
    }
    if (modelReady && trainingReadyAt) return `המודל מעודכן. אימון אחרון: ${trainingReadyAt}`
    return 'המסמכים הועלו. לחץ על "התחל אימון".'
  }, [
    corruptedPendingCount,
    documents.length,
    hasPendingTrainingChanges,
    isTraining,
    isUploading,
    isValidatingDocuments,
    latestTrainingJobState,
    modelReady,
    pendingDocuments.length,
    trainablePendingCount,
    uncheckedPendingDocumentIds.length,
    trainingReadyAt,
  ])

  const addDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!authToken) {
      pushError('יש להתחבר לפני העלאת מסמכים.')
      return
    }

    const fileList = Array.from(files)
    const totalUploadedCount = fileList.length
    clearError()

    let uploaded: UploadedDocument[] = []
    setIsUploading(true)
    try {
      uploaded = await uploadDocuments(authToken, fileList)
      if (uploaded.length > 0) {
        setDocuments((current) => [...uploaded, ...current])
      }
      showUploadSummaryPopup(uploaded.length, totalUploadedCount)
    } catch (error) {
      pushError(toErrorMessage(error))
      return
    } finally {
      setIsUploading(false)
    }

    if (uploaded.length > 0) {
      await validateUploadedDocuments(
        authToken,
        uploaded.map((document) => document.id),
      )
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
      setDocumentValidationById((current) => removeDocumentValidations(current, [documentId]))
    } catch (error) {
      pushError(toErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const clearDocuments = async () => {
    if (!authToken) {
      pushError('יש להתחבר לפני ניקוי מסמכים.')
      return
    }
    const idsToDelete = pendingDocuments.map((doc) => doc.id)
    if (idsToDelete.length === 0) return
    clearError()
    setIsUploading(true)
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((documentId) => deleteDocument(authToken, documentId)),
      )
      const deletedIds = new Set<string>()
      let failedCount = 0
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          deletedIds.add(result.value)
          return
        }
        failedCount += 1
      })
      if (deletedIds.size > 0) {
        const deletedList = Array.from(deletedIds)
        setDocuments((current) => current.filter((doc) => !deletedIds.has(doc.id)))
        setDocumentValidationById((current) => removeDocumentValidations(current, deletedList))
      }
      if (failedCount > 0) {
        pushError(
          failedCount === idsToDelete.length
            ? 'ניקוי הקבצים נכשל. נסה שוב.'
            : `ניקוי חלקי בוצע. ${failedCount} קבצים לא נמחקו.`,
        )
      }
    } catch (error) {
      pushError(toErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const startModelTraining = async () => {
    if (!authToken || !canTrain) return
    const documentIdsForTraining = trainablePendingDocumentIds
    if (documentIdsForTraining.length === 0) {
      pushError('אין קבצים תקינים לאימון. הסר קבצים פגומים ונסה שוב.')
      return
    }
    clearError()
    setIsTraining(true)
    try {
      const job = await startTraining(authToken, documentIdsForTraining)
      setTrainingJobId(job.id)
      setTrainingProgress(job.progress)
      setLatestTrainingJobState(job)
      setTrainingReadyAt(null)
      pollTrainingStatus(job.id)
    } catch (error) {
      clearRunningState()
      pushError(toErrorMessage(error))
    }
  }

  return {
    documents: pendingDocuments,
    trainingProgress: displayTrainingProgress,
    trainingStatus,
    trainingStages,
    isTraining,
    isUploading,
    isValidatingDocuments,
    canTrain,
    modelReady,
    showTrainingPanel,
    quoteHistory,
    isLoadingQuotes,
    errorMessage,
    documentValidationById,
    addDocuments,
    removeDocument,
    clearDocuments,
    startTraining: startModelTraining,
  }
}
