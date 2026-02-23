import { categorizeProviderLineItem } from './provider-line-item-categories.service.js'
import { listExcludedProviderLineItemIds } from './provider-line-item-exclusions.service.js'
import { getCatalogLineItemsForIndustry } from './provider-line-items.catalog.js'
import { isSoftNearDuplicateName } from './provider-line-items-duplicates.service.js'
import { listProviderLineItemDisplayOverridesMap } from './provider-line-item-overrides.service.js'
import { listProviderPricingItemsWithIndustryBaseline, type ProviderPricingItem } from './pricing-items-source.service.js'
import { getServiceProviderIndustryMeta } from './service-provider-industries.service.js'
import { getServiceProviderByUid } from './service-providers.service.js'
import type { PricingUnit } from '../types/model-profile.js'

export type ProviderLineItemSourceType = 'provider' | 'industry' | 'catalog'

export type ProviderLineItemOption = {
  id: string
  label: string
  canonicalName: string
  clientLabel: string
  categoryId: string
  categoryLabel: string
  unit: PricingUnit
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
  isProviderOnly: boolean
  visibleToClient: boolean
  sourceType: ProviderLineItemSourceType
}

const SOURCE_PRIORITY: Record<ProviderLineItemSourceType, number> = {
  provider: 3,
  industry: 2,
  catalog: 1,
}

const PROVIDER_ONLY_PATTERNS = [
  /vat/i,
  /total/i,
  /subtotal/i,
  /payment/i,
  /advance/i,
  /discount/i,
  /management/i,
  /percent/i,
]

const CLIENT_UNITS = new Set<PricingUnit>(['sqm', 'unit', 'point', 'container', 'package', 'meter'])

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
  canonicalName: string,
  unit: PricingUnit,
  sourceType: ProviderLineItemSourceType,
): string {
  const normalizedName = normalizeForKey(canonicalName)
  const exactKey = `${normalizedName}|${unit}`
  if (grouped.has(exactKey)) return exactKey
  for (const key of grouped.keys()) {
    const separatorIndex = key.lastIndexOf('|')
    if (separatorIndex <= 0) continue
    const groupedName = key.slice(0, separatorIndex)
    const groupedUnit = key.slice(separatorIndex + 1) as PricingUnit
    if (groupedUnit !== unit) continue
    const groupedOption = grouped.get(key)
    if (!groupedOption) continue
    if (isNearDuplicateName(groupedName, normalizedName)) return key
    if (
      isSoftNearDuplicateName(
        canonicalName,
        groupedOption.canonicalName,
        sourceType,
        groupedOption.sourceType,
      )
    ) {
      return key
    }
  }
  return exactKey
}

function isProviderOnly(unit: PricingUnit, label: string): boolean {
  if (!CLIENT_UNITS.has(unit)) return true
  return PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label))
}

function resolveDisplayUnit(unit: PricingUnit, label: string): PricingUnit {
  if (unit === 'unknown' && !PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label))) {
    return 'unit'
  }
  return unit
}

function buildDisplayLabel(label: string, unit: PricingUnit): string {
  return `${normalizeLabel(label)} (${unit})`
}

function toPricingOption(item: ProviderPricingItem): ProviderLineItemOption {
  const primaryAlias = item.aliases?.find((value) => value.trim().length > 0)
  const canonicalName = normalizeLabel(primaryAlias || item.canonicalName)
  const displayUnit = resolveDisplayUnit(item.unit, canonicalName)
  const providerOnly = isProviderOnly(displayUnit, canonicalName)
  return {
    id: item.id,
    label: buildDisplayLabel(canonicalName, displayUnit),
    canonicalName,
    clientLabel: canonicalName,
    categoryId: 'general',
    categoryLabel: 'שירותים כלליים',
    unit: displayUnit,
    aliases: item.aliases ?? [],
    sampleLines: item.sampleLines,
    quantityPriceSamples: item.quantityPriceSamples ?? [],
    isProviderOnly: providerOnly,
    visibleToClient: !providerOnly,
    sourceType: item.sourceType,
  }
}

function toCatalogOptions(industry: string, industryLabel: string, categoryId: string): ProviderLineItemOption[] {
  return getCatalogLineItemsForIndustry(industry, industryLabel, categoryId).map((item) => {
    const canonicalName = normalizeLabel(item.name)
    const displayUnit = resolveDisplayUnit(item.unit, canonicalName)
    const providerOnly = isProviderOnly(displayUnit, canonicalName)
    return {
      id: `catalog_${categoryId}_${item.key}`,
      label: buildDisplayLabel(canonicalName, displayUnit),
      canonicalName,
      clientLabel: canonicalName,
      categoryId: 'general',
      categoryLabel: 'שירותים כלליים',
      unit: displayUnit,
      aliases: item.aliases ?? [],
      sampleLines: 0,
      quantityPriceSamples: [],
      isProviderOnly: providerOnly,
      visibleToClient: !providerOnly,
      sourceType: 'catalog',
    }
  })
}

function pickPreferredOption(current: ProviderLineItemOption, next: ProviderLineItemOption): ProviderLineItemOption {
  const currentPriority = SOURCE_PRIORITY[current.sourceType]
  const nextPriority = SOURCE_PRIORITY[next.sourceType]
  if (nextPriority > currentPriority) return next
  if (nextPriority < currentPriority) return current
  if (next.sampleLines > current.sampleLines) return next
  return current
}

function dedupeOptions(options: ProviderLineItemOption[]): ProviderLineItemOption[] {
  const grouped = new Map<string, ProviderLineItemOption>()
  options.forEach((option) => {
    const key = findGroupedKey(grouped, option.canonicalName, option.unit, option.sourceType)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, option)
      return
    }
    const preferred = pickPreferredOption(existing, option)
    const aliases = Array.from(new Set([...existing.aliases, ...option.aliases])).filter(Boolean)
    const quantityPriceSamples = [...existing.quantityPriceSamples, ...option.quantityPriceSamples]
    grouped.set(key, {
      ...preferred,
      aliases,
      sampleLines: Math.max(existing.sampleLines, option.sampleLines),
      quantityPriceSamples,
    })
  })
  return Array.from(grouped.values())
}

function applyDisplayOverrides(
  options: ProviderLineItemOption[],
  overrides: Map<string, { customLabel: string | null; hiddenFromClient: boolean }>,
): ProviderLineItemOption[] {
  return options.map((option) => {
    const override = overrides.get(option.id)
    const customLabel = normalizeLabel(override?.customLabel ?? '') || option.canonicalName
    const visibleToClient = !option.isProviderOnly && !(override?.hiddenFromClient ?? false)
    return { ...option, clientLabel: customLabel, visibleToClient }
  })
}

function assignCategories(options: ProviderLineItemOption[], industry: string, categoryId: string): ProviderLineItemOption[] {
  return options.map((option) => {
    const category = categorizeProviderLineItem({
      industry,
      categoryId,
      canonicalName: option.canonicalName,
      unit: option.unit,
      isProviderOnly: option.isProviderOnly,
    })
    return { ...option, categoryId: category.id, categoryLabel: category.label }
  })
}

export async function listProviderLineItemOptions(serviceProviderUid: string): Promise<ProviderLineItemOption[]> {
  const profile = await getServiceProviderByUid(serviceProviderUid)
  const industryMeta = getServiceProviderIndustryMeta(profile?.industry)
  const [pricingItems, overrides, excludedItemIds] = await Promise.all([
    listProviderPricingItemsWithIndustryBaseline(serviceProviderUid, industryMeta.value),
    listProviderLineItemDisplayOverridesMap(serviceProviderUid),
    listExcludedProviderLineItemIds(serviceProviderUid),
  ])
  const merged = dedupeOptions([
    ...pricingItems.map(toPricingOption),
    ...toCatalogOptions(industryMeta.value, industryMeta.label, industryMeta.categoryId),
  ])
  return assignCategories(applyDisplayOverrides(merged, overrides), industryMeta.value, industryMeta.categoryId)
    .filter((item) => !excludedItemIds.has(item.id))
    .filter((item) => item.canonicalName.length > 0)
    .sort((left, right) => {
      if (right.sampleLines !== left.sampleLines) return right.sampleLines - left.sampleLines
      const priorityDelta = SOURCE_PRIORITY[right.sourceType] - SOURCE_PRIORITY[left.sourceType]
      if (priorityDelta !== 0) return priorityDelta
      return left.label.localeCompare(right.label, 'he')
    })
}
