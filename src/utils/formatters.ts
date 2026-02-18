const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

const sizeFormatter = new Intl.NumberFormat('he-IL', {
  maximumFractionDigits: 1,
})

export function formatCurrencyIls(value: number): string {
  return currencyFormatter.format(value)
}

export function formatMegabytes(bytes: number): string {
  return `${sizeFormatter.format(bytes / 1024 / 1024)} MB`
}
