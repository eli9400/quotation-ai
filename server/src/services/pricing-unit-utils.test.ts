import assert from 'node:assert/strict'
import test from 'node:test'
import { mapUnitToken } from './pricing-unit-utils.service.js'

test('mapUnitToken supports additional sqm aliases', () => {
  assert.equal(mapUnitToken('sq meter'), 'sqm')
  assert.equal(mapUnitToken('square-meters'), 'sqm')
  assert.equal(mapUnitToken('m²'), 'sqm')
})

test('mapUnitToken supports visit aliases', () => {
  assert.equal(mapUnitToken('visit'), 'point')
  assert.equal(mapUnitToken('service_call'), 'point')
  assert.equal(mapUnitToken('callout'), 'point')
})

test('mapUnitToken supports linear-meter aliases', () => {
  assert.equal(mapUnitToken('lm'), 'meter')
  assert.equal(mapUnitToken('linear-meter'), 'meter')
})
