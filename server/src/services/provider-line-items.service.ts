import { categorizeProviderLineItem, resolveDynamicCategoryForLineItem } from './provider-line-item-categories.service.js'
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
  isCategoryOverridden: boolean
  unit: PricingUnit
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
  isProviderOnly: boolean
  visibleToClient: boolean
  sourceType: ProviderLineItemSourceType
}

type LineItemOverride = {
  customLabel: string | null
  hiddenFromClient: boolean
  customCategoryId: string | null
  customCategoryLabel: string | null
}

const SOURCE_PRIORITY: Record<ProviderLineItemSourceType, number> = { provider: 3, industry: 2, catalog: 1 }
const PROVIDER_ONLY_PATTERNS = [/vat/i, /total/i, /subtotal/i, /payment/i, /advance/i, /discount/i, /management/i, /percent/i]
const CLIENT_UNITS = new Set<PricingUnit>(['sqm', 'unit', 'point', 'container', 'package', 'meter'])
const GENERAL_LABEL = 'שירותים כלליים'

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim()
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/[+/_-]+/g, ' ').replace(/[^a-z0-9\u0590-\u05ff\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function isNearDuplicateName(left: string, right: string): boolean {
  if (!left || !right || left === right) return false
  const leftWords = left.split(' ').filter(Boolean)
  const rightWords = right.split(' ').filter(Boolean)
  if (leftWords.length < 2 || rightWords.length < 2) return false
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  if (shorter.length >= 8 && longer.includes(shorter)) return true
  const rightSet = new Set(rightWords)
  const intersection = leftWords.filter((word) => rightSet.has(word)).length
  return intersection >= Math.min(leftWords.length, rightWords.length) && Math.abs(leftWords.length - rightWords.length) <= 1
}

function isProviderOnly(unit: PricingUnit, label: string): boolean {
  return !CLIENT_UNITS.has(unit) || PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label))
}

function resolveDisplayUnit(unit: PricingUnit, label: string): PricingUnit {
  return unit === 'unknown' && !PROVIDER_ONLY_PATTERNS.some((pattern) => pattern.test(label)) ? 'unit' : unit
}

function buildDisplayLabel(label: string, unit: PricingUnit): string {
  return `${normalizeLabel(label)} (${unit})`
}

function createOption(params: {
  id: string
  sourceType: ProviderLineItemSourceType
  canonicalName: string
  unit: PricingUnit
  aliases: string[]
  sampleLines: number
  quantityPriceSamples: Array<{ quantity: number; unitPrice: number }>
}): ProviderLineItemOption {
  const canonicalName = normalizeLabel(params.canonicalName)
  const displayUnit = resolveDisplayUnit(params.unit, canonicalName)
  const providerOnly = isProviderOnly(displayUnit, canonicalName)
  return {
    id: params.id,
    label: buildDisplayLabel(canonicalName, displayUnit),
    canonicalName,
    clientLabel: canonicalName,
    categoryId: 'general',
    categoryLabel: GENERAL_LABEL,
    isCategoryOverridden: false,
    unit: displayUnit,
    aliases: params.aliases,
    sampleLines: params.sampleLines,
    quantityPriceSamples: params.quantityPriceSamples,
    isProviderOnly: providerOnly,
    visibleToClient: !providerOnly,
    sourceType: params.sourceType,
  }
}

function toPricingOption(item: ProviderPricingItem): ProviderLineItemOption {
  const canonicalName = item.aliases?.find((value) => value.trim().length > 0) ?? item.canonicalName
  return createOption({
    id: item.id,
    sourceType: item.sourceType,
    canonicalName,
    unit: item.unit,
    aliases: item.aliases ?? [],
    sampleLines: item.sampleLines,
    quantityPriceSamples: item.quantityPriceSamples ?? [],
  })
}

function toCatalogOptions(industry: string, industryLabel: string, categoryId: string): ProviderLineItemOption[] {
  return getCatalogLineItemsForIndustry(industry, industryLabel, categoryId).map((item) =>
    createOption({
      id: `catalog_${categoryId}_${item.key}`,
      sourceType: 'catalog',
      canonicalName: item.name,
      unit: item.unit,
      aliases: item.aliases ?? [],
      sampleLines: 0,
      quantityPriceSamples: [],
    }),
  )
}

function pickPreferredOption(current: ProviderLineItemOption, next: ProviderLineItemOption): ProviderLineItemOption {
  const currentPriority = SOURCE_PRIORITY[current.sourceType]
  const nextPriority = SOURCE_PRIORITY[next.sourceType]
  if (nextPriority > currentPriority) return next
  if (nextPriority < currentPriority) return current
  return next.sampleLines > current.sampleLines ? next : current
}

function findGroupedKey(grouped: Map<string, ProviderLineItemOption>, option: ProviderLineItemOption): string {
  const normalizedName = normalizeForKey(option.canonicalName)
  const exactKey = `${normalizedName}|${option.unit}`
  if (grouped.has(exactKey)) return exactKey
  for (const [key, groupedOption] of grouped.entries()) {
    const separatorIndex = key.lastIndexOf('|')
    if (separatorIndex <= 0) continue
    if (key.slice(separatorIndex + 1) !== option.unit) continue
    const groupedName = key.slice(0, separatorIndex)
    if (isNearDuplicateName(groupedName, normalizedName)) return key
    if (isSoftNearDuplicateName(option.canonicalName, groupedOption.canonicalName, option.sourceType, groupedOption.sourceType)) return key
  }
  return exactKey
}

function dedupeOptions(options: ProviderLineItemOption[]): ProviderLineItemOption[] {
  const grouped = new Map<string, ProviderLineItemOption>()
  options.forEach((option) => {
    const key = findGroupedKey(grouped, option)
    const existing = grouped.get(key)
    if (!existing) return void grouped.set(key, option)
    const preferred = pickPreferredOption(existing, option)
    grouped.set(key, {
      ...preferred,
      aliases: Array.from(new Set([...existing.aliases, ...option.aliases])).filter(Boolean),
      sampleLines: Math.max(existing.sampleLines, option.sampleLines),
      quantityPriceSamples: [...existing.quantityPriceSamples, ...option.quantityPriceSamples],
    })
  })
  return Array.from(grouped.values())
}

function assignCategories(options: ProviderLineItemOption[], industry: string, categoryId: string): ProviderLineItemOption[] {
  return options.map((option) => {
    const base = categorizeProviderLineItem({ industry, categoryId, canonicalName: option.canonicalName, unit: option.unit, isProviderOnly: option.isProviderOnly })
    const dynamic = resolveDynamicCategoryForLineItem({ canonicalName: option.canonicalName, currentCategoryId: base.id })
    const resolved = dynamic ?? base
    return { ...option, categoryId: resolved.id, categoryLabel: resolved.label }
  })
}

function applyDisplayOverrides(options: ProviderLineItemOption[], overrides: Map<string, LineItemOverride>): ProviderLineItemOption[] {
  return options.map((option) => {
    const override = overrides.get(option.id)
    const customLabel = normalizeLabel(override?.customLabel ?? '')
    const customCategoryLabel = normalizeLabel(override?.customCategoryLabel ?? '')
    const customCategoryId = normalizeLabel(override?.customCategoryId ?? '')
    return {
      ...option,
      clientLabel: customLabel || option.canonicalName,
      visibleToClient: !option.isProviderOnly && !(override?.hiddenFromClient ?? false),
      categoryId: customCategoryLabel ? customCategoryId || `manual_${normalizeForKey(customCategoryLabel).replace(/\s+/g, '_')}` : option.categoryId,
      categoryLabel: customCategoryLabel || option.categoryLabel,
      isCategoryOverridden: Boolean(customCategoryLabel),
    }
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
  const merged = dedupeOptions([...pricingItems.map(toPricingOption), ...toCatalogOptions(industryMeta.value, industryMeta.label, industryMeta.categoryId)])
  return applyDisplayOverrides(assignCategories(merged, industryMeta.value, industryMeta.categoryId), overrides)
    .filter((item) => !excludedItemIds.has(item.id))
    .filter((item) => item.canonicalName.length > 0)
    .sort((left, right) => {
      if (right.sampleLines !== left.sampleLines) return right.sampleLines - left.sampleLines
      const priorityDelta = SOURCE_PRIORITY[right.sourceType] - SOURCE_PRIORITY[left.sourceType]
      return priorityDelta !== 0 ? priorityDelta : left.label.localeCompare(right.label, 'he')
    })
}
