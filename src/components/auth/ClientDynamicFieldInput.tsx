import type { VehicleCatalogOption } from '../../services/api/clientPortalApi'
import type { FormPreviewField } from '../../types/quotation'

type ClientDynamicFieldInputProps = {
  field: FormPreviewField
  value: string
  disabled: boolean
  manufacturerOptions: VehicleCatalogOption[]
  modelOptions: VehicleCatalogOption[]
  trimOptions: VehicleCatalogOption[]
  onChange: (value: string) => void
}

const MODEL_DATALIST_ID = 'vehicle-model-options'
const TRIM_DATALIST_ID = 'vehicle-trim-options'
const MAX_DATALIST_ITEMS = 60
const MAX_MANUFACTURER_DROPDOWN_ITEMS = 160
const SELECT_PLACEHOLDER = '\u05d1\u05d7\u05e8\u05d5'
const MANUFACTURER_SELECT_PLACEHOLDER =
  '\u05d1\u05d7\u05e8\u05d5 \u05d9\u05e6\u05e8\u05df \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4'
const TRIM_SELECT_PLACEHOLDER =
  '\u05d1\u05d7\u05e8\u05d5 \u05d2\u05e8\u05e1\u05d4/\u05e8\u05de\u05ea \u05d2\u05d9\u05de\u05d5\u05e8'

function isVehicleMakeField(field: FormPreviewField): boolean {
  return field.id === 'intake_vehicleBrand'
}

function isVehicleModelField(field: FormPreviewField): boolean {
  return field.id === 'intake_vehicleModel'
}

function isVehicleTrimField(field: FormPreviewField): boolean {
  return field.id === 'intake_vehicleTrim'
}

function includesMatch(options: VehicleCatalogOption[], value: string): VehicleCatalogOption[] {
  if (!value) return options
  const normalized = value.toLowerCase()
  return options.filter((option) => option.label.toLowerCase().includes(normalized))
}

export function ClientDynamicFieldInput({
  field,
  value,
  disabled,
  manufacturerOptions,
  modelOptions,
  trimOptions,
  onChange,
}: ClientDynamicFieldInputProps) {
  const trimmedValue = value.trim()
  const normalizedValue = trimmedValue.toLowerCase()

  const makeMatches = (candidate: string): boolean =>
    candidate.toLowerCase().startsWith(normalizedValue) ||
    candidate.toLowerCase().includes(normalizedValue)

  const filteredManufacturers = manufacturerOptions
    .filter((option) => normalizedValue.length === 0 || makeMatches(option.label))
    .slice(0, MAX_MANUFACTURER_DROPDOWN_ITEMS)

  const filteredModels = includesMatch(modelOptions, normalizedValue).slice(0, MAX_DATALIST_ITEMS)
  const filteredTrims = includesMatch(trimOptions, normalizedValue).slice(0, MAX_DATALIST_ITEMS)

  const selectedManufacturerValue = manufacturerOptions.some((option) => option.label === trimmedValue)
    ? trimmedValue
    : ''

  const selectedTrimValue = trimOptions.some((option) => option.label === trimmedValue)
    ? trimmedValue
    : ''

  return (
    <label key={field.id}>
      {field.label}
      {field.required ? ' *' : ''}
      {field.type === 'textarea' ? (
        <textarea
          rows={4}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? ''}
        />
      ) : field.type === 'select' ? (
        <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">{SELECT_PLACEHOLDER}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : isVehicleMakeField(field) ? (
        <>
          <select
            value={selectedManufacturerValue}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{MANUFACTURER_SELECT_PLACEHOLDER}</option>
            {filteredManufacturers.map((option) => (
              <option key={option.value} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder ?? 'Toyota / Hyundai / Kia'}
          />
        </>
      ) : isVehicleTrimField(field) ? (
        <>
          <input
            list={TRIM_DATALIST_ID}
            type="text"
            value={selectedTrimValue || value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder ?? TRIM_SELECT_PLACEHOLDER}
          />
          <datalist id={TRIM_DATALIST_ID}>
            {filteredTrims.map((option) => (
              <option key={option.value} value={option.label} />
            ))}
          </datalist>
        </>
      ) : isVehicleModelField(field) ? (
        <>
          <input
            list={MODEL_DATALIST_ID}
            type="text"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder ?? ''}
          />
          <datalist id={MODEL_DATALIST_ID}>
            {filteredModels.map((option) => (
              <option key={option.value} value={option.label} />
            ))}
          </datalist>
        </>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          min={field.type === 'number' ? 0 : undefined}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? ''}
        />
      )}
    </label>
  )
}
