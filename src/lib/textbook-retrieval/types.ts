import type { FileHandle } from 'node:fs/promises';

export type RetrievalDiagnosticStage = 'embedding' | 'rerank';

export type RetrievalDiagnosticCode =
  | 'timeout'
  | 'http-error'
  | 'invalid-response'
  | 'model-mismatch'
  | 'dimension-mismatch'
  | 'nonfinite-vector'
  | 'zero-vector'
  | 'provider-unavailable';

export interface RetrievalDiagnostic {
  stage: RetrievalDiagnosticStage;
  code: RetrievalDiagnosticCode;
  latencyMs: number;
  traceId?: string;
}

export interface EmbeddingRequest {
  model: string;
  input: string;
  signal: AbortSignal;
}

export interface EmbeddingResponse {
  embedding: number[];
  model?: string;
  traceId?: string;
}

export interface TextbookEmbeddingClient {
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

export interface RerankDocument {
  index: number;
  text: string;
}

export interface RerankRequest {
  model: string;
  query: string;
  documents: RerankDocument[];
  signal: AbortSignal;
}

export interface RerankResponse {
  results: Array<{ index: number; score: number }>;
  traceId?: string;
}

export interface TextbookRerankClient {
  rerank(request: RerankRequest): Promise<RerankResponse>;
}

export interface TextbookIndexManifest {
  recordType: 'index-manifest';
  formatVersion: string;
  sourceRevision: string;
  model: string;
  observedDimension: number;
  normalizationVersion: string;
  vectorNormalization: 'l2';
  vectorEncoding: 'float32-le';
  books: Array<{
    bookId: string;
    edition: string;
    manifestHash: string;
    sourceHashes: Record<string, string>;
  }>;
  sourcePriority: string[];
  counts: {
    books: number;
    windows: number;
    vectors: number;
    bodyBytes: number;
    lexicalTerms: number;
  };
  files: Record<string, string>;
  productionConnected: false;
}

export interface TextbookIndexWindow {
  recordType: 'index-window';
  formatVersion: string;
  id: string;
  sourceWindowId: string;
  bookId: string;
  sourceRevision: string;
  primaryUnitId: string;
  owningUnitIds: string[];
  segments: TextbookIndexWindowSegment[];
  sourcePaths: string[];
  vectorRow: number;
  bodyOffset: number;
  bodyLength: number;
  bodyHash: string;
  contentHash: string;
  tokenCount: number;
}

export interface TextbookIndexWindowSegment {
  owningUnitId: string;
  bodyOffset: number;
  bodyLength: number;
}

export interface LoadedTextbookIndexWindow {
  id: string;
  sourceWindowId: string;
  bookId: string;
  sourceRevision: string;
  primaryUnitId: string;
  owningUnitIds: string[];
  segments: TextbookIndexWindowSegment[];
  sourcePaths: string[];
  bodyOffset: number;
  bodyLength: number;
  tokenCount: number;
}

export interface TextbookRetrievalScoreBases {
  lexical?: number;
  vector?: number;
  bm25?: number;
  sourceLocalVector?: number;
  fused: number;
  rerank?: number;
}

export interface TextbookRetrievalResult {
  windowId: string;
  primaryUnitId: string;
  owningUnitIds: string[];
  segments: Array<{
    owningUnitId: string;
    body: string;
  }>;
  bookId: string;
  sourcePaths: string[];
  body: string;
  scores: TextbookRetrievalScoreBases;
}

export interface TextbookRetrievalResponse {
  mode: 'lexical' | 'lexical-vector';
  results: TextbookRetrievalResult[];
  diagnostics?: RetrievalDiagnostic[];
}

export type TextbookRetrievalContinuationResult =
  | {
      status: 'complete';
      response: TextbookRetrievalResponse;
    }
  | {
      status: 'aborted' | 'capped' | 'failed';
    };

export interface TextbookProgressiveRetrievalResponse {
  foreground: TextbookRetrievalResponse;
  optimizationPending: boolean;
  continuation: Promise<TextbookRetrievalContinuationResult> | null;
}

export interface TextbookRetrievalScope {
  bookId: string;
  unitIds?: readonly string[];
}

export interface RetrievalOptions {
  indexRoot: string;
  externalQuery?: string | null;
  topK?: number;
  candidateCount?: number;
  scope?: readonly TextbookRetrievalScope[];
  embeddingClient?: TextbookEmbeddingClient;
  embeddingTimeoutMs?: number;
  rerankClient?: TextbookRerankClient;
  rerankModel?: string;
  rerankTimeoutMs?: number;
  foregroundWaitMs?: number;
  backgroundWaitLimitMs?: number;
  abortSignal?: AbortSignal;
  now?: () => number;
}

export interface TextbookRetrievalIndexStats {
  artifactBytes: number;
  residentArtifactBytes: number;
  residentArtifactBudgetBytes: number;
  residentArtifactPassed: boolean;
  bodyResidentBytes: 0;
  lexicalTermsBytes: number;
  lexicalPostingsBytes: number;
  windows: number;
  dimensions: number;
}

export interface TextbookLexicalTerm {
  byteOffset: number;
  byteLength: number;
  postingCount: number;
}

export interface LoadedTextbookRetrievalIndex {
  readonly root: string;
  readonly manifestHash: string;
  readonly manifest: TextbookIndexManifest;
  readonly windows: readonly LoadedTextbookIndexWindow[];
  readonly lexicalTerms: ReadonlyMap<string, TextbookLexicalTerm>;
  readonly lexicalPostingsBuffer: Buffer;
  decodePostings(token: string): Array<readonly [number, number]>;
  readonly vectorBuffer: Buffer;
  readonly vectors: Float32Array;
  readonly bodiesHandle: FileHandle;
  readonly stats: TextbookRetrievalIndexStats;
  closed: boolean;
  close(): Promise<void>;
}
