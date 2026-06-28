import { buildSourcePack } from './builder';
import { diversifyRankedSourcePackItems } from './pack-diversifier';
import { rankSourcePackCandidates, type RankedSourcePackCandidate, type SourcePackRankingContext } from './pack-ranker';
import { getSourcePackRetrievalProfile, type SourcePackCallerRole } from './retrieval-profiles';
import type {
  SourcePack,
  SourcePackAccessVisibility,
  SourcePackItem,
  SourcePackLimitation,
  SourcePackProfile,
  SourcePackQuery,
} from './types';

export interface RetrieveSourcePackInput extends SourcePackRankingContext {
  profile: SourcePackProfile;
  role?: SourcePackCallerRole;
  caller?: string;
  topK?: number;
  candidates: readonly SourcePackItem[];
  limitations?: readonly SourcePackLimitation[];
  now?: Date;
}

export interface RetrieveSourcePackResult {
  pack: SourcePack;
  ranked: RankedSourcePackCandidate[];
  eligibleItems: SourcePackItem[];
  excludedCount: number;
  limitations: SourcePackLimitation[];
}

interface FilterResult {
  eligible: SourcePackItem[];
  limitations: SourcePackLimitation[];
  excludedCount: number;
}

export function retrieveSourcePack(input: RetrieveSourcePackInput): RetrieveSourcePackResult {
  const normalizedInput = normalizeRetrievalInput(input);
  const profile = getSourcePackRetrievalProfile(input.profile);
  const role = normalizeCallerRole(input.role ?? profile.defaultRole);
  const filtered = filterCandidates(input.candidates, input, role);
  const ranked = rankSourcePackCandidates(filtered.eligible, normalizedInput, profile);
  const diversified = diversifyRankedSourcePackItems({
    ranked,
    profile,
    topK: input.topK,
  });
  const limitations = [
    ...inputLimitationsForPack(input.limitations ?? [], role),
    ...filtered.limitations,
    ...diversified.limitations,
    ...coverageLimitations(diversified.items, normalizedInput),
  ];
  if (filtered.eligible.length === 0) {
    limitations.push(buildLimitation('source-pack-no-eligible-candidates', 'No candidates remained after profile policy filtering.', 'warning'));
  }
  const query: SourcePackQuery = {
    queryId: stableQueryId(input.profile, input.query),
    text: input.query,
    profile: input.profile,
    caller: input.caller,
    topK: input.topK ?? profile.budgets.maxItems,
    filters: queryFilters(normalizedInput, role),
  };
  const pack = buildSourcePack({
    query,
    items: diversified.items,
    limitations,
    coverage: {
      eligibleItems: filtered.eligible.length,
      omittedItems: diversified.omittedCount,
      coverageRatio: filtered.eligible.length > 0
        ? Math.min(1, diversified.items.length / filtered.eligible.length)
        : 0,
      notes: filtered.excludedCount > 0
        ? [`${filtered.excludedCount} candidate(s) were excluded by profile policy before ranking.`]
        : undefined,
    },
    indexRefs: {
      projectionVersion: 'source-pack.hybrid-retriever.v1',
    },
    now: input.now,
  });
  return {
    pack,
    ranked,
    eligibleItems: filtered.eligible,
    excludedCount: filtered.excludedCount,
    limitations,
  };
}

function filterCandidates(
  candidates: readonly SourcePackItem[],
  input: RetrieveSourcePackInput,
  role: SourcePackCallerRole,
): FilterResult {
  const profile = getSourcePackRetrievalProfile(input.profile);
  const roleVisibility = visibilityForRole(role);
  const eligible: SourcePackItem[] = [];
  const limitations: SourcePackLimitation[] = [];
  const exclusionCounts = new Map<string, number>();
  let excludedCount = 0;

  for (const item of candidates) {
    const reason = exclusionReason(item, profile, roleVisibility);
    if (reason) {
      excludedCount += 1;
      exclusionCounts.set(reason, (exclusionCounts.get(reason) ?? 0) + 1);
      continue;
    }
    if (input.profile === 'path-planning' && !item.resourceNodeId && !item.planningUnitId) {
      limitations.push(buildLimitation('path-planning-citation-only-evidence', `Candidate ${item.id} is supporting citation evidence, not a path-plannable resource.`, 'info'));
    }
    eligible.push(item);
  }
  for (const [reason, count] of exclusionCounts) {
    limitations.push(buildLimitation(
      `profile-filtered-${reason}`,
      `${count} candidate(s) were excluded by ${input.profile} ${reason} policy before ranking.`,
    ));
  }
  return { eligible, limitations, excludedCount };
}

function exclusionReason(
  item: SourcePackItem,
  profile: ReturnType<typeof getSourcePackRetrievalProfile>,
  roleVisibility: ReadonlySet<SourcePackAccessVisibility>,
): string | null {
  if (!roleVisibility.has(item.access.visibility) || !profile.allowedVisibility.includes(item.access.visibility)) return 'visibility';
  if (profile.requireAiUseAllowed && !item.access.aiUseAllowed) return 'ai-use';
  if (!profile.allowedSourceKinds.includes(item.sourceKind)) return 'source-kind';
  if (profile.allowedReviewStatuses && !profile.allowedReviewStatuses.includes(reviewStatus(item))) return 'review-state';
  if (profile.rejectAnswerLeakage && hasAnswerLeakage(item)) return 'answer-leakage';
  if (profile.requireCitationReady && !hasCitationReadyIdentifier(item)) return 'citation-readiness';
  return null;
}

function visibilityForRole(role: SourcePackCallerRole): ReadonlySet<SourcePackAccessVisibility> {
  if (role === 'admin' || role === 'service') return new Set(['public', 'student', 'teacher', 'admin', 'restricted']);
  if (role === 'teacher') return new Set(['public', 'student', 'teacher']);
  return new Set(['public', 'student']);
}

function normalizeCallerRole(role: SourcePackCallerRole): SourcePackCallerRole {
  if (role === 'admin' || role === 'service' || role === 'teacher') return role;
  return 'student';
}

function inputLimitationsForPack(
  limitations: readonly SourcePackLimitation[],
  role: SourcePackCallerRole,
): SourcePackLimitation[] {
  if (role !== 'student') return [...limitations];
  if (limitations.length === 0) return [];
  return [buildLimitation(
    'upstream-limitations-redacted',
    `${limitations.length} upstream limitation(s) were withheld from this student-visible Source Pack.`,
    highestSeverity(limitations),
  )];
}

function highestSeverity(limitations: readonly SourcePackLimitation[]): SourcePackLimitation['severity'] {
  if (limitations.some((limitation) => limitation.severity === 'blocking')) return 'blocking';
  if (limitations.some((limitation) => limitation.severity === 'warning')) return 'warning';
  return 'info';
}

function reviewStatus(item: SourcePackItem): string {
  const value = item.metadata?.reviewStatus ?? item.metadata?.authorityLevel;
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function hasAnswerLeakage(item: SourcePackItem): boolean {
  const metadata = item.metadata ?? {};
  return metadata.answerLeakage === true
    || metadata.containsAnswer === true
    || metadata.sourceType === 'raw-answer'
    || /raw answer|answer key|answers?\s+to\s+(?:skills?\s+)?check|answers?-to-skills?-check|\u7b54\u6848/.test(answerLeakageText(item));
}

function hasCitationReadyIdentifier(item: SourcePackItem): boolean {
  return Boolean(item.citationTargetId || item.citation?.citationTargetId);
}

function answerLeakageText(item: SourcePackItem): string {
  const metadataText = Object.values(item.metadata ?? {})
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number | boolean => (
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ))
    .join(' ');
  return `${item.id} ${item.title} ${item.excerpt} ${metadataText}`.toLowerCase();
}

function coverageLimitations(items: readonly SourcePackItem[], input: RetrieveSourcePackInput): SourcePackLimitation[] {
  const limitations: SourcePackLimitation[] = [];
  const checks = [
    { refs: input.graphNodeRefs, covers: coversMetadataRef('knowledgeNodeRefs'), code: 'coverage-missing-knowledge-node', label: 'knowledge node' },
    { refs: input.capabilityTargetRefs, covers: coversMetadataRef('capabilityTargetRefs'), code: 'coverage-missing-capability-target', label: 'capability target' },
    { refs: input.qualityTargetRefs, covers: coversMetadataRef('qualityTargetRefs'), code: 'coverage-missing-quality-target', label: 'quality target' },
    { refs: input.learningGoalIds, covers: coversMetadataRef('learningGoalIds'), code: 'coverage-missing-learning-goal', label: 'learning goal' },
    { refs: input.resourceIds, covers: coversResourceRef, code: 'coverage-missing-resource', label: 'resource' },
  ] as const;
  for (const check of checks) {
    for (const ref of check.refs ?? []) {
      if (!items.some((item) => check.covers(item, ref))) {
        limitations.push(buildLimitation(check.code, `No selected Source Pack item covers ${check.label} ${ref}.`));
      }
    }
  }
  return limitations;
}

function coversMetadataRef(key: string): (item: SourcePackItem, ref: string) => boolean {
  return (item, ref) => metadataIncludes(item, key, ref);
}

function coversResourceRef(item: SourcePackItem, ref: string): boolean {
  return item.id === ref
    || item.retrievalChunkId === ref
    || item.citationTargetId === ref
    || item.resourceNodeId === ref
    || item.planningUnitId === ref
    || metadataIncludes(item, 'resourceId', ref)
    || metadataIncludes(item, 'resourceIds', ref);
}

function normalizeRetrievalInput(input: RetrieveSourcePackInput): RetrieveSourcePackInput {
  return {
    ...input,
    graphNodeRefs: normalizeStringRefs(input.graphNodeRefs),
    capabilityTargetRefs: normalizeStringRefs(input.capabilityTargetRefs),
    qualityTargetRefs: normalizeStringRefs(input.qualityTargetRefs),
    learningGoalIds: normalizeStringRefs(input.learningGoalIds),
    resourceIds: normalizeStringRefs(input.resourceIds),
    learnerContextRefs: normalizeStringRefs(input.learnerContextRefs),
    semanticScores: normalizeSemanticScores(input.semanticScores),
  };
}

function queryFilters(input: RetrieveSourcePackInput, role: SourcePackCallerRole): SourcePackQuery['filters'] {
  const filters: NonNullable<SourcePackQuery['filters']> = {
    role,
    requestedProfile: input.profile,
  };
  addStringArrayFilter(filters, 'graphNodeRefs', input.graphNodeRefs);
  addStringArrayFilter(filters, 'capabilityTargetRefs', input.capabilityTargetRefs);
  addStringArrayFilter(filters, 'qualityTargetRefs', input.qualityTargetRefs);
  addStringArrayFilter(filters, 'learningGoalIds', input.learningGoalIds);
  addStringArrayFilter(filters, 'resourceIds', input.resourceIds);
  addStringArrayFilter(filters, 'learnerContextRefs', input.learnerContextRefs);
  if (input.semanticScores) {
    for (const [id, score] of Object.entries(input.semanticScores).sort(([left], [right]) => compareCodeUnit(left, right))) {
      filters[`semanticScore:${id}`] = score;
    }
  }
  return filters;
}

function addStringArrayFilter(
  filters: NonNullable<SourcePackQuery['filters']>,
  key: string,
  values: readonly string[] | undefined,
): void {
  const normalized = normalizeStringRefs(values);
  if (normalized) filters[key] = normalized;
}

function normalizeStringRefs(values: readonly string[] | undefined): string[] | undefined {
  const normalized = Array.from(new Set((values ?? []).filter((value) => value.length > 0))).sort(compareCodeUnit);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSemanticScores(scores: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!scores) return undefined;
  const entries = Object.entries(scores)
    .filter(([id, score]) => id.length > 0 && Number.isFinite(score))
    .sort(([left], [right]) => compareCodeUnit(left, right))
    .map(([id, score]) => [id, Math.round(score * 1000) / 1000] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function metadataIncludes(item: SourcePackItem, key: string, ref: string): boolean {
  const value = item.metadata?.[key];
  return Array.isArray(value) ? value.includes(ref) : value === ref;
}

function stableQueryId(profile: SourcePackProfile, query: string): string {
  const normalized = `${profile}:${query}`
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_.:-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const base = normalized.slice(0, 72) || `${profile}:source-pack`;
  return `query:${base}:${hashString(query).slice(0, 8)}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildLimitation(code: string, message: string, severity: SourcePackLimitation['severity'] = 'warning'): SourcePackLimitation {
  return {
    code,
    severity,
    message,
    source: 'source-pack.hybrid-retriever',
    recoverable: true,
  };
}
