import assert from 'node:assert/strict'
import test from 'node:test'
import { suppressIndustryAndCatalogWhenProviderExists } from './provider-line-items-preference.service.js'

type SourceType = 'provider' | 'industry' | 'catalog'
type Option = { canonicalName: string; sourceType: SourceType }

test('suppresses industry item when provider has same canonical name', () => {
  const items: Option[] = [
    { canonicalName: 'כיסוח דשא', sourceType: 'provider' },
    { canonicalName: 'כיסוח דשא', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('suppresses catalog item when provider has same canonical name', () => {
  const items: Option[] = [
    { canonicalName: 'ביקור שירות', sourceType: 'provider' },
    { canonicalName: 'ביקור שירות', sourceType: 'catalog' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('keeps distinct industry item when provider has no equivalent', () => {
  const items: Option[] = [
    { canonicalName: 'כיסוח דשא', sourceType: 'provider' },
    { canonicalName: 'גיזום שיחים', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 2)
  assert.equal(result.some((item) => item.sourceType === 'industry'), true)
})

test('suppresses punctuation variants across provider and industry', () => {
  const items: Option[] = [
    { canonicalName: 'נקודת מים/ביוב', sourceType: 'provider' },
    { canonicalName: 'נקודת מים ביוב', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('suppresses industry variant with noisy helper words', () => {
  const items: Option[] = [
    { canonicalName: 'פריסת דשא טבעי הכנה וחומר', sourceType: 'provider' },
    { canonicalName: 'פריסת דשא טבעי כולל הכנה וחומר רמ', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})
