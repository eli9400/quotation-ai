import type { Quote } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'
import { toClientProjectedQuote } from './quoteClientProjection'
import { isPercentLikeCustomField } from './quoteCustomFieldMath'

type QuoteClientViewPreviewProps = {
  quote: Quote
}

function formatPercent(value: number): string {
  const normalized = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
  return `${normalized}%`
}

function renderCustomFieldValue(
  field: Quote['customFields'][number],
  lineSubtotal: number,
): string {
  if (field.value === null || field.value === '') return '-'
  if (typeof field.value === 'boolean') return field.value ? 'כן' : 'לא'
  if (typeof field.value === 'number' && isPercentLikeCustomField(field.key, field.label)) {
    const amount = (lineSubtotal * field.value) / 100
    return `${formatPercent(field.value)} (${formatCurrencyIls(amount)})`
  }
  return String(field.value)
}

export function QuoteClientViewPreview({ quote }: QuoteClientViewPreviewProps) {
  const visibleFields = quote.customFields.filter((field) => field.showInQuoteDetails)
  const projected = toClientProjectedQuote(quote)

  return (
    <article className="quote-client-doc">
      <header className="quote-client-doc-header">
        <h3>הצעת מחיר</h3>
        <p>תאריך: {new Date(quote.generatedAt).toLocaleString('he-IL')}</p>
      </header>

      <table className="quote-client-doc-table">
        <thead>
          <tr>
            <th>תיאור</th>
            <th>יחידה</th>
            <th>כמות</th>
            <th>מחיר יחידה</th>
            <th>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          {projected.lineItems.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>{line.unit}</td>
              <td>{line.quantity}</td>
              <td>{formatCurrencyIls(line.unitPrice)}</td>
              <td>{formatCurrencyIls(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibleFields.length > 0 ? (
        <section className="quote-client-doc-extra">
          <h4>פרטים נוספים שיוצגו ללקוח</h4>
          <ul>
            {visibleFields.map((field) => (
              <li key={field.id}>
                {field.label}: {renderCustomFieldValue(field, projected.lineSubtotal)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="quote-client-doc-totals">
        {Math.abs(projected.visibleAdjustment) > 0.01 ? (
          <p>התאמות נוספות: {formatCurrencyIls(projected.visibleAdjustment)}</p>
        ) : null}
        <p>סכום ביניים: {formatCurrencyIls(projected.subtotalBeforeVat)}</p>
        <p>מע"מ ({quote.vatRate}%): {formatCurrencyIls(projected.vatAmount)}</p>
        <p>
          <strong>סה"כ לתשלום: {formatCurrencyIls(projected.estimatedPrice)}</strong>
        </p>
      </footer>
    </article>
  )
}
