import type { Quote } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { Panel } from '../ui/Panel'

type QuoteResultPanelProps = {
  quote: Quote | null
  clientName: string
}

export function QuoteResultPanel({ quote, clientName }: QuoteResultPanelProps) {
  return (
    <Panel title="תוצאה אוטומטית" className="quote-panel">
      {!quote ? (
        <p className="empty">
          אחרי שהמודל מוכן, מלא פרטי לקוח ולחץ על "הפק הצעת מחיר אוטומטית".
        </p>
      ) : (
        <div className="quote-result">
          <p>
            <strong>לקוח:</strong> {clientName || 'לקוח חדש'}
          </p>
          <p>
            <strong>מחיר משוער:</strong> {formatCurrencyIls(quote.estimatedPrice)}
          </p>
          <p>
            <strong>זמן ביצוע משוער:</strong> {quote.estimatedDays} ימים
          </p>
          <p>
            <strong>רמת ביטחון מודל:</strong> {quote.confidence}%
          </p>
          <p className="quote-summary">{quote.summary}</p>
        </div>
      )}
    </Panel>
  )
}
