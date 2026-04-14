import assert from 'node:assert/strict'
import test from 'node:test'
import { validateObservationsForTraining } from './pricing-observation-validation.service.js'
import type { PricingObservation } from '../types/pricing-observation.js'
import type { PricingUnit } from '../types/model-profile.js'

function buildObservation(input: {
  name: string
  sourceLine?: string
  unit: PricingUnit
}): PricingObservation {
  return {
    sourceDocumentId: 'doc-1',
    sourceQuoteDate: '2026-02-25',
    sourceLine: input.sourceLine ?? input.name,
    rawName: input.name,
    canonicalName: input.name,
    unit: input.unit,
    quantity: 2,
    pricePerUnit: 100,
    lineTotal: 200,
    cpiAdjustmentFactor: 1,
    vatMode: 'unknown',
    vatRate: null,
    materialsMode: 'unknown',
    discountPercent: null,
    discountAmount: null,
  }
}

test('validation normalizes area context from meter to sqm', () => {
  const observation = buildObservation({
    name: 'garden area cleanup square',
    unit: 'meter',
  })

  const result = validateObservationsForTraining([observation], { industry: 'gardener' })
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].unit, 'sqm')
})

test('validation infers transport rows as package when unit is unknown', () => {
  const observation = buildObservation({
    name: 'green waste transport',
    unit: 'unknown',
  })

  const result = validateObservationsForTraining([observation], { industry: 'plumber' })
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].unit, 'package')
})

test('validation drops unresolved unknown units after normalization', () => {
  const observation = buildObservation({
    name: 'custom alpha',
    unit: 'unknown',
  })

  const result = validateObservationsForTraining([observation], { industry: 'plumber' })
  assert.equal(result.observations.length, 0)
  assert.equal(result.stats.droppedByReason.invalid_unit, 1)
})

test('validation maps service-call aliases to canonical visit item', () => {
  const observation = buildObservation({
    name: 'service callout',
    sourceLine: 'service_call',
    unit: 'point',
  })

  const result = validateObservationsForTraining([observation], { industry: 'plumber' })
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].canonicalName, '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA')
  assert.equal(result.observations[0].unit, 'point')
  assert.equal(result.stats.droppedByReason.generic_name, 0)
})

test('validation drops broad generic one-word names', () => {
  const observation = buildObservation({
    name: '\u05D4\u05EA\u05E7\u05E0\u05D4',
    unit: 'unit',
  })

  const result = validateObservationsForTraining([observation], { industry: 'plumber' })
  assert.equal(result.observations.length, 0)
  assert.equal(result.stats.droppedByReason.generic_name, 1)
})

test('validation maps noisy Hebrew service aliases to canonical visit item', () => {
  const observation = buildObservation({
    name: '\u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05D5\u05E7\u05D9\u05D1',
    unit: 'point',
  })

  const result = validateObservationsForTraining([observation], { industry: 'plumber' })
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].canonicalName, '\u05D1\u05D9\u05E7\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA')
  assert.equal(result.observations[0].unit, 'point')
})
