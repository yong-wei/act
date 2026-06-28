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
  const profile = getSourcePackRetrievalProfile(input.profile);
  const role = normalizeCallerRole(input.role ?? profile.defaultRole);
  const filtered = filterCandidates(input.candidates, input, role);
  const ranked = rankSourcePackCandidates(filtered.eligible, input, profile);
  const diversified = diversifyRankedSourcePackItems({
    ranked,
    profile,
    topK: input.topK,
  });
  const limitations = [
    ...inputLimitationsForPack(input.limitations ?? [], role),
    ...filtered.limitations,
    ...diversified.limitations,
    ...coverageLimitations(diversified.items, input),
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
    filters: {
      role,
      requestedProfile: input.profile,
    },
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
    || /raw answer|answer key|\u7b54\u6848/.test(`${item.title} ${item.excerpt}`.toLowerCase());
}

function hasCitationReadyIdentifier(item: SourcePackItem): boolean {
  return Boolean(item.citationTargetId || item.citation?.citationTargetId);
}

function coverageLimitations(items: readonly SourcePackItem[], input: RetrieveSourcePackInput): SourcePackLimitation[] {
  const limitations: SourcePackLimitation[] = [];
  for (const ref of input.graphNodeRefs ?? []) {
    if (!items.some((item) => metadataIncludes(item, 'knowledgeNodeRefs', ref))) {
      limitations.push(buildLimitation('coverage-missing-knowledge-node', `No selected Source Pack item covers knowledge node ${ref}.`));
    }
  }
  for (const ref of input.capabilityTargetRefs ?? []) {
    if (!items.some((item) => metadataIncludes(item, 'capabilityTargetRefs', ref))) {
      limitations.push(buildLimitation('coverage-missing-capability-target', `No selected Source Pack item covers capability target ${ref}.`));
    }
  }
  return limitations;
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
