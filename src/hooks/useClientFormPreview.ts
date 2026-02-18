import { useEffect, useState } from 'react'
import { getFormPreviewSchema } from '../services/api/quotationApi'
import type { FormPreviewSchema } from '../types/quotation'

type UseClientFormPreviewResult = {
  schema: FormPreviewSchema | null
  isLoading: boolean
  errorMessage: string | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'טעינת תצוגת הטופס נכשלה.'
}

export function useClientFormPreview(
  authToken: string | null,
  refreshSignal: string | number | boolean | null = null,
): UseClientFormPreviewResult {
  const [schema, setSchema] = useState<FormPreviewSchema | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!authToken) {
      setSchema(null)
      setIsLoading(false)
      setErrorMessage(null)
      return
    }

    let active = true
    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const payload = await getFormPreviewSchema(authToken)
        if (active) {
          setSchema(payload)
        }
      } catch (error) {
        if (active) {
          setSchema(null)
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [authToken, refreshSignal])

  return {
    schema,
    isLoading,
    errorMessage,
  }
}
