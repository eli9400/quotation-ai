import { useCallback, useEffect, useState } from 'react'
import { listQuotes } from '../services/api/quotationApi'
import type { StoredQuoteRecord } from '../types/quotation'

type UseQuoteHistoryParams = {
  authToken: string | null
  onError: (message: string) => void
}

type UseQuoteHistoryResult = {
  quoteHistory: StoredQuoteRecord[]
  isLoadingQuotes: boolean
  appendQuoteRecord: (record: StoredQuoteRecord) => void
  clearQuoteHistory: () => void
}

export function useQuoteHistory({
  authToken,
  onError,
}: UseQuoteHistoryParams): UseQuoteHistoryResult {
  const [quoteHistory, setQuoteHistory] = useState<StoredQuoteRecord[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)

  useEffect(() => {
    if (!authToken) {
      setQuoteHistory([])
      setIsLoadingQuotes(false)
      return
    }

    let isActive = true
    const loadQuotes = async () => {
      setIsLoadingQuotes(true)
      try {
        const records = await listQuotes(authToken)
        if (isActive) {
          setQuoteHistory(records)
        }
      } catch (error) {
        if (isActive) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : 'טעינת הצעות נכשלה.'
          onError(message)
        }
      } finally {
        if (isActive) {
          setIsLoadingQuotes(false)
        }
      }
    }

    void loadQuotes()
    return () => {
      isActive = false
    }
  }, [authToken, onError])

  const appendQuoteRecord = useCallback((record: StoredQuoteRecord) => {
    setQuoteHistory((current) => [record, ...current.filter((item) => item.id !== record.id)])
  }, [])

  const clearQuoteHistory = useCallback(() => {
    setQuoteHistory([])
    setIsLoadingQuotes(false)
  }, [])

  return {
    quoteHistory,
    isLoadingQuotes,
    appendQuoteRecord,
    clearQuoteHistory,
  }
}
