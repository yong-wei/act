import type { SourcePackItem } from './types';
import type { SourcePackRetrievalProfile } from './retrieval-profiles';

export interface SourcePackRankingContext {
  query: string;
  graphNodeRefs?: readonly string[];
  capabilityTargetRefs?: readonly string[];
  qualityTargetRefs?: readonly string[];
  learningGoalIds?: readonly string[];
  resourceIds?: readonly string[];
  learnerContextRefs?: readonly string[];
  semanticScores?: Record<string, number>;
}

export interface SourcePackRankingSignals {
  exact: number;
  lexical: number;
  graph: number;
  authority: number;
  freshness: number;
  learnerContext: number;
  eligibility: number;
  semantic: number;
}

export interface RankedSourcePackCandidate {
  item: SourcePackItem;
  signals: SourcePackRankingSignals;
  score: number;
}

const TECHNICAL_TOKEN_PATTERN = /([A-Za-z]+\d+|[A-Za-z]+\/[A-Za-z]+|[A-Za-z]+[-_][A-Za-z]+|[A-Za-z]*\([^)]*\)|[A-Za-z]\([^)]*\)|[A-Za-z]+:\S+|\b\d+(?:\.\d+)?\b)/g;

export function rankSourcePackCandidates(
  items: readonly SourcePackItem[],
  context: SourcePackRankingContext,
  profile: SourcePackRetrievalProfile,
): RankedSourcePackCandidate[] {
  return items
    .map((item) => {
      const signals = scoreItem(item, context);
      return {
        item,
        signals,
        score: fuseSignals(signals, profile),
      };
    })
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
}

function scoreItem(item: SourcePackItem, context: SourcePackRankingContext): SourcePackRankingSignals {
  const searchable = normalizeText([
    item.id,
    item.title,
    item.excerpt,
    item.inclusionRationale,
    item.sourceKind,
    item.modality,
    item.retrievalChunkId,
    item.citationTargetId,
    item.resourceNodeId,
    item.planningUnitId,
    ...(item.metadata ? Object.values(item.metadata).flatMap(metadataValueToText) : []),
  ].join(' '));
  const query = normalizeText(context.query);
  const queryTokens = tokenize(query);
  const technicalTokens = extractTechnicalTokens(context.query);
  const exact = exactScore(searchable, query, technicalTokens);
  return {
    exact,
    lexical: lexicalScore(searchable, queryTokens),
    graph: graphScore(item, context),
    authority: clamp(item.scores.authority ?? item.scores.relevance ?? 0.5),
    freshness: clamp(item.scores.freshness ?? 0.5),
    learnerContext: contextRefScore(item, context.learnerContextRefs ?? []),
    eligibility: clamp(item.scores.eligibility ?? (item.resourceNodeId || item.planningUnitId ? 0.8 : 0.45)),
    semantic: clamp(context.semanticScores?.[item.id] ?? 0),
  };
}

function fuseSignals(signals: SourcePackRankingSignals, profile: SourcePackRetrievalProfile): number {
  const weights = profile.rankingWeights;
  const weighted = (
    signals.exact * weights.exact
    + signals.lexical * weights.lexical
    + signals.graph * weights.graph
    + signals.authority * weights.authority
    + signals.freshness * weights.freshness
    + signals.learnerContext * weights.learnerContext
    + signals.eligibility * weights.eligibility
    + signals.semantic * weights.semantic
  );
  const exactFloor = signals.exact > 0 ? 0.62 + signals.exact * 0.18 : 0;
  const contextTieBreak = signals.graph * 0.01 + signals.learnerContext * 0.01;
  return roundScore(Math.max(weighted, exactFloor) + contextTieBreak);
}

function exactScore(searchable: string, query: string, technicalTokens: readonly string[]): number {
  if (query && searchable.includes(query)) return 1;
  if (technicalTokens.length === 0) return 0;
  const matches = technicalTokens.filter((token) => searchable.includes(normalizeText(token))).length;
  return clamp(matches / technicalTokens.length);
}

function lexicalScore(searchable: string, queryTokens: readonly string[]): number {
  if (queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((token) => searchable.includes(token)).length;
  return clamp(matches / queryTokens.length);
}

function graphScore(item: SourcePackItem, context: SourcePackRankingContext): number {
  const refs = [
    ...(context.graphNodeRefs ?? []),
    ...(context.capabilityTargetRefs ?? []),
    ...(context.qualityTargetRefs ?? []),
    ...(context.learningGoalIds ?? []),
    ...(context.resourceIds ?? []),
  ];
  if (refs.length === 0) return clamp(item.scores.graphAlignment ?? 0);
  return Math.max(contextRefScore(item, refs), clamp(item.scores.graphAlignment ?? 0) * 0.25);
}

function contextRefScore(item: SourcePackItem, refs: readonly string[]): number {
  if (refs.length === 0) return 0;
  const itemRefs = new Set([
    item.id,
    item.retrievalChunkId,
    item.citationTargetId,
    item.resourceNodeId,
    item.planningUnitId,
    ...metadataStringArray(item.metadata?.knowledgeNodeRefs),
    ...metadataStringArray(item.metadata?.capabilityTargetRefs),
    ...metadataStringArray(item.metadata?.qualityTargetRefs),
    ...metadataStringArray(item.metadata?.learningGoalIds),
    ...metadataStringArray(item.metadata?.resourceIds),
    ...metadataStringArray(item.metadata?.learnerContextRefs),
  ].filter((value): value is string => Boolean(value)));
  const matches = refs.filter((ref) => itemRefs.has(ref)).length;
  return clamp(matches / refs.length);
}

function metadataStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

function metadataValueToText(value: string | number | boolean | string[]): string[] {
  return Array.isArray(value) ? value : [String(value)];
}

function tokenize(value: string): string[] {
  return Array.from(new Set(value.split(/[^a-z0-9]+/).filter((token) => token.length >= 2)));
}

function extractTechnicalTokens(value: string): string[] {
  return Array.from(new Set(value.match(TECHNICAL_TOKEN_PATTERN)?.map(normalizeText).filter(Boolean) ?? []));
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFKC').trim();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function roundScore(value: number): number {
  return Math.round(clamp(value) * 1000) / 1000;
}
