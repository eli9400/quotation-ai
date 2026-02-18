import type { Quote, QuoteSource } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { Panel } from '../ui/Panel'

type QuoteResultPanelProps = {
  quote: Quote | null
  quoteSource: QuoteSource | null
  clientName: string
}

const SOURCE_LABEL: Record<QuoteSource, string> = {
  openai: 'OpenAI',
  fallback: 'Fallback',
}

export function QuoteResultPanel({
  quote,
  quoteSource,
  clientName,
}: QuoteResultPanelProps) {
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
          {quoteSource ? (
            <p>
              <strong>מקור:</strong> {SOURCE_LABEL[quoteSource]}
            </p>
          ) : null}
          <p className="quote-summary">{quote.summary}</p>
          {quote.assumptions.length > 0 ? (
            <ul className="assumptions-list">
              {quote.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
