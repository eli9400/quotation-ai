import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGroundedLineExplainability,
  buildMarketLineExplainability,
  toAnomalyAssumptions,
} from './quote-line-explainability.service.js'
import type { GroundedPricingLine } from './pricing-engine.service.js'
import type { QuoteLineItem } from '../types/quote.js'

function grounded(overrides: Partial<GroundedPricingLine> = {}): GroundedPricingLine {
  return {
    id: 'line-1',
    sourceItemId: 'item-1',
    itemKey: 'repair|unit',
    description: 'Repair',
    unit: 'unit',
    quantity: 1,
    baseUnitPrice: 100,
    baseLineTotal: 100,
    priceStats: { min: 80, median: 100, avg: 102, max: 130 },
    coverage: { sampleCount: 2, exampleCount: 2, documentCount: 1, tier: 'low' },
    pricingMethod: 'similar_item_fallback',
    sourceExamples: [{ quantity: 1, unitPrice: 100 }],
    needsManualReview: true,
    referenceItemKey: 'similar|unit',
    inferenceCategoryId: 'plumbing',
    priceWasClamped: true,
    mlDecision: {
      applied: true,
      source: 'global_fallback',
      uncertaintyScore: 0.62,
      p25: 90,
      p50: 100,
      p75: 130,
    },
    ...overrides,
  }
}

test('buildGroundedLineExplainability emits pipeline and warnings', () => {
  const explainability = buildGroundedLineExplainability(grounded(), 0.1)
  assert.equal(explainability.pipeline, 'rules_ml_llm')
  assert.equal(explainability.coverageTier, 'low')
  assert.equal(explainability.modelSource, 'global_fallback')
  assert.equal(explainability.anomalyWarnings.some((warning) => warning.code === 'manual_review'), true)
  assert.equal(explainability.anomalyWarnings.some((warning) => warning.code === 'llm_large_adjustment'), true)
})

test('buildMarketLineExplainability marks market-pricing warning', () => {
  const explainability = buildMarketLineExplainability('market_llm')
  assert.equal(explainability.pipeline, 'llm_market')
  assert.equal(explainability.anomalyWarnings[0]?.code, 'market_pricing')
})

test('toAnomalyAssumptions summarizes warn-level anomalies', () => {
  const lines: QuoteLineItem[] = [
    {
      id: 'a',
      sourceItemId: 'x',
      description: 'Visit service',
      unit: 'unit',
      quantity: 1,
      unitPrice: 280,
      lineTotal: 280,
      explainability: buildGroundedLineExplainability(grounded({ description: 'Visit service' }), 0.1),
    },
  ]
  const assumptions = toAnomalyAssumptions(lines)
  assert.equal(assumptions.length, 1)
  assert.equal(assumptions[0].includes('Anomaly warnings detected'), true)
})
