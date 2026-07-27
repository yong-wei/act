import { performance } from 'node:perf_hooks';

import {
  SiliconFlowTextbookEmbeddingClient,
  SiliconFlowTextbookRerankClient,
} from './clients';
import {
  TextbookRetrievalContractError,
  TextbookRetrievalProviderError,
} from './errors';
import { loadTextbookRetrievalIndex } from './loader';
import { lexicalTokens, normalizeText } from './normalization';
import type {
  LoadedTextbookIndexWindow,
  LoadedTextbookRetrievalIndex,
  RetrievalDiagnostic,
  RetrievalDiagnosticCode,
  RetrievalOptions,
  TextbookProgressiveRetrievalResponse,
  TextbookRetrievalContinuationResult,
  TextbookRetrievalResult,
  TextbookRetrievalScoreBases,
  TextbookRetrievalResponse,
} from './types';

const DEFAULT_CANDIDATE_COUNT = 24;
const DEFAULT_TOP_K = 10;
const DEFAULT_EMBEDDING_TIMEOUT_MS = 5_000;
const DEFAULT_RERANK_TIMEOUT_MS = 8_000;
const DEFAULT_FOREGROUND_WAIT_MS = 2_000;
const DEFAULT_BACKGROUND_WAIT_LIMIT_MS = 2_500;
const RRF_K = 60;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const BM25_RRF_WEIGHT = 1.5;
const GENERIC_BOOK_ID_SEGMENTS = new Set([
  'auto',
  'control',
  'systems',
  'edition',
]);

interface RankedCandidate {
  row: number;
  scores: TextbookRetrievalScoreBases;
  body?: string;
}

class TimeoutError extends Error {}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TextbookRetrievalContractError('timeout must be a positive number');
  }
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) {
    abort();
    throw new DOMException('Aborted', 'AbortError');
  }
  parentSignal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new TimeoutError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abort);
  }
}

function providerCode(error: unknown): RetrievalDiagnosticCode {
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof TextbookRetrievalProviderError) return error.code;
  return 'provider-unavailable';
}

function diagnostic(
  stage: 'embedding' | 'rerank',
  code: RetrievalDiagnosticCode,
  started: number,
  traceId?: string,
): RetrievalDiagnostic {
  return {
    stage,
    code,
    latencyMs: Math.max(0, Math.round((performance.now() - started) * 1000) / 1000),
    ...(traceId ? { traceId } : {}),
  };
}

function validateOptions(options: RetrievalOptions): {
  topK: number;
  candidateCount: number;
  embeddingTimeoutMs: number;
  rerankTimeoutMs: number;
  foregroundWaitMs: number;
  backgroundWaitLimitMs: number;
} {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const candidateCount = options.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  if (!Number.isInteger(topK) || topK < 1 || topK > 30) {
    throw new TextbookRetrievalContractError('topK must be an integer from 1 to 30');
  }
  if (
    !Number.isInteger(candidateCount)
    || candidateCount < 20
    || candidateCount > 30
    || candidateCount < topK
  ) {
    throw new TextbookRetrievalContractError(
      'candidateCount must be an integer from 20 to 30 and at least topK',
    );
  }
  const foregroundWaitMs = options.foregroundWaitMs ?? DEFAULT_FOREGROUND_WAIT_MS;
  const backgroundWaitLimitMs = options.backgroundWaitLimitMs
    ?? DEFAULT_BACKGROUND_WAIT_LIMIT_MS;
  if (
    !Number.isFinite(foregroundWaitMs)
    || foregroundWaitMs <= 0
    || !Number.isFinite(backgroundWaitLimitMs)
    || backgroundWaitLimitMs <= foregroundWaitMs
  ) {
    throw new TextbookRetrievalContractError(
      'background wait limit must be greater than the positive foreground wait',
    );
  }
  return {
    topK,
    candidateCount,
    embeddingTimeoutMs:
      options.embeddingTimeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS,
    rerankTimeoutMs: options.rerankTimeoutMs ?? DEFAULT_RERANK_TIMEOUT_MS,
    foregroundWaitMs,
    backgroundWaitLimitMs,
  };
}

function lexicalRank(
  index: LoadedTextbookRetrievalIndex,
  query: string,
  allowedRows?: ReadonlySet<number>,
): Array<{ row: number; score: number }> {
  const scores = new Map<number, number>();
  for (const token of lexicalTokens(query)) {
    if (!index.lexicalTerms.has(token)) continue;
    for (const [row, frequency] of index.decodePostings(token)) {
      if (allowedRows && !allowedRows.has(row)) continue;
      scores.set(row, (scores.get(row) ?? 0) + frequency);
    }
  }
  return [...scores].map(([row, score]) => ({ row, score }))
    .sort((left, right) => right.score - left.score || left.row - right.row);
}

function normalizeQueryVector(
  vector: unknown,
  dimension: number,
): Float64Array {
  if (!Array.isArray(vector)) {
    throw new TextbookRetrievalProviderError('embedding', 'invalid-response');
  }
  if (vector.length !== dimension) {
    throw new TextbookRetrievalProviderError('embedding', 'dimension-mismatch');
  }
  const normalized = new Float64Array(dimension);
  let normSquared = 0;
  for (let index = 0; index < dimension; index += 1) {
    const value = vector[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TextbookRetrievalProviderError('embedding', 'nonfinite-vector');
    }
    normalized[index] = value;
    normSquared += value * value;
  }
  const norm = Math.sqrt(normSquared);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new TextbookRetrievalProviderError('embedding', 'zero-vector');
  }
  for (let index = 0; index < dimension; index += 1) {
    normalized[index] /= norm;
  }
  return normalized;
}

function vectorRank(
  index: LoadedTextbookRetrievalIndex,
  queryVector: Float64Array,
  allowedRows?: ReadonlySet<number>,
): Array<{ row: number; score: number }> {
  const dimensions = index.manifest.observedDimension;
  const ranked: Array<{ row: number; score: number }> = [];
  for (let row = 0; row < index.windows.length; row += 1) {
    if (allowedRows && !allowedRows.has(row)) continue;
    const start = row * dimensions;
    let score = 0;
    for (let column = 0; column < dimensions; column += 1) {
      score += index.vectors[start + column] * queryVector[column];
    }
    ranked.push({ row, score });
  }
  ranked.sort((left, right) => right.score - left.score || left.row - right.row);
  return ranked;
}

function bm25Rank(
  index: LoadedTextbookRetrievalIndex,
  query: string,
  allowedRows?: ReadonlySet<number>,
): Array<{ row: number; score: number }> {
  if (!query.includes('中文') && !query.includes('叫什么')) return [];
  const queryTokens = [...new Set(lexicalTokens(query))];
  const scores = new Map<number, number>();
  const averageDocumentLength = index.windows.reduce(
    (sum, window) => sum + window.tokenCount,
    0,
  ) / index.windows.length;
  for (const token of queryTokens) {
    const term = index.lexicalTerms.get(token);
    if (!term) continue;
    const inverseDocumentFrequency = Math.log(
      1 + (index.windows.length - term.postingCount + 0.5)
        / (term.postingCount + 0.5),
    );
    for (const [row, frequency] of index.decodePostings(token)) {
      if (allowedRows && !allowedRows.has(row)) continue;
      const documentLength = index.windows[row].tokenCount;
      const denominator = frequency + BM25_K1 * (
        1 - BM25_B + BM25_B * documentLength / averageDocumentLength
      );
      const score = inverseDocumentFrequency
        * frequency * (BM25_K1 + 1) / denominator;
      scores.set(row, (scores.get(row) ?? 0) + score);
    }
  }
  return [...scores].map(([row, score]) => ({ row, score }))
    .sort((left, right) => right.score - left.score || left.row - right.row);
}

function resolveScopedRows(
  index: LoadedTextbookRetrievalIndex,
  options: RetrievalOptions,
): ReadonlySet<number> | undefined {
  if (options.scope === undefined) return undefined;
  const allowedRows = new Set<number>();
  index.windows.forEach((window, row) => {
    if (options.scope?.some((scope) => (
      scope.bookId === window.bookId
      && (
        scope.unitIds === undefined
        || scope.unitIds.some((unitId) => window.owningUnitIds.includes(unitId))
      )
    ))) {
      allowedRows.add(row);
    }
  });
  return allowedRows;
}

function matchingBookIds(
  index: LoadedTextbookRetrievalIndex,
  query: string,
): Set<string> {
  const matches = new Set<string>();
  for (const book of index.manifest.books) {
    const edition = normalizeText(book.edition);
    if (edition && query.includes(edition)) {
      matches.add(book.bookId);
      continue;
    }
    const identifyingSegments = book.bookId.split('-')
      .map((segment) => normalizeText(segment))
      .filter((segment) =>
        segment && !GENERIC_BOOK_ID_SEGMENTS.has(segment));
    if (
      identifyingSegments.filter((segment) => query.includes(segment)).length >= 2
    ) {
      matches.add(book.bookId);
    }
  }
  return matches;
}

function sourceLocalVectorRank(
  index: LoadedTextbookRetrievalIndex,
  query: string,
  vector: Array<{ row: number; score: number }>,
): Array<{ row: number; score: number }> {
  const bookIds = matchingBookIds(index, query);
  if (bookIds.size === 0) return [];
  return vector.filter((candidate) =>
    bookIds.has(index.windows[candidate.row].bookId));
}

function sourcePriority(
  index: LoadedTextbookRetrievalIndex,
  row: number,
): number {
  const position = index.manifest.sourcePriority.indexOf(index.windows[row].bookId);
  return position === -1 ? Number.MAX_SAFE_INTEGER : position;
}

function fuseRanks(
  index: LoadedTextbookRetrievalIndex,
  lexical: Array<{ row: number; score: number }>,
  vector: Array<{ row: number; score: number }>,
  bm25: Array<{ row: number; score: number }>,
  sourceLocalVector: Array<{ row: number; score: number }>,
  limit: number,
): RankedCandidate[] {
  const fused = new Map<number, RankedCandidate>();
  const addRank = (
    candidates: Array<{ row: number; score: number }>,
    scoreKey: 'lexical' | 'vector' | 'bm25' | 'sourceLocalVector',
    weight: number,
  ) => {
    candidates.forEach((candidate, rank) => {
      const existing = fused.get(candidate.row);
      if (existing) {
        existing.scores[scoreKey] = candidate.score;
        existing.scores.fused += weight / (RRF_K + rank + 1);
      } else {
        fused.set(candidate.row, {
          row: candidate.row,
          scores: {
            [scoreKey]: candidate.score,
            fused: weight / (RRF_K + rank + 1),
          },
        });
      }
    });
  };
  addRank(lexical, 'lexical', 1);
  addRank(vector, 'vector', 1);
  addRank(bm25, 'bm25', BM25_RRF_WEIGHT);
  addRank(sourceLocalVector, 'sourceLocalVector', 1);
  return [...fused.values()].sort((left, right) =>
    right.scores.fused - left.scores.fused
    || sourcePriority(index, left.row) - sourcePriority(index, right.row)
    || left.row - right.row
  ).slice(0, limit);
}

async function readBody(
  index: LoadedTextbookRetrievalIndex,
  window: LoadedTextbookIndexWindow,
): Promise<string> {
  const bytes = Buffer.allocUnsafe(window.bodyLength);
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesRead } = await index.bodiesHandle.read(
      bytes,
      offset,
      bytes.length - offset,
      window.bodyOffset + offset,
    );
    if (bytesRead === 0) {
      throw new TextbookRetrievalContractError('unexpected end of bodies.utf8');
    }
    offset += bytesRead;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function embedQuery(
  index: LoadedTextbookRetrievalIndex,
  query: string,
  options: RetrievalOptions,
  timeoutMs: number,
): Promise<Float64Array> {
  const client = options.embeddingClient ?? new SiliconFlowTextbookEmbeddingClient();
  const response = await withTimeout(timeoutMs, (signal) => client.embed({
    model: index.manifest.model,
    input: query,
    signal,
  }), options.abortSignal);
  if (response.model !== undefined && response.model !== index.manifest.model) {
    throw new TextbookRetrievalProviderError(
      'embedding',
      'model-mismatch',
      response.traceId,
    );
  }
  return normalizeQueryVector(
    response.embedding,
    index.manifest.observedDimension,
  );
}

function validateRerankResults(
  results: unknown,
  length: number,
): Array<{ index: number; score: number }> {
  if (!Array.isArray(results)) {
    throw new TextbookRetrievalProviderError('rerank', 'invalid-response');
  }
  const seen = new Set<number>();
  return results.map((row) => {
    if (
      typeof row !== 'object'
      || row === null
      || !Number.isInteger((row as { index?: unknown }).index)
      || ((row as { index: number }).index < 0)
      || ((row as { index: number }).index >= length)
      || seen.has((row as { index: number }).index)
      || typeof (row as { score?: unknown }).score !== 'number'
      || !Number.isFinite((row as { score: number }).score)
    ) {
      throw new TextbookRetrievalProviderError('rerank', 'invalid-response');
    }
    seen.add((row as { index: number }).index);
    return row as { index: number; score: number };
  });
}

async function rerankCandidates(
  query: string,
  candidates: RankedCandidate[],
  options: RetrievalOptions,
  timeoutMs: number,
): Promise<RankedCandidate[]> {
  if (!options.rerankModel) return candidates;
  const client = options.rerankClient ?? new SiliconFlowTextbookRerankClient();
  const rerankable = candidates.slice(0, DEFAULT_CANDIDATE_COUNT);
  const response = await withTimeout(timeoutMs, (signal) => client.rerank({
    model: options.rerankModel as string,
    query,
    documents: rerankable.map((candidate, index) => ({
      index,
      text: candidate.body as string,
    })),
    signal,
  }), options.abortSignal);
  const results = validateRerankResults(response.results, rerankable.length);
  const returned = new Set(results.map((result) => result.index));
  const ranked = [...results].sort((left, right) =>
    right.score - left.score || left.index - right.index)
    .map(({ index, score }) => {
      rerankable[index].scores.rerank = score;
      return rerankable[index];
    });
  rerankable.forEach((candidate, index) => {
    if (!returned.has(index)) ranked.push(candidate);
  });
  ranked.push(...candidates.slice(DEFAULT_CANDIDATE_COUNT));
  return ranked;
}

function publicResults(
  index: LoadedTextbookRetrievalIndex,
  candidates: RankedCandidate[],
): TextbookRetrievalResult[] {
  return candidates.map((candidate) => {
    const window = index.windows[candidate.row];
    return {
      windowId: window.id,
      primaryUnitId: window.primaryUnitId,
      owningUnitIds: [...window.owningUnitIds],
      segments: window.segments.map((segment) => ({
        owningUnitId: segment.owningUnitId,
        body: Buffer.from(candidate.body as string, 'utf8')
          .subarray(segment.bodyOffset, segment.bodyOffset + segment.bodyLength)
          .toString('utf8'),
      })),
      bookId: window.bookId,
      sourcePaths: [...window.sourcePaths],
      body: candidate.body as string,
      scores: { ...candidate.scores },
    };
  });
}

export async function retrieveTextbookHybrid(
  query: string,
  options: RetrievalOptions,
): Promise<TextbookRetrievalResponse> {
  if (typeof query !== 'string') {
    throw new TypeError('textbook retrieval query must be a string');
  }
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery.trim()) {
    throw new TextbookRetrievalContractError('query must not be empty');
  }
  const externalRetrievalEnabled = options.externalQuery !== null;
  const normalizedExternalQuery = externalRetrievalEnabled
    ? normalizeText(options.externalQuery ?? query)
    : '';
  if (externalRetrievalEnabled && !normalizedExternalQuery.trim()) {
    throw new TextbookRetrievalContractError('external query must not be empty');
  }
  const resolved = validateOptions(options);
  const index = await loadTextbookRetrievalIndex(options.indexRoot);
  if (index.closed) throw new TextbookRetrievalContractError('index is closed');
  const allowedRows = resolveScopedRows(index, options);
  const diagnostics: RetrievalDiagnostic[] = [];
  const lexical = lexicalRank(index, normalizedQuery, allowedRows);
  const bm25 = bm25Rank(index, normalizedQuery, allowedRows);
  let vector: Array<{ row: number; score: number }> = [];
  let mode: TextbookRetrievalResponse['mode'] = 'lexical';

  if (externalRetrievalEnabled) {
    const embeddingStarted = performance.now();
    try {
      const queryVector = await embedQuery(
        index,
        normalizedExternalQuery,
        options,
        resolved.embeddingTimeoutMs,
      );
      vector = vectorRank(index, queryVector, allowedRows);
      mode = 'lexical-vector';
    } catch (error) {
      const traceId = error instanceof TextbookRetrievalProviderError
        ? error.traceId
        : undefined;
      diagnostics.push(diagnostic(
        'embedding',
        providerCode(error),
        embeddingStarted,
        traceId,
      ));
    }
  }

  const fused = fuseRanks(
    index,
    lexical,
    vector,
    bm25,
    sourceLocalVectorRank(index, normalizedQuery, vector),
    resolved.candidateCount,
  );
  await Promise.all(fused.map(async (candidate) => {
    candidate.body = await readBody(index, index.windows[candidate.row]);
  }));

  let ordered = fused;
  if (externalRetrievalEnabled && options.rerankModel && vector.length > 0) {
    const rerankStarted = performance.now();
    try {
      ordered = await rerankCandidates(
        normalizedExternalQuery,
        fused,
        options,
        resolved.rerankTimeoutMs,
      );
    } catch (error) {
      const traceId = error instanceof TextbookRetrievalProviderError
        ? error.traceId
        : undefined;
      diagnostics.push(diagnostic(
        'rerank',
        providerCode(error),
        rerankStarted,
        traceId,
      ));
      ordered = fused;
    }
  }

  return {
    mode,
    results: publicResults(index, ordered.slice(0, resolved.topK)),
    ...(process.env.NODE_ENV !== 'production' && diagnostics.length > 0
      ? { diagnostics }
      : {}),
  };
}

function remainingMs(deadline: number, now: () => number): number {
  return Math.max(0, deadline - now());
}

async function waitUntil(
  deadline: number,
  now: () => number,
  signal?: AbortSignal,
): Promise<'elapsed' | 'aborted'> {
  const delay = remainingMs(deadline, now);
  if (delay <= 0) return 'elapsed';
  if (signal?.aborted) return 'aborted';
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (timer) clearTimeout(timer);
      resolve('aborted');
    };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve('elapsed');
    }, delay);
  });
}

export async function retrieveTextbookHybridProgressive(
  query: string,
  options: RetrievalOptions,
): Promise<TextbookProgressiveRetrievalResponse> {
  if (typeof query !== 'string') {
    throw new TypeError('textbook retrieval query must be a string');
  }
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery.trim()) {
    throw new TextbookRetrievalContractError('query must not be empty');
  }
  const externalRetrievalEnabled = options.externalQuery !== null;
  const normalizedExternalQuery = externalRetrievalEnabled
    ? normalizeText(options.externalQuery ?? query)
    : '';
  if (externalRetrievalEnabled && !normalizedExternalQuery.trim()) {
    throw new TextbookRetrievalContractError('external query must not be empty');
  }
  const now = options.now ?? (() => performance.now());
  const started = now();
  const resolved = validateOptions(options);
  const foregroundDeadline = started + resolved.foregroundWaitMs;
  const absoluteDeadline = started + resolved.backgroundWaitLimitMs;
  const index = await loadTextbookRetrievalIndex(options.indexRoot);
  if (index.closed) throw new TextbookRetrievalContractError('index is closed');
  const allowedRows = resolveScopedRows(index, options);

  const lexical = lexicalRank(index, normalizedQuery, allowedRows);
  const bm25 = bm25Rank(index, normalizedQuery, allowedRows);
  const foregroundCandidates = fuseRanks(
    index,
    lexical,
    [],
    bm25,
    [],
    resolved.candidateCount,
  );
  await Promise.all(foregroundCandidates.map(async (candidate) => {
    candidate.body = await readBody(index, index.windows[candidate.row]);
  }));
  const foreground: TextbookRetrievalResponse = {
    mode: 'lexical',
    results: publicResults(index, foregroundCandidates.slice(0, resolved.topK)),
  };
  if (!externalRetrievalEnabled) {
    return {
      foreground,
      optimizationPending: false,
      continuation: null,
    };
  }

  const external = (async (): Promise<TextbookRetrievalContinuationResult> => {
    const diagnostics: RetrievalDiagnostic[] = [];
    if (options.abortSignal?.aborted) return { status: 'aborted' };
    if (remainingMs(absoluteDeadline, now) <= 0) return { status: 'capped' };

    let vector: Array<{ row: number; score: number }> = [];
    const embeddingStarted = performance.now();
    try {
      const queryVector = await embedQuery(
        index,
        normalizedExternalQuery,
        options,
        Math.max(1, Math.min(
          resolved.embeddingTimeoutMs,
          remainingMs(absoluteDeadline, now),
        )),
      );
      vector = vectorRank(index, queryVector, allowedRows);
    } catch (error) {
      if (options.abortSignal?.aborted) return { status: 'aborted' };
      const traceId = error instanceof TextbookRetrievalProviderError
        ? error.traceId
        : undefined;
      diagnostics.push(diagnostic(
        'embedding',
        providerCode(error),
        embeddingStarted,
        traceId,
      ));
    }
    if (remainingMs(absoluteDeadline, now) <= 0) return { status: 'capped' };

    const fused = fuseRanks(
      index,
      lexical,
      vector,
      bm25,
      sourceLocalVectorRank(index, normalizedQuery, vector),
      resolved.candidateCount,
    );
    await Promise.all(fused.map(async (candidate) => {
      candidate.body = await readBody(index, index.windows[candidate.row]);
    }));
    let ordered = fused;
    if (options.rerankModel && vector.length > 0) {
      const rerankStarted = performance.now();
      try {
        ordered = await rerankCandidates(
          normalizedExternalQuery,
          fused,
          options,
          Math.max(1, Math.min(
            resolved.rerankTimeoutMs,
            remainingMs(absoluteDeadline, now),
          )),
        );
      } catch (error) {
        if (options.abortSignal?.aborted) return { status: 'aborted' };
        const traceId = error instanceof TextbookRetrievalProviderError
          ? error.traceId
          : undefined;
        diagnostics.push(diagnostic(
          'rerank',
          providerCode(error),
          rerankStarted,
          traceId,
        ));
        ordered = fused;
      }
    }
    if (remainingMs(absoluteDeadline, now) <= 0) return { status: 'capped' };
    return {
      status: 'complete',
      response: {
        mode: vector.length > 0 ? 'lexical-vector' : 'lexical',
        results: publicResults(index, ordered.slice(0, resolved.topK)),
        ...(process.env.NODE_ENV !== 'production' && diagnostics.length > 0
          ? { diagnostics }
          : {}),
      },
    };
  })().catch((): TextbookRetrievalContinuationResult => ({ status: 'failed' }));

  const raced = await Promise.race([
    external.then((result) => ({ type: 'external' as const, result })),
    waitUntil(foregroundDeadline, now, options.abortSignal)
      .then((status) => ({ type: status as 'elapsed' | 'aborted' })),
  ]);
  if (raced.type === 'aborted') {
    return {
      foreground,
      optimizationPending: false,
      continuation: Promise.resolve({ status: 'aborted' }),
    };
  }
  if (
    raced.type === 'external'
    && now() < foregroundDeadline
    && raced.result.status === 'complete'
  ) {
    return {
      foreground: raced.result.response,
      optimizationPending: false,
      continuation: null,
    };
  }
  if (raced.type === 'external' && raced.result.status !== 'complete') {
    return {
      foreground,
      optimizationPending: false,
      continuation: null,
    };
  }
  return {
    foreground,
    optimizationPending: true,
    continuation: external,
  };
}

export const retrieve = retrieveTextbookHybrid;
