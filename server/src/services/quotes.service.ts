import { randomUUID } from 'node:crypto'
import { getFirestoreDb } from '../config/firebase.js'
import { buildQuoteFromLineItems } from './quote-breakdown.service.js'
import { autofillQuoteLinePricesFromTraining } from './provider-quote-autofill.service.js'
import { rebuildPricingItemsFromDataset } from './pricing-items-dataset-sync.service.js'
import { syncApprovedQuoteToTrainingDataset } from './training-dataset-approved-quotes.service.js'
import type {
  GeneratedQuote,
  QuoteClientRequest,
  QuoteLineItem,
  QuoteSource,
  StoredQuote,
} from '../types/quote.js'

const QUOTES_COLLECTION = 'quotes'

type SaveQuoteInput = {
  serviceProviderUid: string
  trainingJobId: string
  source: QuoteSource
  clientRequest: QuoteClientRequest
  quote: GeneratedQuote
}

type RawStoredQuote = Partial<StoredQuote> & { contractorUid?: string }

function nowIso(): string {
  return new Date().toISOString()
}

function quoteRef(quoteId: string) {
  const db = getFirestoreDb()
  return db.collection(QUOTES_COLLECTION).doc(quoteId)
}

function normalizeSource(value: unknown): QuoteSource {
  return value === 'openai' || value === 'learned' ? value : 'fallback'
}

function normalizeStatus(value: unknown): StoredQuote['status'] {
  if (value === 'completed') return 'completed'
  if (value === 'approved') return 'approved'
  return 'draft'
}

function normalizeClientRequest(value: unknown): QuoteClientRequest {
  const candidate = (value as QuoteClientRequest) ?? {}
  return {
    clientName: typeof candidate.clientName === 'string' ? candidate.clientName : '',
    clientEmail: typeof candidate.clientEmail === 'string' ? candidate.clientEmail : '',
    projectType: candidate.projectType ?? 'renovation',
    scope: candidate.scope ?? 'medium',
    urgency: candidate.urgency ?? 'normal',
    requirements: typeof candidate.requirements === 'string' ? candidate.requirements : '',
    requestedItems: Array.isArray(candidate.requestedItems) ? candidate.requestedItems : [],
  }
}

function parseLineItems(value: unknown, fallbackEstimatedPrice: number): QuoteLineItem[] {
  if (!Array.isArray(value)) {
    if (fallbackEstimatedPrice <= 0) return []
    return [{
      id: 'legacy_total',
      sourceItemId: null,
      description: '\u05E1\u05DB\u05D5\u05DD \u05DB\u05DC\u05DC\u05D9',
      unit: 'custom',
      quantity: 1,
      unitPrice: fallbackEstimatedPrice,
      lineTotal: fallbackEstimatedPrice,
      explainability: null,
    }]
  }
  return value.map((raw) => {
    const item = raw as Partial<QuoteLineItem>
    if (typeof item.description !== 'string' || item.description.trim().length === 0) return null
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    const explainability =
      item.explainability && typeof item.explainability === 'object'
        ? (item.explainability as QuoteLineItem['explainability'])
        : null
    const parsed: QuoteLineItem = {
      id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : randomUUID(),
      sourceItemId: typeof item.sourceItemId === 'string' ? item.sourceItemId : null,
      description: item.description.trim(),
      unit: (item.unit as QuoteLineItem['unit']) ?? 'custom',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      lineTotal: 0,
    }
    if (explainability) parsed.explainability = explainability
    return parsed
  }).filter((item): item is QuoteLineItem => item !== null)
}

function normalizeQuote(value: unknown): GeneratedQuote {
  const candidate = (value as Partial<GeneratedQuote>) ?? {}
  const estimatedPrice = Number(candidate.estimatedPrice)
  const lineItems = parseLineItems(
    candidate.lineItems,
    Number.isFinite(estimatedPrice) ? estimatedPrice : 0,
  )
  const hasExplicitLineItems = Array.isArray(candidate.lineItems) && candidate.lineItems.length > 0
  const assumptions = Array.isArray(candidate.assumptions)
    ? candidate.assumptions.filter((item): item is string => typeof item === 'string')
    : []
  const vatRate = Number(candidate.vatRate)
  const safeVatRate = hasExplicitLineItems || Number.isFinite(vatRate) ? vatRate : 0
  return buildQuoteFromLineItems({
    lineItems,
    customFields: candidate.customFields,
    pricingAdjustments: candidate.pricingAdjustments,
    vatRate: safeVatRate,
    estimatedDays: Number(candidate.estimatedDays),
    confidence: Number(candidate.confidence),
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    assumptions,
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : nowIso(),
  })
}

function shouldSyncToTraining(status: StoredQuote['status']): boolean {
  return status === 'approved' || status === 'completed'
}

function normalizeStoredQuote(raw: RawStoredQuote): StoredQuote | null {
  if (!raw?.id) return null
  const serviceProviderUid = raw.serviceProviderUid ?? raw.contractorUid
  if (!serviceProviderUid) return null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : nowIso()
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt
  const status = normalizeStatus(raw.status)
  const approvedAt = shouldSyncToTraining(status) ? raw.approvedAt ?? updatedAt : null
  const completedAt = status === 'completed' ? raw.completedAt ?? updatedAt : null
  return {
    id: raw.id,
    serviceProviderUid,
    trainingJobId: raw.trainingJobId ?? '',
    source: normalizeSource(raw.source),
    clientRequest: normalizeClientRequest(raw.clientRequest),
    quote: normalizeQuote(raw.quote),
    status,
    createdAt,
    updatedAt,
    approvedAt,
    completedAt,
    approvedByServiceProviderUid: raw.approvedByServiceProviderUid ?? null,
    clientRevisionPending: raw.clientRevisionPending === true,
  }
}

export async function saveGeneratedQuote(input: SaveQuoteInput): Promise<StoredQuote> {
  const timestamp = nowIso()
  const savedQuote: StoredQuote = {
    id: randomUUID(),
    serviceProviderUid: input.serviceProviderUid,
    trainingJobId: input.trainingJobId,
    source: input.source,
    clientRequest: input.clientRequest,
    quote: normalizeQuote(input.quote),
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    approvedAt: null,
    completedAt: null,
    approvedByServiceProviderUid: null,
    clientRevisionPending: false,
  }
  await quoteRef(savedQuote.id).set(savedQuote, { merge: true })
  return savedQuote
}

async function listByField(fieldName: string, uid: string): Promise<StoredQuote[]> {
  const db = getFirestoreDb()
  const snapshot = await db.collection(QUOTES_COLLECTION).where(fieldName, '==', uid).limit(200).get()
  return snapshot.docs
    .map((doc) => normalizeStoredQuote(doc.data() as RawStoredQuote))
    .filter((item): item is StoredQuote => item !== null)
}

export async function getQuoteById(quoteId: string): Promise<StoredQuote | null> {
  const snapshot = await quoteRef(quoteId).get()
  if (!snapshot.exists) return null
  return normalizeStoredQuote(snapshot.data() as RawStoredQuote)
}

export async function listQuotesByServiceProvider(serviceProviderUid: string): Promise<StoredQuote[]> {
  const [newQuotes, legacyQuotes] = await Promise.all([
    listByField('serviceProviderUid', serviceProviderUid),
    listByField('contractorUid', serviceProviderUid),
  ])
  const unique = new Map<string, StoredQuote>()
  ;[...newQuotes, ...legacyQuotes].forEach((quote) => unique.set(quote.id, quote))
  return Array.from(unique.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateQuoteForServiceProvider(
  quoteId: string,
  serviceProviderUid: string,
  quote: GeneratedQuote,
): Promise<StoredQuote | null> {
  const existing = await getQuoteById(quoteId)
  if (!existing || existing.serviceProviderUid !== serviceProviderUid || existing.status !== 'draft') {
    return null
  }
  const updatedAt = nowIso()
  const normalizedQuote = normalizeQuote(quote)
  const quoteWithAutofill = await autofillQuoteLinePricesFromTraining(serviceProviderUid, normalizedQuote)
  await quoteRef(quoteId).set({ quote: quoteWithAutofill, updatedAt }, { merge: true })
  const updatedRecord: StoredQuote = { ...existing, quote: quoteWithAutofill, updatedAt }
  if (shouldSyncToTraining(updatedRecord.status)) {
    await syncApprovedQuoteToTrainingDataset(updatedRecord)
    await rebuildPricingItemsFromDataset(serviceProviderUid)
  }
  return updatedRecord
}

export async function approveQuoteForServiceProvider(quoteId: string, serviceProviderUid: string): Promise<StoredQuote | null> {
  const existing = await getQuoteById(quoteId)
  if (!existing || existing.serviceProviderUid !== serviceProviderUid) return null
  const timestamp = nowIso()
  await quoteRef(quoteId).set({ status: 'approved', approvedAt: timestamp, completedAt: null, approvedByServiceProviderUid: serviceProviderUid, updatedAt: timestamp, clientRevisionPending: false }, { merge: true })
  const approvedRecord: StoredQuote = { ...existing, status: 'approved', approvedAt: timestamp, completedAt: null, approvedByServiceProviderUid: serviceProviderUid, updatedAt: timestamp, clientRevisionPending: false }
  await syncApprovedQuoteToTrainingDataset(approvedRecord)
  await rebuildPricingItemsFromDataset(serviceProviderUid)
  return approvedRecord
}

export async function completeQuoteForServiceProvider(quoteId: string, serviceProviderUid: string): Promise<StoredQuote | null> {
  const existing = await getQuoteById(quoteId)
  if (!existing || existing.serviceProviderUid !== serviceProviderUid || existing.status === 'draft') return null
  const timestamp = nowIso()
  await quoteRef(quoteId).set({ status: 'completed', completedAt: timestamp, updatedAt: timestamp, clientRevisionPending: false }, { merge: true })
  return { ...existing, status: 'completed', completedAt: timestamp, updatedAt: timestamp, clientRevisionPending: false }
}

export async function deleteQuoteForServiceProvider(quoteId: string, serviceProviderUid: string): Promise<boolean> {
  const existing = await getQuoteById(quoteId)
  if (!existing || existing.serviceProviderUid !== serviceProviderUid || existing.status !== 'draft') return false
  await quoteRef(quoteId).delete()
  return true
}

