import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApprovedQuoteTrainingExamples } from './training-dataset-approved-quotes.service.js'
import type { StoredQuote } from '../types/quote.js'

function buildQuote(description: string): StoredQuote {
  return {
    id: 'quote-1',
    serviceProviderUid: 'provider-1',
    trainingJobId: 'job-1',
    source: 'learned',
    clientRequest: {
      clientName: 'Client',
      clientEmail: 'client@example.com',
      projectType: 'installation',
      scope: 'small',
      urgency: 'normal',
      requirements: '',
    },
    quote: {
      lineItems: [
        {
          id: 'line-1',
          sourceItemId: null,
          description,
          unit: 'point',
          quantity: 2,
          unitPrice: 320,
          lineTotal: 640,
        },
      ],
      customFields: [],
      pricingAdjustments: { cpi: null },
      subtotalBeforeVat: 640,
      vatRate: 17,
      vatAmount: 108.8,
      estimatedPrice: 748.8,
      estimatedDays: 1,
      confidence: 0.9,
      summary: 'test',
      assumptions: [],
      generatedAt: '2026-02-25T00:00:00.000Z',
    },
    status: 'approved',
    createdAt: '2026-02-25T00:00:00.000Z',
    updatedAt: '2026-02-25T00:00:00.000Z',
    approvedAt: '2026-02-25T00:00:00.000Z',
    completedAt: null,
    approvedByServiceProviderUid: 'provider-1',
    clientRevisionPending: false,
  }
}

test('approved-quote dataset mapping keeps punctuation variants in same itemKey', () => {
  const plainExamples = buildApprovedQuoteTrainingExamples(
    buildQuote('water point sewer'),
    'plumber',
    '2026-02-25T00:00:00.000Z',
  )
  const slashExamples = buildApprovedQuoteTrainingExamples(
    buildQuote('water point /sewer'),
    'plumber',
    '2026-02-25T00:00:00.000Z',
  )

  assert.equal(plainExamples.length, 1)
  assert.equal(slashExamples.length, 1)
  assert.equal(plainExamples[0].source, 'approved_quote')
  assert.equal(plainExamples[0].itemKey, slashExamples[0].itemKey)
  assert.equal(plainExamples[0].itemName, slashExamples[0].itemName)
})
