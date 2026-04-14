export type QuoteLineMathInput = {
  quantity: number
  unitPrice: number
  unit: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function isPercentLineUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase()
  return normalized === '%' || normalized === 'percent' || normalized === 'pct'
}

function computeRegularLineTotal(line: QuoteLineMathInput): number {
  return round2(line.quantity * line.unitPrice)
}

export function computeLineTotals(lines: QuoteLineMathInput[]): number[] {
  const safeLines = lines.map((line) => ({
    quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
    unit: line.unit,
  }))
  const baseSubtotal = round2(
    safeLines.reduce((sum, line) => {
      if (isPercentLineUnit(line.unit)) {
        return sum
      }
      return sum + computeRegularLineTotal(line)
    }, 0),
  )

  return safeLines.map((line) => {
    if (isPercentLineUnit(line.unit)) {
      return round2((baseSubtotal * line.quantity * line.unitPrice) / 100)
    }
    return computeRegularLineTotal(line)
  })
}
