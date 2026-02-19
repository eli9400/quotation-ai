import type { Quote } from '../../types/quotation'
import { formatCurrencyIls } from '../../utils/formatters'

type QuoteClientViewPreviewProps = {
  quote: Quote
}

function renderValue(value: string | number | boolean | null): string {
  if (value === null || value === '') {
    return '-'
  }
  if (typeof value === 'boolean') {
    return value ? 'כן' : 'לא'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return value
}

export function QuoteClientViewPreview({ quote }: QuoteClientViewPreviewProps) {
  const visibleFields = quote.customFields.filter((field) => field.showInQuoteDetails)

  return (
    <section className="quote-client-preview">
      <h5>תצוגת לקוח</h5>
      <div className="quote-lines-table-wrap">
        <table className="quote-lines-table">
          <thead>
            <tr><th>תיאור</th><th>יחידה</th><th>כמות</th><th>מחיר יחידה</th><th>סה"כ</th></tr>
          </thead>
          <tbody>
            {quote.lineItems.map((line) => (
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
      </div>

      {visibleFields.length > 0 ? (
        <div className="quote-client-preview-fields">
          <strong>פרטים נוספים שיוצגו ללקוח</strong>
          <ul>
            {visibleFields.map((field) => (
              <li key={field.id}>
                {field.label}: {renderValue(field.value)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p>סכום ביניים: {formatCurrencyIls(quote.subtotalBeforeVat)}</p>
      <p>מע"מ ({quote.vatRate}%): {formatCurrencyIls(quote.vatAmount)}</p>
      <p><strong>סה"כ לתשלום: {formatCurrencyIls(quote.estimatedPrice)}</strong></p>
    </section>
  )
}
