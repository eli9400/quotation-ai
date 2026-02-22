import { useMemo, useState } from 'react'
import type { ClientExtraRequestedItem, ClientLineItemOption } from '../../services/api/clientPortalApi'

type ClientRequestedItemsEditorProps = {
  options: ClientLineItemOption[]
  items: ClientExtraRequestedItem[]
  disabled: boolean
  onChange: (items: ClientExtraRequestedItem[]) => void
}

const DATALIST_ID = 'client-additional-item-options'

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function resolveOption(options: ClientLineItemOption[], inputLabel: string): ClientLineItemOption | null {
  const normalizedInput = normalizeText(inputLabel)
  if (!normalizedInput) return null
  return options.find((item) => normalizeText(item.label) === normalizedInput) ?? null
}

export function ClientRequestedItemsEditor({
  options,
  items,
  disabled,
  onChange,
}: ClientRequestedItemsEditorProps) {
  const [label, setLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const sortedOptions = useMemo(
    () => options.slice().sort((left, right) => left.label.localeCompare(right.label, 'he')),
    [options],
  )

  const handleAdd = () => {
    if (disabled) return
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return

    const matchedOption = resolveOption(sortedOptions, label)
    const nextLabel = matchedOption?.label ?? label.trim()
    if (!nextLabel) return

    const nextItem: ClientExtraRequestedItem = {
      sourceItemId: matchedOption?.sourceItemId ?? null,
      label: nextLabel,
      quantity: qty,
      unit: matchedOption?.unit,
    }

    const mergeKey = nextItem.sourceItemId
      ? `src:${nextItem.sourceItemId}`
      : `custom:${normalizeText(nextItem.label)}`
    const merged = new Map<string, ClientExtraRequestedItem>()
    items.forEach((item) => {
      const key = item.sourceItemId
        ? `src:${item.sourceItemId}`
        : `custom:${normalizeText(item.label)}`
      merged.set(key, { ...item })
    })

    const existing = merged.get(mergeKey)
    if (existing) {
      merged.set(mergeKey, { ...existing, quantity: existing.quantity + nextItem.quantity })
    } else {
      merged.set(mergeKey, nextItem)
    }

    onChange(Array.from(merged.values()))
    setLabel('')
    setQuantity('1')
  }

  return (
    <section className="client-extra-items">
      <h4>רכיבים נוספים לבקשה</h4>
      <p>הקלידו רכיב וכמות. הרשימה נטענת אוטומטית לפי נותן השירות.</p>

      <div className="client-extra-items-controls">
        <input
          list={DATALIST_ID}
          disabled={disabled}
          value={label}
          placeholder="הקלידו רכיב"
          onChange={(event) => setLabel(event.target.value)}
        />
        <datalist id={DATALIST_ID}>
          {sortedOptions.map((option) => (
            <option key={option.sourceItemId} value={option.label} />
          ))}
        </datalist>

        <input
          type="number"
          min={1}
          step={1}
          disabled={disabled}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <button type="button" className="quote-line-add" disabled={disabled} onClick={handleAdd}>
          הוספת רכיב
        </button>
      </div>

      {items.length > 0 ? (
        <div className="client-extra-items-list">
          {items.map((item, index) => (
            <div key={`${item.sourceItemId ?? item.label}-${index}`} className="client-extra-item-row">
              <span>{item.label}</span>
              <span>כמות: {item.quantity}</span>
              <button
                type="button"
                className="quote-line-remove"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              >
                הסר
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
