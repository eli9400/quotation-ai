import { useMemo, useState } from 'react'
import type { ProviderLineItemOption } from '../../types/quotation'
import {
  findLineItemOptionById,
  findLineItemOptionByText,
  listProviderOnlyOptions,
} from './providerLineItemOptions'

type QuoteLineItemPickerProps = {
  options: ProviderLineItemOption[]
  disabled: boolean
  onAdd: (option: ProviderLineItemOption | null, customLabel: string) => void
}

const EMPTY_OPTION = '__custom__'
const OPTIONS_DATALIST_ID = 'provider-line-item-options'

export function QuoteLineItemPicker({ options, disabled, onAdd }: QuoteLineItemPickerProps) {
  const [selectedOptionId, setSelectedOptionId] = useState(EMPTY_OPTION)
  const [searchValue, setSearchValue] = useState('')
  const providerOnlyOptions = useMemo(() => listProviderOnlyOptions(options), [options])

  const resolveSelectedOption = (): ProviderLineItemOption | null => {
    if (selectedOptionId !== EMPTY_OPTION) {
      return findLineItemOptionById(options, selectedOptionId)
    }
    if (searchValue.trim().length > 0) {
      return findLineItemOptionByText(options, searchValue) ?? null
    }
    return null
  }

  const addLineItem = () => {
    if (disabled) return
    const option = resolveSelectedOption()
    const label = option?.canonicalName ?? searchValue.trim()
    if (!option && !label) return
    onAdd(option, label)
    setSelectedOptionId(EMPTY_OPTION)
    setSearchValue('')
  }

  return (
    <div className="quote-line-picker">
      <label>
        רכיב פנימי (נותן שירות בלבד)
        <select
          value={selectedOptionId}
          disabled={disabled}
          onChange={(event) => setSelectedOptionId(event.target.value)}
        >
          <option value={EMPTY_OPTION}>בחירה מהרשימה</option>
          {providerOnlyOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        חיפוש/אוטו־קומפליט רכיב
        <input
          list={OPTIONS_DATALIST_ID}
          value={searchValue}
          disabled={disabled}
          placeholder="הקלד תיאור רכיב"
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </label>
      <datalist id={OPTIONS_DATALIST_ID}>
        {options.map((item) => (
          <option key={item.id} value={item.canonicalName}>
            {item.label}
          </option>
        ))}
      </datalist>

      <button type="button" className="quote-line-add" disabled={disabled} onClick={addLineItem}>
        הוסף רכיב
      </button>
    </div>
  )
}
