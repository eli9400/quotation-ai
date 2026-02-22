import { useEffect } from 'react'
import type { Quote } from '../../types/quotation'
import { PrimaryButton } from '../ui/PrimaryButton'
import { QuoteClientViewPreview } from './QuoteClientViewPreview'

type QuotePreviewModalProps = {
  open: boolean
  clientName: string
  quote: Quote
  onClose: () => void
}

export function QuotePreviewModal({
  open,
  clientName,
  quote,
  onClose,
}: QuotePreviewModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="quote-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label="תצוגת PDF להצעת מחיר"
      onClick={onClose}
    >
      <div className="quote-preview-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="quote-preview-header">
          <div>
            <h4>תצוגת הצעת מחיר ללקוח</h4>
            <p>לקוח: {clientName || 'ללא שם'}</p>
          </div>
          <div className="quote-preview-actions">
            <PrimaryButton type="button" onClick={() => window.print()}>
              הדפס/שמור כ-PDF
            </PrimaryButton>
            <PrimaryButton type="button" onClick={onClose}>
              סגור
            </PrimaryButton>
          </div>
        </header>

        <div className="quote-preview-body">
          <QuoteClientViewPreview quote={quote} />
        </div>
      </div>
    </div>
  )
}
