import assert from 'node:assert/strict'
import test from 'node:test'
import { suppressIndustryAndCatalogWhenProviderExists } from './provider-line-items-preference.service.js'

type SourceType = 'provider' | 'industry' | 'catalog'
type Option = { canonicalName: string; sourceType: SourceType }

test('suppresses industry item when provider has same canonical name', () => {
  const items: Option[] = [
    { canonicalName: '\u05DB\u05D9\u05E1\u05D5\u05D7 \u05D3\u05E9\u05D0', sourceType: 'provider' },
    { canonicalName: '\u05DB\u05D9\u05E1\u05D5\u05D7 \u05D3\u05E9\u05D0', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('suppresses catalog item when provider has same canonical name', () => {
  const items: Option[] = [
    { canonicalName: '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', sourceType: 'provider' },
    { canonicalName: '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', sourceType: 'catalog' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('suppresses punctuation variants across provider and industry', () => {
  const items: Option[] = [
    { canonicalName: '\u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD/\u05D1\u05D9\u05D5\u05D1', sourceType: 'provider' },
    { canonicalName: '\u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD \u05D1\u05D9\u05D5\u05D1', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('suppresses industry variant when diff is helper words only', () => {
  const items: Option[] = [
    { canonicalName: '\u05E4\u05E8\u05D9\u05E1\u05EA \u05D3\u05E9\u05D0 \u05D8\u05D1\u05E2\u05D9 \u05D4\u05DB\u05E0\u05D4 \u05D5\u05D7\u05D5\u05DE\u05E8', sourceType: 'provider' },
    {
      canonicalName:
        '\u05E4\u05E8\u05D9\u05E1\u05EA \u05D3\u05E9\u05D0 \u05D8\u05D1\u05E2\u05D9 \u05DB\u05D5\u05DC\u05DC \u05D4\u05DB\u05E0\u05D4 \u05D5\u05D7\u05D5\u05DE\u05E8',
      sourceType: 'industry',
    },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 1)
  assert.equal(result[0].sourceType, 'provider')
})

test('keeps distinct plumbing variants with distinguishing token', () => {
  const items: Option[] = [
    { canonicalName: '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6', sourceType: 'provider' },
    { canonicalName: '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6 \u05E0\u05D9\u05DC', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 2)
  assert.equal(result.some((item) => item.sourceType === 'industry'), true)
})

test('keeps distinct window variants across industries', () => {
  const items: Option[] = [
    { canonicalName: '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF', sourceType: 'provider' },
    { canonicalName: '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05D1\u05DC\u05D2\u05D9', sourceType: 'industry' },
  ]
  const result = suppressIndustryAndCatalogWhenProviderExists(items)
  assert.equal(result.length, 2)
  assert.equal(result.some((item) => item.sourceType === 'industry'), true)
})
