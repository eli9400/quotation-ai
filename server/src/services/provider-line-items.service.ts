import { listLearnedPricingItems } from './dynamic-form-schema.service.js'
import { getCatalogLineItemsForIndustry } from './provider-line-items.catalog.js'
import {
  getServiceProviderIndustryMeta,
} from './service-provider-industries.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { PricingUnit } from '../types/model-profile.js'

export type ProviderLineItemOption = {
  id: string
  label: string
  canonicalName: string
  unit: PricingUnit
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
  isProviderOnly: boolean
}

const PROVIDER_ONLY_PATTERNS = [
  /מע["״׳]?מ/i,
  /vat/i,
  /סה["״׳]?כ/i,
  /total/i,
  /subtotal/i,
  /תנאי תשלום/i,
  /מקדמה/i,
  /יתרה/i,
  /הנחה/i,
  /discount/i,
  /תכנון\/?ניהול/i,
  /ניהול פרויקט/i,
  /אחוז/i,
  /percent/i,
]

const CLIENT_UNITS = new Set<PricingUnit>([
  'sqm',
  'unit',
  'point',
  'container',
  'package',
  'meter',
])

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim()
}

function normalizeForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[+/_-]+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNearDuplicateName(left: string, right: string): boolean {
  if (!left || !right || left === right) return false
  const leftWords = left.split(' ').filter((word) => word.length > 0)
  const rightWords = right.split(' ').filter((word) => word.length > 0)
  if (leftWords.length < 2 || rightWords.length < 2) return false

  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  if (shorter.length >= 8 && longer.includes(shorter)) return true

  const rightSet = new Set(rightWords)
  const intersection = leftWords.filter((word) => rightSet.has(word)).length
  const minWords = Math.min(leftWords.length, rightWords.length)
  return intersection >= minWords && Math.abs(leftWords.length - rightWords.length) <= 1
}

function findGroupedKey(
  grouped: Map<string, ProviderLineItemOption>,
  normalizedName: string,
  unit: PricingUnit,
): string {
  const exactKey = `${normalizedName}|${unit}`
  if (grouped.has(exactKey)) return exactKey
  for (const key of grouped.keys()) {
    const separatorIndex = key.lastIndexOf('|')
    if (separatorIndex <= 0) continue
    const groupedName = key.slice(0, separatorIndex)
    const groupedUnit = key.slice(separatorIndex + 1) as PricingUnit
    if (groupedUnit !== unit) continue
    if (isNearDuplicateName(groupedName, normalizedName)) return key
  }
  return exactKey
}

function isProviderOnly(unit: PricingUnit, label: string): boolean {
  if (!CLIENT_UNITS.has(unit)) return true
  return PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label))
}

function buildDisplayLabel(label: string, unit: PricingUnit): string {
  return `${normalizeLabel(label)} (${unit})`
}

function toLearnedOption(item: Awaited<ReturnType<typeof listLearnedPricingItems>>[number]): ProviderLineItemOption {
  const primaryAlias = item.aliases?.find((value) => value.trim().length > 0)
  const canonicalName = normalizeLabel(primaryAlias || item.canonicalName)
  return {
    id: item.id,
    label: buildDisplayLabel(canonicalName, item.unit),
    canonicalName,
    unit: item.unit,
    aliases: item.aliases ?? [],
    sampleLines: item.sampleLines,
    quantityPriceSamples: item.quantityPriceSamples ?? [],
    isProviderOnly: isProviderOnly(item.unit, canonicalName),
  }
}

function toCatalogOptions(industry: string | null | undefined): ProviderLineItemOption[] {
  const industryMeta = getServiceProviderIndustryMeta(industry)
  const items = getCatalogLineItemsForIndustry(
    industryMeta.value,
    industryMeta.label,
    industryMeta.categoryId,
  )
  return items.map((item) => {
    const canonicalName = normalizeLabel(item.name)
    return {
      id: `catalog_${industryMeta.categoryId}_${item.key}`,
      label: buildDisplayLabel(canonicalName, item.unit),
      canonicalName,
      unit: item.unit,
      aliases: item.aliases ?? [],
      sampleLines: 0,
      quantityPriceSamples: [],
      isProviderOnly: isProviderOnly(item.unit, canonicalName),
    }
  })
}

function dedupeOptions(options: ProviderLineItemOption[]): ProviderLineItemOption[] {
  const grouped = new Map<string, ProviderLineItemOption>()
  options.forEach((option) => {
    const normalizedName = normalizeForKey(option.canonicalName)
    const key = findGroupedKey(grouped, normalizedName, option.unit)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, option)
      return
    }

    const aliases = Array.from(new Set([...existing.aliases, ...option.aliases])).filter(Boolean)
    const quantityPriceSamples = [...existing.quantityPriceSamples, ...option.quantityPriceSamples]
    const sampleLines = existing.sampleLines + option.sampleLines
    if (option.sampleLines > existing.sampleLines) {
      grouped.set(key, { ...option, aliases, sampleLines, quantityPriceSamples })
      return
    }
    grouped.set(key, { ...existing, aliases, sampleLines, quantityPriceSamples })
  })
  return Array.from(grouped.values())
}

export async function listProviderLineItemOptions(
  serviceProviderUid: string,
): Promise<ProviderLineItemOption[]> {
  const [learnedItems, profile] = await Promise.all([
    listLearnedPricingItems(serviceProviderUid),
    getServiceProviderByUid(serviceProviderUid),
  ])

  const merged = dedupeOptions([
    ...learnedItems.map(toLearnedOption),
    ...toCatalogOptions(profile?.industry),
  ])

  return merged
    .filter((item) => item.canonicalName.length > 0)
    .sort((left, right) => right.sampleLines - left.sampleLines || left.label.localeCompare(right.label, 'he'))
}
