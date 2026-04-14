import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGroundedPricingLines } from './pricing-engine.service.js'
import { toItemKey } from './pricing-engine-utils.service.js'
import type { LearnedPricingItem } from '../types/model-profile.js'

function item(
  id: string,
  canonicalName: string,
  unit: LearnedPricingItem['unit'],
  samples: Array<{ quantity: number; unitPrice: number }>,
): LearnedPricingItem {
  const prices = samples.map((sample) => sample.unitPrice)
  const quantities = samples.map((sample) => sample.quantity)
  return {
    id,
    serviceProviderUid: 'provider-1',
    canonicalName,
    aliases: [],
    unit,
    pricePerUnit: {
      min: Math.min(...prices),
      avg: prices.reduce((sum, value) => sum + value, 0) / prices.length,
      max: Math.max(...prices),
      sampleCount: prices.length,
    },
    quantity: {
      min: Math.min(...quantities),
      avg: quantities.reduce((sum, value) => sum + value, 0) / quantities.length,
      max: Math.max(...quantities),
      sampleCount: quantities.length,
    },
    lineTotal: {
      min: 100,
      avg: 200,
      max: 300,
      sampleCount: samples.length,
    },
    quantityPriceSamples: samples,
    sampleLines: samples.length,
    lastUpdatedAt: '2026-04-14T00:00:00.000Z',
  }
}

test('similar-item fallback honors category map when low coverage', async () => {
  const target = item('target', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA \u05D7\u05D9\u05E8\u05D5\u05DD', 'meter', [{ quantity: 1, unitPrice: 120 }])
  const sameCategory = item('same-cat', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA', 'meter', [
    { quantity: 5, unitPrice: 180 },
    { quantity: 6, unitPrice: 170 },
    { quantity: 7, unitPrice: 160 },
    { quantity: 8, unitPrice: 150 },
    { quantity: 9, unitPrice: 140 },
    { quantity: 10, unitPrice: 130 },
  ])
  const otherCategory = item('other-cat', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05D2\u05D2', 'meter', [
    { quantity: 5, unitPrice: 300 },
    { quantity: 6, unitPrice: 290 },
    { quantity: 7, unitPrice: 280 },
    { quantity: 8, unitPrice: 270 },
    { quantity: 9, unitPrice: 260 },
    { quantity: 10, unitPrice: 250 },
  ])
  const statsLookup = new Map([
    [toItemKey(target), { exampleCount: 1, documentCount: 1 }],
    [toItemKey(sameCategory), { exampleCount: 20, documentCount: 12 }],
    [toItemKey(otherCategory), { exampleCount: 25, documentCount: 15 }],
  ])
  const categoryMap = new Map([
    ['target', 'plumbing'],
    ['same-cat', 'plumbing'],
    ['other-cat', 'roofing'],
  ])

  const result = await buildGroundedPricingLines({
    serviceProviderUid: 'provider-1',
    requestedItems: [{ sourceItemId: 'target', label: 'target', quantity: 6, unit: 'meter' }],
    learnedItems: [target, sameCategory, otherCategory],
    statsLookup,
    categoryBySourceItemId: categoryMap,
    modelPredictor: null,
  })

  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].pricingMethod, 'similar_item_fallback')
  assert.equal(result.lines[0].referenceItemKey, toItemKey(sameCategory))
  assert.equal(result.lines[0].inferenceCategoryId, 'plumbing')
})

test('category mismatch blocks similar-item fallback', async () => {
  const target = item('target', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA \u05D7\u05D9\u05E8\u05D5\u05DD', 'meter', [{ quantity: 1, unitPrice: 120 }])
  const candidate = item('candidate', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA', 'meter', [
    { quantity: 5, unitPrice: 180 },
    { quantity: 6, unitPrice: 170 },
    { quantity: 7, unitPrice: 160 },
    { quantity: 8, unitPrice: 150 },
    { quantity: 9, unitPrice: 140 },
    { quantity: 10, unitPrice: 130 },
  ])
  const statsLookup = new Map([
    [toItemKey(target), { exampleCount: 1, documentCount: 1 }],
    [toItemKey(candidate), { exampleCount: 20, documentCount: 12 }],
  ])
  const categoryMap = new Map([
    ['target', 'plumbing'],
    ['candidate', 'roofing'],
  ])

  const result = await buildGroundedPricingLines({
    serviceProviderUid: 'provider-1',
    requestedItems: [{ sourceItemId: 'target', label: 'target', quantity: 6, unit: 'meter' }],
    learnedItems: [target, candidate],
    statsLookup,
    categoryBySourceItemId: categoryMap,
    modelPredictor: null,
  })

  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].pricingMethod, 'trend_fallback')
  assert.equal(result.lines[0].referenceItemKey, null)
})
