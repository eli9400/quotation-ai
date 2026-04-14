type ParseFlexibleNumberOptions = {
  allowNegative?: boolean
  allowZero?: boolean
}

function normalizeNumericText(rawValue: string): string {
  return rawValue
    .replace(/\u00A0/g, ' ')
    .replace(/[₪$€£]/g, ' ')
    .replace(/[^\d.,'`+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeThousandsSeparators(value: string): string {
  return value.replace(/[ '\u2019`]/g, '')
}

function toDecimalNormalized(value: string): string {
  const compact = removeThousandsSeparators(value)
  const hasDot = compact.includes('.')
  const hasComma = compact.includes(',')

  if (!hasDot && !hasComma) {
    return compact
  }

  if (hasDot && hasComma) {
    const lastDot = compact.lastIndexOf('.')
    const lastComma = compact.lastIndexOf(',')
    if (lastComma > lastDot) {
      return compact.replace(/\./g, '').replace(',', '.')
    }
    return compact.replace(/,/g, '')
  }

  if (hasComma) {
    const pieces = compact.split(',')
    if (pieces.length === 2 && (pieces[1].length <= 2 || pieces[1].length === 4)) {
      return `${pieces[0]}.${pieces[1]}`
    }
    return compact.replace(/,/g, '')
  }

  const pieces = compact.split('.')
  if (pieces.length === 2 && (pieces[1].length <= 2 || pieces[1].length === 4)) {
    return compact
  }
  return compact.replace(/\./g, '')
}

export function parseFlexibleNumber(
  rawValue: unknown,
  options: ParseFlexibleNumberOptions = {},
): number | null {
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      return null
    }
    if (!options.allowNegative && rawValue < 0) {
      return null
    }
    if (!options.allowZero && rawValue === 0) {
      return null
    }
    return rawValue
  }

  if (typeof rawValue !== 'string') {
    return null
  }

  const normalized = normalizeNumericText(rawValue)
  if (!normalized) {
    return null
  }

  const sign = normalized.includes('-') ? -1 : 1
  const unsigned = normalized.replace(/[+-]/g, '')
  const decimalNormalized = toDecimalNormalized(unsigned)
  if (!decimalNormalized || !/\d/.test(decimalNormalized)) {
    return null
  }

  const parsed = Number(decimalNormalized) * sign
  if (!Number.isFinite(parsed)) {
    return null
  }
  if (!options.allowNegative && parsed < 0) {
    return null
  }
  if (!options.allowZero && parsed === 0) {
    return null
  }
  return parsed
}
