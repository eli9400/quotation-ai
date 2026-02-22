import { useEffect, useMemo, useRef } from 'react'
import type { EditableCustomField } from './QuoteCustomFieldsEditor'
import { buildAutoQuoteText } from './quoteAutoText'
import type { EditableLineItem } from './quoteDetailsUtils'

type UseQuoteAutoTextSyncInput = {
  lineItems: EditableLineItem[]
  customFields: EditableCustomField[]
  summary: string
  assumptions: string
  summaryWasEdited: boolean
  assumptionsWereEdited: boolean
  onSync: (summary: string, assumptions: string) => void
}

export function useQuoteAutoTextSync({
  lineItems,
  customFields,
  summary,
  assumptions,
  summaryWasEdited,
  assumptionsWereEdited,
  onSync,
}: UseQuoteAutoTextSyncInput) {
  const autoText = useMemo(() => buildAutoQuoteText(lineItems, customFields), [lineItems, customFields])
  const previousAutoText = useRef(autoText)

  useEffect(() => {
    const previous = previousAutoText.current
    const shouldSyncSummary = !summaryWasEdited || !summary.trim() || summary === previous.summary
    const shouldSyncAssumptions =
      !assumptionsWereEdited || !assumptions.trim() || assumptions === previous.assumptions
    const nextSummary = shouldSyncSummary ? autoText.summary : summary
    const nextAssumptions = shouldSyncAssumptions ? autoText.assumptions : assumptions
    if (nextSummary !== summary || nextAssumptions !== assumptions) {
      onSync(
        nextSummary,
        nextAssumptions,
      )
    }
    previousAutoText.current = autoText
  }, [
    assumptions,
    assumptionsWereEdited,
    autoText,
    onSync,
    summary,
    summaryWasEdited,
  ])

  return autoText
}
