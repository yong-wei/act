import 'server-only';

import path from 'node:path';

import {
  buildTextbookReaderHref,
  loadTextbookCitationUnits,
  type TextbookCitationUnit,
} from '@/lib/textbook-reader';
import {
  getSharedTextbookRetrievalIndex,
  lexicalTokens,
  retrieveTextbookHybrid,
  retrieveTextbookHybridProgressive,
  type LoadedTextbookRetrievalIndex,
  type RetrievalOptions,
  type TextbookProgressiveRetrievalResponse,
  type TextbookRetrievalContinuationResult,
  type TextbookRetrievalResponse,
} from '@/lib/textbook-retrieval';

const DEFAULT_MAX_TEXT_CHARS = 1_600;
const DEFAULT_TOP_K = 6;
const FOREGROUND_WAIT_MS = 2_000;
const BACKGROUND_WAIT_LIMIT_MS = 2_500;
const EMBEDDING_TIMEOUT_MS = 1_000;
const RERANK_TIMEOUT_MS = 2_000;
const RERANK_MODEL = 'BAAI/bge-reranker-v2-m3';
const APPROVED_SOURCE_PRIORITY = [
  'hu-shousong-auto-control-8th',
  'liu-sheng-auto-control-2015',
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-7th',
  'hu-shousong-exercise-analysis-3rd',
  'control-encyclopedia',
] as const;
const SUPPLEMENTAL_SOURCE_IDS = new Set<string>([
  'hu-shousong-auto-control-7th',
  'hu-shousong-exercise-analysis-3rd',
  'control-encyclopedia',
]);
const DEFAULT_INDEX_ROOT = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbook-retrieval',
);

type RetrieveTextbook = (
  query: string,
  options: RetrievalOptions,
) => Promise<TextbookRetrievalResponse>;

type RetrieveTextbookProgressive = (
  query: string,
  options: RetrievalOptions,
) => Promise<TextbookProgressiveRetrievalResponse>;

type LoadIndex = (indexRoot: string) => Promise<LoadedTextbookRetrievalIndex>;

type LoadUnits = typeof loadTextbookCitationUnits;

export interface TextbookV2CitationIdentity {
  kind: 'unit' | 'fragment';
  unitId: string;
  fragmentId: string | null;
  bookId: string;
  edition: string;
  sourceRevision: string;
  structuralPath: string[];
}

export interface TextbookV2ToolCandidate {
  displayNumber: number;
  title: string;
  text: string;
  identity: TextbookV2CitationIdentity;
  href: string;
  priority: number;
  limitation: string | null;
}

export interface TextbookV2ToolResult {
  mode: TextbookRetrievalResponse['mode'];
  candidates: TextbookV2ToolCandidate[];
  limitations: string[];
  diagnostics: Array<{
    stage: 'embedding' | 'rerank';
    code: string;
  }>;
}

export type TextbookV2OptimizationResult =
  | {
      status: 'complete';
      result: TextbookV2ToolResult;
    }
  | {
      status: 'aborted' | 'capped' | 'failed';
    };

export interface TextbookV2ProgressiveToolResult {
  foreground: TextbookV2ToolResult;
  optimizationPending: boolean;
  continuation: Promise<TextbookV2OptimizationResult> | null;
}

export interface RetrieveTextbookSourcePackV2Input {
  query: string;
  externalQuery?: string;
  graphNodeRefs?: readonly string[];
  indexRoot?: string;
  runtimeRoot?: string;
  topK?: number;
  maxTextChars?: number;
  retrieve?: RetrieveTextbook;
  loadIndex?: LoadIndex;
  loadUnits?: LoadUnits;
}

export interface RetrieveTextbookSourcePackV2ProgressiveInput
  extends RetrieveTextbookSourcePackV2Input {
  abortSignal?: AbortSignal;
  retrieveProgressive?: RetrieveTextbookProgressive;
}

export async function retrieveTextbookSourcePackV2(
  input: RetrieveTextbookSourcePackV2Input,
): Promise<TextbookV2ToolResult> {
  const query = input.query.trim();
  if (!query) throw new TypeError('textbook retrieval query must not be empty');
  const graphNodeRefs = uniqueStrings(input.graphNodeRefs ?? []).slice(0, 8);
  const retrievalQuery = graphNodeRefs.length > 0
    ? `${query}\n${graphNodeRefs.join(' ')}`
    : query;
  const externalQuery = input.externalQuery?.trim() || query;
  const indexRoot = input.indexRoot
    ?? process.env.ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT
    ?? DEFAULT_INDEX_ROOT;
  const retrieve = input.retrieve ?? retrieveTextbookHybrid;
  const loadIndex = input.loadIndex ?? getSharedTextbookRetrievalIndex;
  const loadUnits = input.loadUnits ?? loadTextbookCitationUnits;
  const [retrieval, index] = await Promise.all([
    retrieve(retrievalQuery, {
      indexRoot,
      externalQuery,
      topK: Math.max(input.topK ?? DEFAULT_TOP_K, DEFAULT_TOP_K),
    }),
    loadIndex(indexRoot),
  ]);

  return adaptTextbookRetrievalResult({
    retrieval,
    index,
    query,
    evidenceQuery: query,
    graphNodeRefs,
    runtimeRoot: input.runtimeRoot,
    topK: input.topK,
    maxTextChars: input.maxTextChars,
    loadUnits,
  });
}

export async function retrieveTextbookSourcePackV2Progressive(
  input: RetrieveTextbookSourcePackV2ProgressiveInput,
): Promise<TextbookV2ProgressiveToolResult> {
  const query = input.query.trim();
  if (!query) throw new TypeError('textbook retrieval query must not be empty');
  const graphNodeRefs = uniqueStrings(input.graphNodeRefs ?? []).slice(0, 8);
  const retrievalQuery = graphNodeRefs.length > 0
    ? `${query}\n${graphNodeRefs.join(' ')}`
    : query;
  const externalQuery = input.externalQuery?.trim() || query;
  const indexRoot = input.indexRoot
    ?? process.env.ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT
    ?? DEFAULT_INDEX_ROOT;
  const retrieveProgressive = input.retrieveProgressive
    ?? retrieveTextbookHybridProgressive;
  const loadIndex = input.loadIndex ?? getSharedTextbookRetrievalIndex;
  const loadUnits = input.loadUnits ?? loadTextbookCitationUnits;
  const [progressive, index] = await Promise.all([
    retrieveProgressive(retrievalQuery, {
      indexRoot,
      externalQuery,
      topK: Math.max(input.topK ?? DEFAULT_TOP_K, DEFAULT_TOP_K),
      embeddingTimeoutMs: EMBEDDING_TIMEOUT_MS,
      rerankModel: RERANK_MODEL,
      rerankTimeoutMs: RERANK_TIMEOUT_MS,
      foregroundWaitMs: FOREGROUND_WAIT_MS,
      backgroundWaitLimitMs: BACKGROUND_WAIT_LIMIT_MS,
      abortSignal: input.abortSignal,
    }),
    loadIndex(indexRoot),
  ]);
  const foreground = await adaptTextbookRetrievalResult({
    retrieval: progressive.foreground,
    index,
    query,
    evidenceQuery: query,
    graphNodeRefs,
    runtimeRoot: input.runtimeRoot,
    topK: input.topK,
    maxTextChars: input.maxTextChars,
    loadUnits,
  });
  const continuation = progressive.continuation
    ? progressive.continuation.then(async (outcome) =>
        adaptOptimizationResult(outcome, {
          index,
          query,
          evidenceQuery: query,
          graphNodeRefs,
          runtimeRoot: input.runtimeRoot,
          topK: input.topK,
          maxTextChars: input.maxTextChars,
          loadUnits,
        })).catch((): TextbookV2OptimizationResult => ({ status: 'failed' }))
    : null;
  return {
    foreground,
    optimizationPending: progressive.optimizationPending,
    continuation,
  };
}

async function adaptOptimizationResult(
  outcome: TextbookRetrievalContinuationResult,
  input: Omit<AdaptTextbookRetrievalInput, 'retrieval'>,
): Promise<TextbookV2OptimizationResult> {
  if (outcome.status !== 'complete') return outcome;
  return {
    status: 'complete',
    result: await adaptTextbookRetrievalResult({
      ...input,
      retrieval: outcome.response,
    }),
  };
}

interface AdaptTextbookRetrievalInput {
  retrieval: TextbookRetrievalResponse;
  index: LoadedTextbookRetrievalIndex;
  query: string;
  evidenceQuery: string;
  graphNodeRefs: readonly string[];
  runtimeRoot?: string;
  topK?: number;
  maxTextChars?: number;
  loadUnits: LoadUnits;
}

async function adaptTextbookRetrievalResult(
  input: AdaptTextbookRetrievalInput,
): Promise<TextbookV2ToolResult> {
  const owningBookIds = new Map<string, string>();
  const supportsByUnit = new Map<string, Array<{
    body: string;
    bookId: string;
    rank: number;
    score: number;
  }>>();
  input.retrieval.results.forEach((result, rank) => {
    owningBookIds.set(result.primaryUnitId, result.bookId);
    for (const unitId of result.owningUnitIds) {
      if (!owningBookIds.has(unitId)) owningBookIds.set(unitId, result.bookId);
      const supports = supportsByUnit.get(unitId) ?? [];
      supports.push({
        body: result.body,
        bookId: result.bookId,
        rank,
        score: result.scores.rerank ?? result.scores.fused,
      });
      supportsByUnit.set(unitId, supports);
    }
  });
  const requests = Array.from(groupUnitIdsByBook(owningBookIds), ([bookId, unitIds]) => ({
    bookId,
    unitIds,
  }));
  const units = await input.loadUnits({ requests, runtimeRoot: input.runtimeRoot });
  const sourcePriority = buildSourcePriority(input.index.manifest.sourcePriority);
  const maxTextChars = clamp(input.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS, 1, DEFAULT_MAX_TEXT_CHARS);
  const directlySupportingUnits = units
    .map((unit) => ({
      unit,
      supports: (supportsByUnit.get(unit.id) ?? [])
        .filter((support) => support.bookId === unit.bookId)
        .filter((support) => directlySupportsQuery(input.evidenceQuery, support.body))
        .sort((left, right) => left.rank - right.rank || right.score - left.score),
    }))
    .filter(({ supports }) => supports.length > 0)
    .sort((left, right) => (
      priorityFor(sourcePriority, left.unit.bookId) - priorityFor(sourcePriority, right.unit.bookId)
      || left.supports[0].rank - right.supports[0].rank
      || right.supports[0].score - left.supports[0].score
      || left.unit.id.localeCompare(right.unit.id)
    ));
  const hasPrimarySource = directlySupportingUnits.some(
    ({ unit }) => !SUPPLEMENTAL_SOURCE_IDS.has(unit.bookId),
  );
  const directUnits = directlySupportingUnits
    .filter(({ unit }) => hasPrimarySource || !SUPPLEMENTAL_SOURCE_IDS.has(unit.bookId))
    .slice(0, input.topK ?? DEFAULT_TOP_K);
  const candidates = directUnits.map(({ unit, supports }, indexInResult) =>
    toToolCandidate(
      unit,
      input.query,
      supports.map((support) => support.body),
      indexInResult + 1,
      sourcePriority,
      maxTextChars,
    ));

  return {
    mode: input.retrieval.mode,
    candidates,
    limitations: [
      ...(input.graphNodeRefs.length > 0 ? ['knowledge-graph-candidate-expansion-only'] : []),
      ...(candidates.length === 0 ? ['no-directly-supporting-textbook-unit'] : []),
      ...uniqueStrings(input.retrieval.diagnostics?.map((item) =>
        `retrieval-${item.stage}-${item.code}`) ?? []),
    ],
    diagnostics: (input.retrieval.diagnostics ?? []).map(({ stage, code }) => ({ stage, code })),
  };
}

function groupUnitIdsByBook(
  owningBookIds: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const [unitId, bookId] of owningBookIds) {
    const ids = grouped.get(bookId) ?? [];
    ids.push(unitId);
    grouped.set(bookId, ids);
  }
  return grouped;
}

function directlySupportsQuery(query: string, evidenceText: string): boolean {
  const queryTokens = new Set(lexicalTokens(query).filter(isEvidenceToken));
  if (queryTokens.size === 0) return false;
  const evidenceTokens = new Set(lexicalTokens(evidenceText));
  const matchingTokens = [...queryTokens].filter((token) => evidenceTokens.has(token)).length;
  return matchingTokens >= Math.max(1, Math.ceil(queryTokens.size * 0.6));
}

function isEvidenceToken(token: string): boolean {
  return token.length > 1 || /^[a-z0-9\\]/u.test(token);
}

function toToolCandidate(
  unit: TextbookCitationUnit,
  query: string,
  evidenceBodies: readonly string[],
  displayNumber: number,
  sourcePriority: ReadonlyMap<string, number>,
  maxTextChars: number,
): TextbookV2ToolCandidate {
  const fragment = selectDirectFragment(unit, query);
  const evidenceText = uniqueStrings(evidenceBodies).join('\n\n');
  return {
    displayNumber,
    title: unit.title,
    text: evidenceText.slice(0, maxTextChars),
    identity: {
      kind: fragment ? 'fragment' : 'unit',
      unitId: unit.id,
      fragmentId: fragment?.id ?? null,
      bookId: unit.bookId,
      edition: unit.edition,
      sourceRevision: unit.sourceRevision,
      structuralPath: [...unit.structuralPath],
    },
    href: buildTextbookReaderHref({
      bookId: unit.bookId,
      edition: unit.edition,
      unitPath: unit.structuralPath,
      fragment: fragment?.id,
    }),
    priority: priorityFor(sourcePriority, unit.bookId),
    limitation: evidenceText.length > maxTextChars ? 'candidate-text-truncated' : null,
  };
}

function selectDirectFragment(unit: TextbookCitationUnit, query: string) {
  const normalizedQuery = query.normalize('NFKC').toLowerCase();
  return unit.fragments.find((fragment) => {
    if (fragment.naturalNumber && normalizedQuery.includes(fragment.naturalNumber.toLowerCase())) {
      return true;
    }
    return normalizedQuery.includes(fragment.kind);
  }) ?? null;
}

function priorityFor(priority: ReadonlyMap<string, number>, bookId: string): number {
  return priority.get(bookId) ?? Number.MAX_SAFE_INTEGER;
}

function buildSourcePriority(indexPriority: readonly string[]): Map<string, number> {
  return new Map(uniqueStrings([
    ...APPROVED_SOURCE_PRIORITY,
    ...indexPriority,
  ]).map((bookId, position) => [bookId, position]));
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
