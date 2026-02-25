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
