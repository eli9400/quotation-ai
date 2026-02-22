import { formatCurrencyIls } from '../../utils/formatters'
import type { EditableLineItem } from './quoteDetailsUtils'

type UnitOption = {
  value: string
  label: string
}

type QuoteLineItemsTableProps = {
  lineItems: EditableLineItem[]
  lineTotals: number[]
  unitOptions: UnitOption[]
  disabled?: boolean
  onLineChange: (index: number, patch: Partial<EditableLineItem>) => void
  onRemoveLine: (index: number) => void
}

export function QuoteLineItemsTable({
  lineItems,
  lineTotals,
  unitOptions,
  disabled = false,
  onLineChange,
  onRemoveLine,
}: QuoteLineItemsTableProps) {
  return (
    <div className="quote-lines-table-wrap">
      <table className="quote-lines-table">
        <colgroup>
          <col className="line-col-description" />
          <col className="line-col-unit" />
          <col className="line-col-quantity" />
          <col className="line-col-price" />
          <col className="line-col-total" />
          <col className="line-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>תיאור</th>
            <th>יחידה</th>
            <th>כמות</th>
            <th>מחיר יחידה</th>
            <th>סה"כ שורה</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line, index) => (
            <tr
              key={line.id}
              className={!line.sourceItemId && line.description.trim().length > 0 ? 'line-unknown' : undefined}
            >
              <td>
                <input
                  list="provider-line-item-options"
                  disabled={disabled}
                  value={line.description}
                  onChange={(event) => onLineChange(index, { description: event.target.value })}
                />
              </td>
              <td>
                <select
                  disabled={disabled}
                  value={line.unit}
                  onChange={(event) => onLineChange(index, { unit: event.target.value })}
                >
                  {!unitOptions.some((option) => option.value === line.unit) ? (
                    <option value={line.unit}>{line.unit || 'מותאם אישית'}</option>
                  ) : null}
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  disabled={disabled}
                  min={line.unit === 'percent' || line.unit === '%' ? undefined : 0}
                  value={line.quantity}
                  onChange={(event) => onLineChange(index, { quantity: event.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  disabled={disabled}
                  value={line.unitPrice}
                  onChange={(event) => onLineChange(index, { unitPrice: event.target.value })}
                />
              </td>
              <td>{formatCurrencyIls(lineTotals[index] ?? 0)}</td>
              <td>
                <button
                  type="button"
                  className="quote-line-remove"
                  disabled={disabled}
                  onClick={() => onRemoveLine(index)}
                >
                  הסר
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
