export type InferredPricingNumbers = {
  quantity: number
  pricePerUnit: number
  lineTotal: number
}

function tryInferFromBestFit(numbers: number[]): InferredPricingNumbers | null {
  if (numbers.length < 3) {
    return null
  }

  let best: { quantity: number; pricePerUnit: number; lineTotal: number; error: number } | null =
    null

  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = 0; j < numbers.length; j += 1) {
      for (let k = 0; k < numbers.length; k += 1) {
        if (i === j || i === k || j === k) {
          continue
        }

        const quantity = numbers[j]
        const pricePerUnit = numbers[k]
        const lineTotal = numbers[i]
        if (quantity <= 0 || pricePerUnit <= 0 || lineTotal <= 0) {
          continue
        }

        const expected = quantity * pricePerUnit
        const denom = Math.max(expected, lineTotal, 1)
        const error = Math.abs(lineTotal - expected) / denom

        if (!best || error < best.error) {
          best = { quantity, pricePerUnit, lineTotal, error }
        }
      }
    }
  }

  if (!best || best.error > 0.4) {
    return null
  }

  return {
    quantity: best.quantity,
    pricePerUnit: best.pricePerUnit,
    lineTotal: best.lineTotal,
  }
}

export function inferPricingNumbers(numbers: number[]): InferredPricingNumbers | null {
  if (numbers.length < 2) {
    return null
  }

  if (numbers.length === 2) {
    return {
      quantity: numbers[0],
      pricePerUnit: numbers[1],
      lineTotal: Number((numbers[0] * numbers[1]).toFixed(2)),
    }
  }

  if (numbers.length === 3) {
    const [a, b, c] = numbers
    const asTotalFirst = Math.abs(a - b * c) / Math.max(a, b * c, 1)
    if (asTotalFirst <= 0.08) {
      return { quantity: c, pricePerUnit: b, lineTotal: a }
    }

    const asTotalLast = Math.abs(c - a * b) / Math.max(c, a * b, 1)
    if (asTotalLast <= 0.08) {
      return { quantity: a, pricePerUnit: b, lineTotal: c }
    }
  }

  const fitted = tryInferFromBestFit(numbers)
  if (fitted) {
    return fitted
  }

  const lineTotal = Math.max(...numbers)
  const remaining = numbers.filter((value) => value !== lineTotal)
  if (remaining.length < 2) {
    return null
  }

  return {
    quantity: remaining[0],
    pricePerUnit: remaining[1],
    lineTotal,
  }
}
