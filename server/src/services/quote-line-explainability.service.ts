import type { GroundedPricingLine } from './pricing-engine.service.js'
import type { QuoteLineAnomalyWarning, QuoteLineExplainability, QuoteLineItem } from '../types/quote.js'

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function buildGroundedWarnings(
  line: GroundedPricingLine,
  llmAdjustmentPct: number | null,
): QuoteLineAnomalyWarning[] {
  const warnings: QuoteLineAnomalyWarning[] = []
  if (line.coverage.tier === 'low') {
    warnings.push({ code: 'low_coverage', severity: 'warn', message: 'Low data coverage for this line-item.' })
  }
  if (line.needsManualReview) {
    warnings.push({ code: 'manual_review', severity: 'warn', message: 'Manual review is recommended for this line-item.' })
  }
  if (line.priceWasClamped) {
    warnings.push({ code: 'clamped_price', severity: 'warn', message: 'Price was clamped to a safe range.' })
  }
  if (line.referenceItemKey) {
    warnings.push({ code: 'similar_item_fallback', severity: 'info', message: 'Used similar learned item as fallback.' })
  }
  if (line.mlDecision?.source === 'global_fallback') {
    warnings.push({ code: 'global_fallback', severity: 'warn', message: 'Model used global fallback instead of direct item history.' })
  }
  if ((line.mlDecision?.uncertaintyScore ?? 0) >= 0.5) {
    warnings.push({ code: 'high_uncertainty', severity: 'warn', message: 'Model uncertainty is high for this prediction.' })
  }
  if (llmAdjustmentPct !== null && Math.abs(llmAdjustmentPct) >= 0.08) {
    warnings.push({ code: 'llm_large_adjustment', severity: 'warn', message: 'LLM calibration made a relatively large adjustment.' })
  }
  return warnings
}

export function buildGroundedLineExplainability(
  line: GroundedPricingLine,
  llmAdjustmentPct: number | null,
): QuoteLineExplainability {
  const llmApplied = llmAdjustmentPct !== null && Math.abs(llmAdjustmentPct) > 0.0001
  const modelApplied = Boolean(line.mlDecision?.applied)
  return {
    pipeline: llmApplied ? 'rules_ml_llm' : modelApplied ? 'rules_ml' : 'rules_only',
    pricingMethod: line.pricingMethod,
    coverageTier: line.coverage.tier,
    referenceItemKey: line.referenceItemKey,
    categoryId: line.inferenceCategoryId,
    modelSource: line.mlDecision?.source ?? 'none',
    modelUncertainty:
      typeof line.mlDecision?.uncertaintyScore === 'number'
        ? round4(line.mlDecision.uncertaintyScore)
        : null,
    llmAdjustmentPct: llmAdjustmentPct !== null ? round4(llmAdjustmentPct) : null,
    anomalyWarnings: buildGroundedWarnings(line, llmAdjustmentPct),
  }
}

export function buildMarketLineExplainability(pricingMethod: string): QuoteLineExplainability {
  return {
    pipeline: 'llm_market',
    pricingMethod,
    coverageTier: 'n/a',
    referenceItemKey: null,
    categoryId: null,
    modelSource: 'none',
    modelUncertainty: null,
    llmAdjustmentPct: null,
    anomalyWarnings: [
      {
        code: 'market_pricing',
        severity: 'warn',
        message: 'No learned history found; market-based pricing was used.',
      },
    ],
  }
}

export function toAnomalyAssumptions(lines: QuoteLineItem[]): string[] {
  const warnLines = lines
    .map((line) => ({
      description: line.description,
      warnings: (line.explainability?.anomalyWarnings ?? []).filter((warning) => warning.severity === 'warn'),
    }))
    .filter((entry) => entry.warnings.length > 0)
  if (warnLines.length === 0) return []
  const preview = warnLines
    .slice(0, 3)
    .map((entry) => `${entry.description}: ${entry.warnings.map((warning) => warning.code).join(', ')}`)
    .join(' | ')
  return [`Anomaly warnings detected on ${warnLines.length} line(s): ${preview}`]
}
