import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalizeTrainingItemForIndustry } from './training-item-canonicalization.service.js'

test('canonicalizeTrainingItemForIndustry keeps punctuation variants in same itemKey', () => {
  const plain = canonicalizeTrainingItemForIndustry('water point sewer', 'point', 'plumber')
  const slash = canonicalizeTrainingItemForIndustry('water point /sewer', 'point', 'plumber')

  assert.equal(plain.itemKey, slash.itemKey)
  assert.equal(plain.itemName, 'water point sewer')
  assert.equal(slash.itemName, 'water point sewer')
  assert.equal(plain.unit, 'point')
  assert.equal(slash.unit, 'point')
})

test('canonicalization with unknown unit still stays stable across punctuation variants', () => {
  const plain = canonicalizeTrainingItemForIndustry('water point sewer', 'unknown', 'plumber')
  const slash = canonicalizeTrainingItemForIndustry('water point /sewer', 'unknown', 'plumber')

  assert.equal(plain.itemKey, slash.itemKey)
  assert.equal(plain.unit, slash.unit)
})

test('canonicalization strips parenthesis, stopwords and unit suffix fragments', () => {
  const canonical = canonicalizeTrainingItemForIndustry(
    'service work (fixed price) meter',
    'unit',
    'plumber',
  )

  assert.equal(canonical.itemName, '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA')
  assert.equal(canonical.itemKey, '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA|point')
})

test('canonicalization merges near-duplicates with same tokens in different order', () => {
  const left = canonicalizeTrainingItemForIndustry('pipe repair emergency', 'unit', 'plumber')
  const right = canonicalizeTrainingItemForIndustry('emergency repair pipe', 'unit', 'plumber')

  assert.equal(left.itemKey, right.itemKey)
})

test('canonicalization maps transport-like unit rows to package', () => {
  const canonical = canonicalizeTrainingItemForIndustry('heavy equipment transport', 'unit', 'plumber')
  assert.equal(canonical.unit, 'package')
})

test('canonicalization removes noisy suffix tokens from names', () => {
  const canonical = canonicalizeTrainingItemForIndustry('pipe repair retem', 'point', 'plumber')
  assert.equal(canonical.itemName, 'pipe repair')
})

test('canonicalization merges install-water-point prefix variants into same itemKey', () => {
  const base = canonicalizeTrainingItemForIndustry('water point sewer', 'point', 'plumber')
  const install = canonicalizeTrainingItemForIndustry('install water point sewer', 'point', 'plumber')
  assert.equal(base.itemKey, install.itemKey)
})

test('canonicalization merges Hebrew install-water-point prefix variants into same itemKey', () => {
  const base = canonicalizeTrainingItemForIndustry(
    '\u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD \u05D1\u05D9\u05D5\u05D1',
    'point',
    'plumber',
  )
  const install = canonicalizeTrainingItemForIndustry(
    '\u05D4\u05EA\u05E7\u05E0\u05EA \u05E0\u05E7\u05D5\u05D3\u05EA \u05DE\u05D9\u05DD \u05D1\u05D9\u05D5\u05D1',
    'point',
    'plumber',
  )
  assert.equal(base.itemKey, install.itemKey)
})

test('canonicalization maps service/callout variants to visit-service point item', () => {
  const callout = canonicalizeTrainingItemForIndustry('service callout', 'unit', 'plumber')
  const noisyHebrew = canonicalizeTrainingItemForIndustry(
    '\u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05D5\u05E7\u05D9\u05D1',
    'point',
    'plumber',
  )
  assert.equal(callout.itemName, '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA')
  assert.equal(callout.unit, 'point')
  assert.equal(callout.itemKey, noisyHebrew.itemKey)
})

test('canonicalization keeps faucet nil variant distinct from plain faucet replacement', () => {
  const plain = canonicalizeTrainingItemForIndustry(
    '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6',
    'unit',
    'plumber',
  )
  const nilVariant = canonicalizeTrainingItemForIndustry(
    '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6 \u05E0\u05D9\u05DC',
    'unit',
    'plumber',
  )
  assert.notEqual(plain.itemKey, nilVariant.itemKey)
})
