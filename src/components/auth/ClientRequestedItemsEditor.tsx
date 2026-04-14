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

function toCategoryId(option: ClientLineItemOption): string {
  return option.categoryId?.trim() || 'general'
}

function toCategoryLabel(option: ClientLineItemOption): string {
  const label = option.categoryLabel?.trim()
  return label && label.length > 0 ? label : 'שירותים כלליים'
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
  const [selectedCategory, setSelectedCategory] = useState('all')

  const sortedOptions = useMemo(
    () => options.slice().sort((left, right) => left.label.localeCompare(right.label, 'he')),
    [options],
  )
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    sortedOptions.forEach((option) => map.set(toCategoryId(option), toCategoryLabel(option)))
    return Array.from(map.entries())
      .map(([id, labelText]) => ({ id, label: labelText }))
      .sort((left, right) => left.label.localeCompare(right.label, 'he'))
  }, [sortedOptions])
  const filteredOptions = useMemo(() => {
    if (selectedCategory === 'all') return sortedOptions
    return sortedOptions.filter((option) => toCategoryId(option) === selectedCategory)
  }, [selectedCategory, sortedOptions])
  const groupedOptions = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        items: sortedOptions.filter((option) => toCategoryId(option) === category.id),
      })),
    [categories, sortedOptions],
  )

  const handleAdd = () => {
    if (disabled) return
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return

    const matchedOption =
      resolveOption(filteredOptions, label) ?? resolveOption(sortedOptions, label)
    const nextLabel = matchedOption?.label ?? label.trim()
    if (!nextLabel) return

    const fallbackCategory =
      selectedCategory !== 'all'
        ? categories.find((category) => category.id === selectedCategory)?.label
        : 'שירותים כלליים'

    const nextItem: ClientExtraRequestedItem = {
      sourceItemId: matchedOption?.sourceItemId ?? null,
      label: nextLabel,
      quantity: qty,
      unit: matchedOption?.unit,
      categoryId: matchedOption
        ? toCategoryId(matchedOption)
        : selectedCategory !== 'all'
          ? selectedCategory
          : 'general',
      categoryLabel: matchedOption ? toCategoryLabel(matchedOption) : fallbackCategory,
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
      <p>בחרו קטגוריה, הקלידו רכיב וכמות. הרשימה נטענת לפי נותן השירות.</p>

      <div className="client-extra-items-controls">
        <select
          disabled={disabled}
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
        >
          <option value="all">כל הקטגוריות</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <input
          list={DATALIST_ID}
          disabled={disabled}
          value={label}
          placeholder="הקלידו רכיב"
          onChange={(event) => setLabel(event.target.value)}
        />
        <datalist id={DATALIST_ID}>
          {filteredOptions.map((option) => (
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

      <div className="client-option-groups">
        {groupedOptions.map((group) => (
          <section key={group.id} className="client-option-group">
            <header>
              <strong>{group.label}</strong>
              <small>{group.items.length} רכיבים</small>
            </header>
            <div className="client-option-tags">
              {group.items.map((option) => (
                <button
                  key={option.sourceItemId}
                  type="button"
                  className={normalizeText(label) === normalizeText(option.label) ? 'active' : ''}
                  disabled={disabled}
                  onClick={() => {
                    setSelectedCategory(group.id)
                    setLabel(option.label)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {items.length > 0 ? (
        <div className="client-extra-items-list">
          {items.map((item, index) => (
            <div key={`${item.sourceItemId ?? item.label}-${index}`} className="client-extra-item-row">
              <span>{item.label}</span>
              <span>{item.categoryLabel ?? 'שירותים כלליים'}</span>
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
