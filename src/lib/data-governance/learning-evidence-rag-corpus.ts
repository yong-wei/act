export const LEARNING_EVIDENCE_RAG_CORPUS_VERSION = 'learning-evidence-rag-corpus.v1';

export type LearningEvidenceCorpusSourceType =
  | 'course-content'
  | 'knowledge-card'
  | 'runtime-handout'
  | 'path-summary'
  | 'diagnosis'
  | 'grading-artifact'
  | 'simulation-summary'
  | 'arena-summary'
  | 'teacher-report';

export type LearningEvidenceCorpusFamily =
  | 'course-content'
  | 'knowledge-card'
  | 'runtime-handout'
  | 'path-evidence'
  | 'diagnosis'
  | 'grading'
  | 'simulation-arena'
  | 'report';

export type LearningEvidenceCorpusPrivacyClass =
  | 'public'
  | 'student-visible'
  | 'teacher-visible'
  | 'admin-only'
  | 'service-only';

export type LearningEvidenceRetrievalRole = 'student' | 'teacher' | 'admin' | 'service';
export type LearningEvidenceCitationUseCase = 'diagnosis' | 'grading' | 'konling' | 'recommendation' | 'teacher-report' | 'prep-pack';
export type LearningEvidenceConfidence = 'none' | 'low' | 'medium' | 'high';
export type LearningEvidenceAuthorityLevel = 'canonical' | 'verified' | 'contextual' | 'learner-evidence' | 'teacher-authored' | 'service-internal';
export type LearningEvidenceFreshnessBucket = 'current' | 'recent' | 'stale' | 'expired';
export type LearningEvidenceConflictSignal = 'supports' | 'contradicts' | null;

export interface LearningEvidenceScopeRule {
  visibility: LearningEvidenceCorpusPrivacyClass;
  allowedRoles: LearningEvidenceRetrievalRole[];
  ownerRequired?: boolean;
  classRequired?: boolean;
  privilegedDiagnostics?: boolean;
}

export interface LearningEvidenceAuthorityMetadata {
  level: LearningEvidenceAuthorityLevel;
  knowledgeTags: string[];
  pageAnchor: string | null;
  freshnessBucket: LearningEvidenceFreshnessBucket;
  scopeRule: LearningEvidenceScopeRule;
  conflictGroup?: string | null;
  conflictSignal?: LearningEvidenceConflictSignal;
}

export type LearningEvidenceCorpusChunkInput =
  Omit<LearningEvidenceCorpusChunk, 'authority'> & {
    authority?: Partial<Omit<LearningEvidenceAuthorityMetadata, 'scopeRule'>> & {
      scopeRule?: Partial<LearningEvidenceScopeRule>;
    };
  };

export interface LearningEvidenceCorpusChunk {
  id: string;
  family: LearningEvidenceCorpusFamily;
  sourceType: LearningEvidenceCorpusSourceType;
  sourceRef: {
    id: string;
    ownerUserId?: string | null;
    classId?: string | null;
    goalId?: string | null;
    resourceId?: string | null;
  };
  spanRef: {
    kind: 'text-range' | 'node' | 'record' | 'summary';
    start?: number | null;
    end?: number | null;
    locator?: string | null;
  };
  display: {
    title: string;
    href: string | null;
    capsule: string;
  };
  content: {
    text: string | null;
    redactedSummary: string | null;
    hash: string;
  };
  privacyClass: LearningEvidenceCorpusPrivacyClass;
  confidence: LearningEvidenceConfidence;
  freshness: {
    indexedAt: string;
    sourceUpdatedAt: string | null;
    expiresAt: string | null;
    stale: boolean;
  };
  authority: LearningEvidenceAuthorityMetadata;
  retrieval: {
    tags: string[];
    goals: string[];
    useCases: LearningEvidenceCitationUseCase[];
  };
}

export interface LearningEvidenceRetrievalScope {
  role: LearningEvidenceRetrievalRole;
  userId?: string | null;
  targetUserId?: string | null;
  classIds?: string[];
  goalId?: string | null;
  allowedSourceTypes?: LearningEvidenceCorpusSourceType[];
  useCase?: LearningEvidenceCitationUseCase;
  includePrivateText?: boolean;
}

export interface LearningEvidenceRetrievalQuery {
  text?: string;
  tags?: string[];
  limit?: number;
}

export interface LearningEvidenceCitationRef {
  chunkId: string;
  sourceType?: LearningEvidenceCorpusSourceType;
  useCase: LearningEvidenceCitationUseCase;
  quoteHash?: string;
  spanRef?: LearningEvidenceCorpusChunk['spanRef'];
}

export interface LearningEvidenceCitationPolicy {
  minimumAuthority?: LearningEvidenceAuthorityLevel;
  requireLearnerEvidence?: boolean;
  detectConflicts?: boolean;
  exposePrivacyRedaction?: boolean;
}

export interface LearningEvidenceCitationVerificationResult {
  status: 'verified' | 'rejected' | 'redacted' | 'downgraded';
  verifiedRefs: Array<{
    chunkId: string;
    sourceType: LearningEvidenceCorpusSourceType;
    displayTitle: string;
    displayHref: string | null;
    confidence: LearningEvidenceConfidence;
    capsule: string;
    authorityLevel: LearningEvidenceAuthorityLevel;
    freshnessBucket: LearningEvidenceFreshnessBucket;
    privacyVisibility: 'public' | 'redacted' | 'privileged';
  }>;
  limitations: Array<{
    chunkId: string;
    reason:
      | 'missing-chunk'
      | 'inaccessible-source'
      | 'unsupported-source-type'
      | 'privacy-violation'
      | 'source-type-mismatch'
      | 'quote-hash-mismatch'
      | 'span-ref-mismatch'
      | 'insufficient-authority'
      | 'missing-learner-evidence'
      | 'conflicting-source'
      | 'privacy-redacted'
      | 'low-confidence-source'
      | 'stale-source'
      | 'expired-source';
  }>;
}

export interface LearningEvidenceCitationChipPayload {
  chunkId: string;
  displayTitle: string;
  displayHref: string | null;
  sourceType: LearningEvidenceCorpusSourceType;
  authorityLevel: LearningEvidenceAuthorityLevel;
  confidence: LearningEvidenceConfidence;
  freshnessBucket: LearningEvidenceFreshnessBucket;
  privacyVisibility: 'public' | 'redacted' | 'privileged';
  limitationState: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null;
}

export interface LearningEvidenceCitationAuditPayload {
  chunkId: string;
  outcome: 'verified' | 'rejected' | 'redacted' | 'downgraded';
  reason: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null;
  reasons: Array<LearningEvidenceCitationVerificationResult['limitations'][number]['reason']>;
  citationChip: LearningEvidenceCitationChipPayload | null;
}

export const LEARNING_EVIDENCE_CORPUS_FAMILY_SOURCE_TYPES: Record<LearningEvidenceCorpusFamily, LearningEvidenceCorpusSourceType[]> = {
  'course-content': ['course-content'],
  'knowledge-card': ['knowledge-card'],
  'runtime-handout': ['runtime-handout'],
  'path-evidence': ['path-summary'],
  diagnosis: ['diagnosis'],
  grading: ['grading-artifact'],
  'simulation-arena': ['simulation-summary', 'arena-summary'],
  report: ['teacher-report'],
};

export const LEARNING_EVIDENCE_CORPUS_RETENTION_POLICY = {
  rebuildTriggers: ['source-updated', 'privacy-scope-changed', 'resource-registry-changed', 'manual-reindex'],
  invalidationSignals: ['stale-source-hash', 'expired-freshness-window', 'deleted-source', 'access-scope-revoked'],
  retention: {
    publicAndCourseContentDays: 365,
    learnerEvidenceDays: 180,
    serviceOnlyPrivateMemoryDays: 30,
  },
} as const;

const USE_CASE_SOURCE_TYPES: Record<LearningEvidenceCitationUseCase, Set<LearningEvidenceCorpusSourceType>> = {
  diagnosis: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'diagnosis', 'simulation-summary', 'arena-summary']),
  grading: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'grading-artifact', 'path-summary', 'simulation-summary', 'arena-summary']),
  konling: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'simulation-summary', 'arena-summary', 'diagnosis']),
  recommendation: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'simulation-summary', 'arena-summary', 'teacher-report']),
  'teacher-report': new Set(['path-summary', 'diagnosis', 'grading-artifact', 'simulation-summary', 'arena-summary', 'teacher-report']),
  'prep-pack': new Set(['course-content', 'knowledge-card', 'runtime-handout', 'diagnosis', 'grading-artifact', 'teacher-report']),
};

const KNOWLEDGE_SOURCE_TYPES = new Set<LearningEvidenceCorpusSourceType>(['course-content', 'knowledge-card', 'runtime-handout']);
const LEARNER_EVIDENCE_SOURCE_TYPES = new Set<LearningEvidenceCorpusSourceType>([
  'path-summary',
  'diagnosis',
  'grading-artifact',
  'simulation-summary',
  'arena-summary',
  'teacher-report',
]);
const SOURCE_AUTHORITY_LEVELS: Record<LearningEvidenceCorpusSourceType, Set<LearningEvidenceAuthorityLevel>> = {
  'course-content': new Set(['canonical', 'verified', 'contextual']),
  'knowledge-card': new Set(['canonical', 'verified', 'contextual']),
  'runtime-handout': new Set(['canonical', 'verified', 'contextual']),
  'path-summary': new Set(['learner-evidence', 'verified', 'service-internal']),
  diagnosis: new Set(['learner-evidence', 'verified', 'service-internal']),
  'grading-artifact': new Set(['teacher-authored', 'learner-evidence', 'verified']),
  'simulation-summary': new Set(['learner-evidence', 'verified', 'service-internal']),
  'arena-summary': new Set(['learner-evidence', 'verified', 'service-internal']),
  'teacher-report': new Set(['teacher-authored', 'verified']),
};
const AUTHORITY_SCORE: Record<LearningEvidenceAuthorityLevel, number> = {
  canonical: 60,
  verified: 52,
  'teacher-authored': 44,
  'learner-evidence': 36,
  contextual: 24,
  'service-internal': 20,
};
const FRESHNESS_BUCKET_SCORE: Record<LearningEvidenceFreshnessBucket, number> = {
  current: 8,
  recent: 5,
  stale: 2,
  expired: 0,
};

export function createLearningEvidenceCorpusChunk(input: LearningEvidenceCorpusChunkInput): LearningEvidenceCorpusChunk {
  const fallback = defaultAuthorityForChunk(input);
  return {
    ...input,
    authority: {
      ...fallback,
      ...input.authority,
      scopeRule: {
        ...fallback.scopeRule,
        ...input.authority?.scopeRule,
      },
    },
  };
}

export function validateLearningEvidenceCorpusChunk(chunk: LearningEvidenceCorpusChunk): string[] {
  const record = readRecord(chunk);
  const sourceRef = readRecord(record.sourceRef);
  const display = readRecord(record.display);
  const content = readRecord(record.content);
  const freshness = readRecord(record.freshness);
  const authority = readRecord(record.authority);
  const scopeRule = readRecord(authority.scopeRule);
  const retrieval = readRecord(record.retrieval);
  const spanRef = readRecord(record.spanRef);
  const family = typeof record.family === 'string' ? record.family as LearningEvidenceCorpusFamily : null;
  const sourceType = typeof record.sourceType === 'string' ? record.sourceType as LearningEvidenceCorpusSourceType : null;
  const authorityLevel = typeof authority.level === 'string' ? authority.level as LearningEvidenceAuthorityLevel : null;
  const scopeVisibility = typeof scopeRule.visibility === 'string' ? scopeRule.visibility as LearningEvidenceCorpusPrivacyClass : null;
  const retrievalUseCases = isUseCaseArray(retrieval.useCases) ? retrieval.useCases : null;
  const errors = [
    record.id ? null : 'missing-id',
    sourceRef.id ? null : 'missing-source-ref',
    display.title ? null : 'missing-display-title',
    display.capsule ? null : 'missing-display-capsule',
    isSpanKind(spanRef.kind) ? null : 'missing-span-ref',
    content.hash ? null : 'missing-content-hash',
    freshness.indexedAt ? null : 'missing-indexed-at',
    isPrivacyClass(record.privacyClass) ? null : 'missing-privacy-class',
    isConfidence(record.confidence) ? null : 'missing-confidence',
    isAuthorityLevel(authority.level) ? null : 'missing-authority-level',
    isStringArray(authority.knowledgeTags) ? null : 'missing-authority-knowledge-tags',
    isFreshnessBucket(authority.freshnessBucket) ? null : 'missing-authority-freshness-bucket',
    isScopeRule(scopeRule) ? null : 'missing-authority-scope-rule',
    sourceType && authorityLevel && SOURCE_AUTHORITY_LEVELS[sourceType]?.has(authorityLevel) ? null : 'authority-source-type-mismatch',
    sourceType && KNOWLEDGE_SOURCE_TYPES.has(sourceType) && isStringArray(authority.knowledgeTags) && authority.knowledgeTags.length === 0 ? 'knowledge-source-missing-tags' : null,
    scopeVisibility && record.privacyClass === scopeVisibility ? null : 'scope-privacy-mismatch',
    isStringArray(retrieval.tags) ? null : 'missing-retrieval-tags',
    isStringArray(retrieval.goals) ? null : 'missing-retrieval-goals',
    retrievalUseCases ? null : 'missing-retrieval-use-cases',
    sourceType && retrievalUseCases?.every((useCase) => isUseCaseSourceCompatible(useCase, sourceType)) ? null : 'source-use-case-mismatch',
    family && sourceType && LEARNING_EVIDENCE_CORPUS_FAMILY_SOURCE_TYPES[family]?.includes(sourceType) ? null : 'family-source-type-mismatch',
  ];
  if (!content.text && !content.redactedSummary) errors.push('missing-retrievable-text');
  return errors.filter((item): item is string => Boolean(item));
}

export function retrieveLearningEvidenceCorpus(
  chunks: LearningEvidenceCorpusChunk[],
  scope: LearningEvidenceRetrievalScope,
  query: LearningEvidenceRetrievalQuery = {},
): LearningEvidenceCorpusChunk[] {
  const limit = Math.max(1, Math.min(query.limit ?? 8, 25));
  const tags = new Set((query.tags ?? []).map((item) => item.toLowerCase()));
  const text = query.text?.toLowerCase().trim();
  return chunks
    .filter((chunk) => validateLearningEvidenceCorpusChunk(chunk).length === 0)
    .filter((chunk) => matchesRetrievalScope(chunk, scope))
    .filter((chunk) => tags.size === 0 || chunk.retrieval.tags.some((tag) => tags.has(tag.toLowerCase())))
    .filter((chunk) => !text || visibleSearchText(chunk, scope).includes(text))
    .sort((left, right) => rankChunk(right, scope, query) - rankChunk(left, scope, query))
    .slice(0, limit)
    .map((chunk) => redactChunkForScope(chunk, scope));
}

export function verifyLearningEvidenceCitations(
  chunks: LearningEvidenceCorpusChunk[],
  scope: LearningEvidenceRetrievalScope,
  citations: LearningEvidenceCitationRef[],
  policy: LearningEvidenceCitationPolicy = {},
): LearningEvidenceCitationVerificationResult {
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const verifiedRefs: LearningEvidenceCitationVerificationResult['verifiedRefs'] = [];
  const limitations: LearningEvidenceCitationVerificationResult['limitations'] = [];

  for (const citation of citations) {
    const chunk = chunkById.get(citation.chunkId);
    if (!chunk) {
      limitations.push({ chunkId: citation.chunkId, reason: 'missing-chunk' });
      continue;
    }
    if (validateLearningEvidenceCorpusChunk(chunk).length > 0) {
      limitations.push({ chunkId: citation.chunkId, reason: 'unsupported-source-type' });
      continue;
    }
    if (scope.allowedSourceTypes && !scope.allowedSourceTypes.includes(chunk.sourceType)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'unsupported-source-type' });
      continue;
    }
    if (scope.useCase && scope.useCase !== citation.useCase) {
      limitations.push({ chunkId: citation.chunkId, reason: 'unsupported-source-type' });
      continue;
    }
    if (!USE_CASE_SOURCE_TYPES[citation.useCase]?.has(chunk.sourceType) || !chunk.retrieval.useCases.includes(citation.useCase)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'unsupported-source-type' });
      continue;
    }
    if (citation.sourceType && citation.sourceType !== chunk.sourceType) {
      limitations.push({ chunkId: citation.chunkId, reason: 'source-type-mismatch' });
      continue;
    }
    if (!isChunkVisible(chunk, scope)) {
      limitations.push({ chunkId: citation.chunkId, reason: chunk.privacyClass === 'service-only' ? 'privacy-violation' : 'inaccessible-source' });
      continue;
    }
    if (!matchesRetrievalScope(chunk, scope)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'inaccessible-source' });
      continue;
    }
    if (citation.quoteHash && citation.quoteHash !== chunk.content.hash) {
      limitations.push({ chunkId: citation.chunkId, reason: 'quote-hash-mismatch' });
      continue;
    }
    if (citation.spanRef && !sameSpanRef(citation.spanRef, chunk.spanRef)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'span-ref-mismatch' });
      continue;
    }
    verifiedRefs.push({
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      displayTitle: chunk.display.title,
      displayHref: chunk.display.href,
      confidence: chunk.confidence,
      capsule: chunk.display.capsule,
      authorityLevel: chunk.authority.level,
      freshnessBucket: chunk.authority.freshnessBucket,
      privacyVisibility: privacyVisibilityFor(chunk, scope),
    });
    if (
      policy.minimumAuthority &&
      authorityRank(chunk.authority.level) < authorityRank(policy.minimumAuthority)
    ) {
      limitations.push({ chunkId: chunk.id, reason: 'insufficient-authority' });
    }
    if (chunk.authority.freshnessBucket === 'expired') {
      limitations.push({ chunkId: chunk.id, reason: 'expired-source' });
    } else if (chunk.authority.freshnessBucket === 'stale' || chunk.freshness.stale) {
      limitations.push({ chunkId: chunk.id, reason: 'stale-source' });
    }
    if (policy.exposePrivacyRedaction && chunk.content.text && redactChunkForScope(chunk, scope).content.text === null) {
      limitations.push({ chunkId: chunk.id, reason: 'privacy-redacted' });
    }
  }

  if (
    policy.requireLearnerEvidence &&
    !verifiedRefs.some((ref) => LEARNER_EVIDENCE_SOURCE_TYPES.has(ref.sourceType))
  ) {
    limitations.push({ chunkId: 'learner-evidence', reason: 'missing-learner-evidence' });
  }
  if (policy.detectConflicts) {
    for (const conflict of conflictingGroups(chunks, verifiedRefs.map((ref) => ref.chunkId), scope)) {
      limitations.push({ chunkId: conflict.group, reason: 'conflicting-source' });
      for (const chunkId of conflict.chunkIds) {
        limitations.push({ chunkId, reason: 'conflicting-source' });
      }
    }
  }

  const hasRejected = limitations.some((item) =>
    item.reason === 'missing-chunk' ||
    item.reason === 'inaccessible-source' ||
    item.reason === 'unsupported-source-type' ||
    item.reason === 'privacy-violation' ||
    item.reason === 'source-type-mismatch' ||
    item.reason === 'quote-hash-mismatch' ||
    item.reason === 'span-ref-mismatch'
  );
  const hasDowngrade = limitations.some((item) =>
    item.reason === 'insufficient-authority' ||
    item.reason === 'missing-learner-evidence' ||
    item.reason === 'conflicting-source' ||
    item.reason === 'stale-source' ||
    item.reason === 'expired-source'
  );
  const hasRedaction = limitations.some((item) => item.reason === 'privacy-redacted');
  const hasLowConfidence = verifiedRefs.some((ref) => ref.confidence === 'none' || ref.confidence === 'low');
  return {
    status: hasRejected ? 'rejected' : hasRedaction && !hasDowngrade ? 'redacted' : hasDowngrade || hasLowConfidence ? 'downgraded' : 'verified',
    verifiedRefs,
    limitations,
  };
}

export function buildLearningEvidenceCitationChips(
  verification: LearningEvidenceCitationVerificationResult,
  scope: LearningEvidenceRetrievalScope,
): LearningEvidenceCitationChipPayload[] {
  const limitationsByChunk = limitationsByChunkId(verification);
  return verification.verifiedRefs.map((ref) => ({
    chunkId: ref.chunkId,
    displayTitle: ref.displayTitle,
    displayHref: scope.role === 'student' && ref.privacyVisibility === 'privileged' ? null : ref.displayHref,
    sourceType: ref.sourceType,
    authorityLevel: ref.authorityLevel,
    confidence: ref.confidence,
    freshnessBucket: ref.freshnessBucket,
    privacyVisibility: ref.privacyVisibility,
    limitationState: primaryCitationReason(ref, limitationsByChunk.get(ref.chunkId) ?? []),
  }));
}

export function buildLearningEvidenceCitationAuditPayloads(
  verification: LearningEvidenceCitationVerificationResult,
  scope: LearningEvidenceRetrievalScope,
): LearningEvidenceCitationAuditPayload[] {
  const chips = buildLearningEvidenceCitationChips(verification, scope);
  const chipByChunk = new Map(chips.map((chip) => [chip.chunkId, chip]));
  const limitationsByChunk = limitationsByChunkId(verification);
  const audit = verification.verifiedRefs.map((ref) => {
    const reasons = reasonsForCitationRef(ref, limitationsByChunk.get(ref.chunkId) ?? []);
    const reason = primaryCitationReason(ref, reasons);
    return {
      chunkId: ref.chunkId,
      outcome: outcomeForCitationReason(reason),
      reason,
      reasons,
      citationChip: chipByChunk.get(ref.chunkId) ?? null,
    } satisfies LearningEvidenceCitationAuditPayload;
  });

  for (const limitation of verification.limitations) {
    if (chipByChunk.has(limitation.chunkId)) continue;
    audit.push({
      chunkId: limitation.chunkId,
      outcome: outcomeForCitationReason(limitation.reason),
      reason: limitation.reason,
      reasons: [limitation.reason],
      citationChip: null,
    });
  }
  return audit;
}

function limitationsByChunkId(verification: LearningEvidenceCitationVerificationResult) {
  const limitationsByChunk = new Map<string, Array<LearningEvidenceCitationVerificationResult['limitations'][number]['reason']>>();
  for (const limitation of verification.limitations) {
    const existing = limitationsByChunk.get(limitation.chunkId) ?? [];
    existing.push(limitation.reason);
    limitationsByChunk.set(limitation.chunkId, existing);
  }
  return limitationsByChunk;
}

function reasonsForCitationRef(
  ref: LearningEvidenceCitationVerificationResult['verifiedRefs'][number],
  reasons: Array<LearningEvidenceCitationVerificationResult['limitations'][number]['reason']>,
) {
  const next = [...reasons];
  if ((ref.confidence === 'low' || ref.confidence === 'none') && !next.includes('low-confidence-source')) {
    next.push('low-confidence-source');
  }
  return next;
}

function primaryCitationReason(
  ref: LearningEvidenceCitationVerificationResult['verifiedRefs'][number],
  reasons: Array<LearningEvidenceCitationVerificationResult['limitations'][number]['reason']>,
): LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null {
  const enriched = reasonsForCitationRef(ref, reasons);
  return enriched.sort(compareCitationReasons)[0] ?? null;
}

function outcomeForCitationReason(
  reason: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null,
): LearningEvidenceCitationAuditPayload['outcome'] {
  if (!reason) return 'verified';
  if (reason === 'privacy-redacted') return 'redacted';
  if (
    reason === 'insufficient-authority' ||
    reason === 'missing-learner-evidence' ||
    reason === 'conflicting-source' ||
    reason === 'low-confidence-source' ||
    reason === 'stale-source' ||
    reason === 'expired-source'
  ) return 'downgraded';
  return 'rejected';
}

function compareCitationReasons(
  left: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'],
  right: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'],
) {
  return citationReasonPriority(left) - citationReasonPriority(right);
}

function citationReasonPriority(reason: LearningEvidenceCitationVerificationResult['limitations'][number]['reason']) {
  if (
    reason === 'missing-chunk' ||
    reason === 'inaccessible-source' ||
    reason === 'unsupported-source-type' ||
    reason === 'privacy-violation' ||
    reason === 'source-type-mismatch' ||
    reason === 'quote-hash-mismatch' ||
    reason === 'span-ref-mismatch'
  ) return 0;
  if (
    reason === 'insufficient-authority' ||
    reason === 'missing-learner-evidence' ||
    reason === 'conflicting-source' ||
    reason === 'low-confidence-source' ||
    reason === 'stale-source' ||
    reason === 'expired-source'
  ) return 1;
  if (reason === 'privacy-redacted') return 2;
  return 3;
}

function matchesRetrievalScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  return matchesGoalScope(chunk, scope) &&
    matchesClassScope(chunk, scope) &&
    matchesOwnerScope(chunk, scope) &&
    matchesAuthorityScopeRule(chunk, scope) &&
    (!scope.allowedSourceTypes || scope.allowedSourceTypes.includes(chunk.sourceType)) &&
    (!scope.useCase || chunk.retrieval.useCases.includes(scope.useCase)) &&
    (!scope.useCase || isUseCaseSourceCompatible(scope.useCase, chunk.sourceType)) &&
    isChunkVisible(chunk, scope);
}

function matchesAuthorityScopeRule(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  const rule = chunk.authority.scopeRule;
  if (!rule.allowedRoles.includes(scope.role)) return false;
  if (rule.visibility !== chunk.privacyClass) return false;
  if (rule.ownerRequired && !chunk.sourceRef.ownerUserId) return false;
  if (rule.classRequired && (!chunk.sourceRef.classId || !scope.classIds?.includes(chunk.sourceRef.classId))) return false;
  return true;
}

function defaultAuthorityForChunk(chunk: Omit<LearningEvidenceCorpusChunk, 'authority'>): LearningEvidenceAuthorityMetadata {
  const visibility = chunk.privacyClass;
  const level = defaultAuthorityLevel(chunk.sourceType, chunk.privacyClass);
  return {
    level,
    knowledgeTags: KNOWLEDGE_SOURCE_TYPES.has(chunk.sourceType) ? [...chunk.retrieval.tags] : [],
    pageAnchor: chunk.spanRef.locator ?? null,
    freshnessBucket: defaultFreshnessBucket(chunk.freshness),
    scopeRule: {
      visibility,
      allowedRoles: defaultAllowedRoles(visibility),
      ownerRequired: Boolean(chunk.sourceRef.ownerUserId),
      classRequired: Boolean(chunk.sourceRef.classId),
      privilegedDiagnostics: visibility === 'service-only' || undefined,
    },
    conflictGroup: null,
    conflictSignal: null,
  };
}

function defaultAuthorityLevel(
  sourceType: LearningEvidenceCorpusSourceType,
  privacyClass: LearningEvidenceCorpusPrivacyClass,
): LearningEvidenceAuthorityLevel {
  if (privacyClass === 'service-only') return 'service-internal';
  if (KNOWLEDGE_SOURCE_TYPES.has(sourceType)) return 'canonical';
  if (sourceType === 'grading-artifact' || sourceType === 'teacher-report') return 'teacher-authored';
  return 'learner-evidence';
}

function defaultFreshnessBucket(freshness: LearningEvidenceCorpusChunk['freshness']): LearningEvidenceFreshnessBucket {
  if (freshness.expiresAt && Date.parse(freshness.expiresAt) <= Date.now()) return 'expired';
  if (freshness.stale) return 'stale';
  return 'current';
}

function defaultAllowedRoles(privacyClass: LearningEvidenceCorpusPrivacyClass): LearningEvidenceRetrievalRole[] {
  if (privacyClass === 'public') return ['student', 'teacher', 'admin', 'service'];
  if (privacyClass === 'student-visible') return ['student', 'teacher', 'admin', 'service'];
  if (privacyClass === 'teacher-visible') return ['teacher', 'admin', 'service'];
  if (privacyClass === 'admin-only') return ['admin', 'service'];
  return ['service'];
}

function matchesGoalScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  return !scope.goalId || chunk.retrieval.goals.includes(scope.goalId) || chunk.sourceRef.goalId === scope.goalId;
}

function matchesClassScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  if (!scope.classIds || scope.classIds.length === 0) return true;
  return !chunk.sourceRef.classId || scope.classIds.includes(chunk.sourceRef.classId);
}

function matchesOwnerScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  const ownerUserId = chunk.sourceRef.ownerUserId;
  if (!ownerUserId) return chunk.privacyClass !== 'student-visible';
  if (scope.role === 'student') return Boolean(scope.userId && ownerUserId === scope.userId);
  if (!scope.targetUserId) return true;
  return ownerUserId === scope.targetUserId;
}

function isChunkVisible(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  if (chunk.privacyClass === 'service-only') return scope.role === 'service';
  if (chunk.privacyClass === 'admin-only') return scope.role === 'admin' || scope.role === 'service';
  if (chunk.privacyClass === 'teacher-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    return scope.role === 'teacher' && Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
  }
  if (chunk.privacyClass === 'student-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    if (scope.role === 'teacher') return Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
    return scope.role === 'student' && (!scope.targetUserId || scope.targetUserId === scope.userId);
  }
  return chunk.privacyClass === 'public';
}

function privacyVisibilityFor(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): 'public' | 'redacted' | 'privileged' {
  if (chunk.privacyClass === 'public') return 'public';
  if (scope.role === 'service' && scope.includePrivateText) return 'privileged';
  return 'redacted';
}

function redactChunkForScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): LearningEvidenceCorpusChunk {
  if (chunk.privacyClass === 'public' || (scope.includePrivateText && scope.role === 'service')) return chunk;
  if (!chunk.content.redactedSummary) return { ...chunk, content: { ...chunk.content, text: null } };
  return { ...chunk, content: { ...chunk.content, text: null } };
}

function visibleSearchText(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  const visibleChunk = redactChunkForScope(chunk, scope);
  return [
    visibleChunk.display.title,
    visibleChunk.display.capsule,
    visibleChunk.content.text,
    visibleChunk.content.redactedSummary,
  ].filter(Boolean).join(' ').toLowerCase();
}

function rankChunk(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope, query: LearningEvidenceRetrievalQuery) {
  const text = query.text?.toLowerCase().trim();
  const confidence = { high: 4, medium: 3, low: 2, none: 1 }[chunk.confidence];
  const freshness = chunk.freshness.stale ? 0 : FRESHNESS_BUCKET_SCORE[chunk.authority.freshnessBucket];
  const scopeSpecificity = [
    chunk.sourceRef.ownerUserId && chunk.sourceRef.ownerUserId === scope.targetUserId ? 1 : 0,
    chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId) ? 1 : 0,
    chunk.sourceRef.goalId && chunk.sourceRef.goalId === scope.goalId ? 1 : 0,
  ].reduce((sum, item) => sum + item, 0);
  const useCase = scope.useCase && chunk.retrieval.useCases.includes(scope.useCase) ? 3 : 0;
  const queryMatch = text && visibleSearchText(chunk, scope).includes(text) ? 2 : 0;
  return AUTHORITY_SCORE[chunk.authority.level] + confidence * 4 + freshness + scopeSpecificity + useCase + queryMatch;
}

function conflictingGroups(
  chunks: LearningEvidenceCorpusChunk[],
  verifiedChunkIds: string[],
  scope: LearningEvidenceRetrievalScope,
) {
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const candidateGroups = new Set<string>();
  for (const chunkId of verifiedChunkIds) {
    const group = chunkById.get(chunkId)?.authority.conflictGroup;
    if (group) candidateGroups.add(group);
  }
  const groups = new Map<string, {
    signals: Set<Exclude<LearningEvidenceConflictSignal, null>>;
    chunkIds: string[];
  }>();
  for (const chunk of chunks) {
    const group = chunk.authority.conflictGroup;
    const signal = chunk.authority.conflictSignal;
    if (!group || !signal) continue;
    if (!candidateGroups.has(group)) continue;
    if (validateLearningEvidenceCorpusChunk(chunk).length > 0) continue;
    if (!isChunkVisible(chunk, scope) || !matchesRetrievalScope(chunk, scope)) continue;
    if (scope.useCase && !chunk.retrieval.useCases.includes(scope.useCase)) continue;
    const existing = groups.get(group) ?? { signals: new Set<Exclude<LearningEvidenceConflictSignal, null>>(), chunkIds: [] };
    existing.signals.add(signal);
    existing.chunkIds.push(chunk.id);
    groups.set(group, existing);
  }
  return [...groups.entries()]
    .filter(([, value]) => value.signals.has('supports') && value.signals.has('contradicts'))
    .map(([group, value]) => ({ group, chunkIds: value.chunkIds }));
}

function authorityRank(level: LearningEvidenceAuthorityLevel) {
  return AUTHORITY_SCORE[level];
}

function sameSpanRef(left: LearningEvidenceCorpusChunk['spanRef'], right: LearningEvidenceCorpusChunk['spanRef']) {
  return left.kind === right.kind &&
    (left.locator ?? null) === (right.locator ?? null) &&
    (left.start ?? null) === (right.start ?? null) &&
    (left.end ?? null) === (right.end ?? null);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isUseCaseArray(value: unknown): value is LearningEvidenceCitationUseCase[] {
  return isStringArray(value) && value.every((item) => Object.prototype.hasOwnProperty.call(USE_CASE_SOURCE_TYPES, item));
}

function isUseCaseSourceCompatible(useCase: LearningEvidenceCitationUseCase, sourceType: LearningEvidenceCorpusSourceType) {
  return USE_CASE_SOURCE_TYPES[useCase]?.has(sourceType) === true;
}

function isSpanKind(value: unknown): value is LearningEvidenceCorpusChunk['spanRef']['kind'] {
  return value === 'text-range' || value === 'node' || value === 'record' || value === 'summary';
}

function isPrivacyClass(value: unknown): value is LearningEvidenceCorpusPrivacyClass {
  return value === 'public' ||
    value === 'student-visible' ||
    value === 'teacher-visible' ||
    value === 'admin-only' ||
    value === 'service-only';
}

function isConfidence(value: unknown): value is LearningEvidenceConfidence {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

function isAuthorityLevel(value: unknown): value is LearningEvidenceAuthorityLevel {
  return value === 'canonical' ||
    value === 'verified' ||
    value === 'contextual' ||
    value === 'learner-evidence' ||
    value === 'teacher-authored' ||
    value === 'service-internal';
}

function isFreshnessBucket(value: unknown): value is LearningEvidenceFreshnessBucket {
  return value === 'current' || value === 'recent' || value === 'stale' || value === 'expired';
}

function isRetrievalRoleArray(value: unknown): value is LearningEvidenceRetrievalRole[] {
  return isStringArray(value) && value.every((item) =>
    item === 'student' || item === 'teacher' || item === 'admin' || item === 'service'
  );
}

function isScopeRule(value: Record<string, unknown>): boolean {
  return isPrivacyClass(value.visibility) && isRetrievalRoleArray(value.allowedRoles);
}
