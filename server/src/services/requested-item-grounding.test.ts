import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRequestedSourceItemId } from './requested-item-grounding.service.js'
import type { ProviderPricingItem } from './pricing-items-source.service.js'
import type { QuoteRequestedItem } from '../types/quote.js'

function item(
  id: string,
  canonicalName: string,
  unit: ProviderPricingItem['unit'],
  sourceType: ProviderPricingItem['sourceType'],
  sampleLines = 10,
  aliases: string[] = [],
): ProviderPricingItem {
  return {
    id,
    serviceProviderUid: 'provider-1',
    canonicalName,
    aliases,
    unit,
    pricePerUnit: { min: 1, avg: 1, max: 1, sampleCount: 1 },
    quantity: { min: 1, avg: 1, max: 1, sampleCount: 1 },
    lineTotal: { min: 1, avg: 1, max: 1, sampleCount: 1 },
    quantityPriceSamples: [{ quantity: 1, unitPrice: 1 }],
    sampleLines,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    sourceType,
  }
}

function request(label: string, unit: QuoteRequestedItem['unit']): QuoteRequestedItem {
  return {
    sourceItemId: null,
    label,
    quantity: 1,
    unit,
  }
}

test('grounds exact label match to learned item', () => {
  const learned: ProviderPricingItem[] = [item('provider_pipe', '\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA', 'meter', 'provider')]
  const resolved = resolveRequestedSourceItemId(request('\u05EA\u05D9\u05E7\u05D5\u05DF \u05E6\u05E0\u05E8\u05EA', 'meter'), learned)
  assert.equal(resolved, 'provider_pipe')
})

test('maps visit-like request to provider point item', () => {
  const learned: ProviderPricingItem[] = [
    item('provider_visit', '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', 'point', 'provider', 40, ['service call']),
    item('industry_visit', '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', 'point', 'industry', 200),
  ]
  const resolved = resolveRequestedSourceItemId(request('\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', 'unit'), learned)
  assert.equal(resolved, 'provider_visit')
})

test('maps visit-like request to provider unit item when available', () => {
  const learned: ProviderPricingItem[] = [
    item('provider_visit_unit', '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', 'unit', 'provider', 12),
    item('industry_visit_point', '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA', 'point', 'industry', 120),
  ]
  const resolved = resolveRequestedSourceItemId(request('service call', 'point'), learned)
  assert.equal(resolved, 'provider_visit_unit')
})

test('prefers provider source on exact match over industry baseline', () => {
  const learned: ProviderPricingItem[] = [
    item('industry_item', '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05D1\u05DC\u05D2\u05D9', 'unit', 'industry', 80),
    item('provider_item', '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05D1\u05DC\u05D2\u05D9', 'unit', 'provider', 12),
  ]
  const resolved = resolveRequestedSourceItemId(request('\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05D1\u05DC\u05D2\u05D9', 'unit'), learned)
  assert.equal(resolved, 'provider_item')
})

test('does not over-match unrelated labels', () => {
  const learned: ProviderPricingItem[] = [
    item('provider_a', '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05D1\u05DC\u05D2\u05D9', 'unit', 'provider'),
    item('provider_b', '\u05D4\u05EA\u05E7\u05E0\u05EA \u05E8\u05E9\u05EA \u05E0\u05D2\u05D3 \u05D9\u05EA\u05D5\u05E9\u05D9\u05DD', 'unit', 'provider'),
  ]
  const resolved = resolveRequestedSourceItemId(request('\u05E4\u05D9\u05E8\u05D5\u05E7 \u05D7\u05DC\u05D5\u05DF \u05D9\u05E9\u05DF', 'unit'), learned)
  assert.equal(resolved, null)
})
