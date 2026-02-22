const COMMON_TRIMS = [
  'Base',
  'Standard',
  'Active',
  'Urban',
  'Comfort',
  'Style',
  'Executive',
  'Premium',
  'Luxury',
  'Sport',
  'GT',
  'Performance',
  'Limited',
  'Elite',
  'Prestige',
  'SE',
  'SX',
  'EX',
  'LX',
  'GL',
  'GLI',
  'GLX',
  'XLE',
  'XSE',
  'AMG',
  'M Sport',
  'N Line',
  'RS',
  'S Line',
  'FR',
  'Cupra',
  'Trendline',
  'Comfortline',
  'Highline',
] as const

const MAKE_SPECIFIC_TRIMS: Record<string, readonly string[]> = {
  TOYOTA: ['Sun', 'Sol', 'Luna', 'GLI', 'XLE', 'XSE', 'Adventure', 'Limited'],
  HYUNDAI: ['Inspire', 'Prime', 'Prestige', 'Supreme', 'N Line'],
  KIA: ['LX', 'EX', 'GT Line', 'Premium'],
  MAZDA: ['Comfort', 'Dynamic', 'Luxury', 'Pure'],
  SKODA: ['Ambition', 'Style', 'Selection', 'RS'],
  VOLKSWAGEN: ['Trendline', 'Comfortline', 'Highline', 'R-Line'],
  SEAT: ['Reference', 'Style', 'FR'],
  CUPRA: ['VZ', 'VZ5'],
  BMW: ['Advantage', 'Luxury', 'M Sport'],
  'MERCEDES-BENZ': ['Progressive', 'Premium', 'AMG Line'],
  AUDI: ['Design', 'Luxury', 'S Line', 'RS'],
  TESLA: ['Rear-Wheel Drive', 'Long Range', 'Performance'],
  FORD: ['Trend', 'Titanium', 'ST Line'],
  PEUGEOT: ['Active', 'Allure', 'GT'],
  RENAULT: ['Evolution', 'Techno', 'Iconic'],
  NISSAN: ['Visia', 'Acenta', 'Tekna'],
  HONDA: ['Comfort', 'Elegance', 'Advance'],
  MITSUBISHI: ['Invite', 'Premium', 'Ultimate'],
  SUZUKI: ['GL', 'GLX'],
}

function normalizeMakeKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function toUniqueInOrder(values: Iterable<string>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    output.push(value)
  }
  return output
}

function resolveSpecificTrims(make: string): readonly string[] {
  const normalized = normalizeMakeKey(make)
  const entry = Object.entries(MAKE_SPECIFIC_TRIMS).find(
    ([candidate]) => normalizeMakeKey(candidate) === normalized,
  )
  return entry?.[1] ?? []
}

export function listPreferredVehicleTrims(make?: string | null): string[] {
  const specific = make ? resolveSpecificTrims(make) : []
  return toUniqueInOrder([...specific, ...COMMON_TRIMS])
}
