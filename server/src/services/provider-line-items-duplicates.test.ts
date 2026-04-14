import assert from 'node:assert/strict'
import test from 'node:test'
import { isSoftNearDuplicateName } from './provider-line-items-duplicates.service.js'

test('soft duplicate allows helper-word-only variation', () => {
  const result = isSoftNearDuplicateName(
    '\u05E4\u05E8\u05D9\u05E1\u05EA \u05D3\u05E9\u05D0 \u05D8\u05D1\u05E2\u05D9 \u05D4\u05DB\u05E0\u05D4 \u05D5\u05D7\u05D5\u05DE\u05E8',
    '\u05E4\u05E8\u05D9\u05E1\u05EA \u05D3\u05E9\u05D0 \u05D8\u05D1\u05E2\u05D9 \u05DB\u05D5\u05DC\u05DC \u05D4\u05DB\u05E0\u05D4 \u05D5\u05D7\u05D5\u05DE\u05E8',
    'provider',
    'industry',
  )
  assert.equal(result, true)
})

test('soft duplicate blocks distinguishing token merge', () => {
  const result = isSoftNearDuplicateName(
    '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6',
    '\u05D4\u05D7\u05DC\u05E4\u05EA \u05D1\u05E8\u05D6 \u05E0\u05D9\u05DC',
    'provider',
    'industry',
  )
  assert.equal(result, false)
})

test('soft duplicate only applies when one side is provider', () => {
  const result = isSoftNearDuplicateName(
    '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF',
    '\u05D4\u05EA\u05E7\u05E0\u05EA \u05D7\u05DC\u05D5\u05DF \u05DB\u05D5\u05DC\u05DC',
    'industry',
    'catalog',
  )
  assert.equal(result, false)
})
