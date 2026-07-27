import 'server-only';

export {
  SiliconFlowTextbookEmbeddingClient,
  SiliconFlowTextbookRerankClient,
} from './clients';
export {
  TextbookRetrievalContractError,
  TextbookRetrievalProviderError,
} from './errors';
export {
  closeTextbookRetrievalIndex,
  getSharedTextbookRetrievalIndex,
  loadTextbookRetrievalIndex,
  resetTextbookRetrievalForTests,
} from './loader';
export {
  lexicalTokens,
  normalizeText,
  TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
  TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
} from './normalization';
export {
  retrieve,
  retrieveTextbookHybrid,
  retrieveTextbookHybridProgressive,
} from './retrieval';
export type {
  EmbeddingRequest,
  EmbeddingResponse,
  LoadedTextbookRetrievalIndex,
  RerankRequest,
  RerankResponse,
  RetrievalDiagnostic,
  RetrievalOptions,
  TextbookProgressiveRetrievalResponse,
  TextbookRetrievalContinuationResult,
  TextbookEmbeddingClient,
  TextbookIndexManifest,
  TextbookIndexWindow,
  TextbookRerankClient,
  TextbookRetrievalResponse,
  TextbookRetrievalResult,
} from './types';
