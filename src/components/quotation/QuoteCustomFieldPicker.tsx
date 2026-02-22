import { useMemo, useState } from 'react'
import type { ProviderCustomFeatureOption } from '../../types/quotation'
import { findProviderCustomFeatureByText } from './providerCustomFieldOptions'

type QuoteCustomFieldPickerProps = {
  options: ProviderCustomFeatureOption[]
  disabled: boolean
  onAdd: (feature: ProviderCustomFeatureOption | null, customLabel: string) => void
}

const EMPTY_OPTION = '__custom_feature__'
const DATALIST_ID = 'provider-custom-feature-options'

export function QuoteCustomFieldPicker({
  options,
  disabled,
  onAdd,
}: QuoteCustomFieldPickerProps) {
  const [selectedOptionId, setSelectedOptionId] = useState(EMPTY_OPTION)
  const [searchValue, setSearchValue] = useState('')
  const sortedOptions = useMemo(
    () => options.slice().sort((left, right) => left.label.localeCompare(right.label, 'he')),
    [options],
  )

  const resolveSelectedFeature = (): ProviderCustomFeatureOption | null => {
    if (selectedOptionId !== EMPTY_OPTION) {
      return sortedOptions.find((option) => option.id === selectedOptionId) ?? null
    }
    if (searchValue.trim().length > 0) {
      return findProviderCustomFeatureByText(sortedOptions, searchValue)
    }
    return null
  }

  const addFeature = () => {
    if (disabled) return
    const feature = resolveSelectedFeature()
    const label = feature?.label ?? searchValue.trim()
    if (!feature && !label) return
    onAdd(feature, label)
    setSelectedOptionId(EMPTY_OPTION)
    setSearchValue('')
  }

  return (
    <div className="quote-line-picker">
      <label>
        שדה דינמי מתוך מאגר
        <select
          value={selectedOptionId}
          disabled={disabled}
          onChange={(event) => setSelectedOptionId(event.target.value)}
        >
          <option value={EMPTY_OPTION}>בחירה מהרשימה</option>
          {sortedOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        חיפוש/אוטו־קומפליט שדה דינמי
        <input
          list={DATALIST_ID}
          value={searchValue}
          disabled={disabled}
          placeholder="הקלד שם שדה דינמי"
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </label>
      <datalist id={DATALIST_ID}>
        {sortedOptions.map((option) => (
          <option key={option.id} value={option.label}>
            {option.key}
          </option>
        ))}
      </datalist>

      <button type="button" className="quote-line-add" disabled={disabled} onClick={addFeature}>
        הוסף שדה דינמי
      </button>
    </div>
  )
}
