import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanPricingItemName,
  detectPricingUnitHint,
  isNoisePricingItemName,
} from './pricing-items-normalization-utils.service.js'

test('cleanPricingItemName strips transport and service-call markers', () => {
  assert.equal(cleanPricingItemName('waste transport', 'package'), 'waste')
  assert.equal(cleanPricingItemName('service_call visit', 'point'), '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA')
})

test('isNoisePricingItemName marks broad generic names as noise', () => {
  assert.equal(isNoisePricingItemName('install'), true)
  assert.equal(isNoisePricingItemName('package'), true)
  assert.equal(isNoisePricingItemName('pipe repair'), false)
})

test('detectPricingUnitHint recognizes service-call aliases', () => {
  assert.equal(detectPricingUnitHint('service_call'), 'point')
  assert.equal(detectPricingUnitHint('callout visit'), 'point')
})

test('cleanPricingItemName normalizes installation prefix for water points', () => {
  assert.equal(cleanPricingItemName('install water point sewer', 'point'), 'water point sewer')
})

test('cleanPricingItemName normalizes Hebrew installation prefix for water points', () => {
  const withInstallPrefix =
    '\u05D4\u05EA\u05E7\u05E0\u05EA \u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD \u05D1\u05D9\u05D5\u05D1'
  const normalized = '\u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD \u05D1\u05D9\u05D5\u05D1'
  assert.equal(cleanPricingItemName(withInstallPrefix, 'point'), normalized)
})

test('cleanPricingItemName keeps distinguishing token for faucet variant', () => {
  const name = '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6 \u05E0\u05D9\u05DC'
  assert.equal(cleanPricingItemName(name, 'unit'), name)
})
