import { generateLearnedQuote } from './learned-quote.service.js'
import { generateFallbackQuote } from './quote-fallback.service.js'
import { saveGeneratedQuote } from './quotes.service.js'
import type { QuoteClientRequest, QuoteSource, StoredQuote } from '../types/quote.js'

type GenerateAndStoreQuoteInput = {
  serviceProviderUid: string
  trainingJobId: string
  clientRequest: QuoteClientRequest
}

type GenerateAndStoreQuoteResult = {
  source: QuoteSource
  savedQuote: StoredQuote
}

export async function generateAndStoreQuote(
  input: GenerateAndStoreQuoteInput,
): Promise<GenerateAndStoreQuoteResult> {
  const learnedQuote = await generateLearnedQuote({
    serviceProviderUid: input.serviceProviderUid,
    request: input.clientRequest,
  })

  if (learnedQuote) {
    const savedQuote = await saveGeneratedQuote({
      serviceProviderUid: input.serviceProviderUid,
      trainingJobId: input.trainingJobId,
      source: 'learned',
      clientRequest: input.clientRequest,
      quote: learnedQuote,
    })
    return {
      source: 'learned',
      savedQuote,
    }
  }

  const fallbackQuote = generateFallbackQuote({
    request: input.clientRequest,
  })
  const savedQuote = await saveGeneratedQuote({
    serviceProviderUid: input.serviceProviderUid,
    trainingJobId: input.trainingJobId,
    source: 'fallback',
    clientRequest: input.clientRequest,
    quote: fallbackQuote,
  })

  return {
    source: 'fallback',
    savedQuote,
  }
}
