import {
  detectKaqArtifactStaleness,
  validateKaqArtifactVersionRefs,
  type KaqArtifactVersionLimitation,
  type KaqArtifactVersionRefs,
} from '../kaq-artifact-versioning';

export const LEARNING_EVIDENCE_RAG_CORPUS_VERSION = 'learning-evidence-rag-corpus.v1';

export type LearningEvidenceCorpusSourceType =
  | 'course-content'
  | 'teacher-course-basis'
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
export type LearningEvidenceCitationAddressKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'slides'
  | 'interactive'
  | 'simulation'
  | 'arena'
  | 'external';

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

export interface LearningEvidenceCitationAddress {
  kind: LearningEvidenceCitationAddressKind;
  sourceRefId: string;
  href: string | null;
  locator?: string | null;
  contentHash?: string | null;
  mediaStartSeconds?: number | null;
  mediaEndSeconds?: number | null;
  imageRegion?: { x: number; y: number; width: number; height: number } | null;
  interactiveStepId?: string | null;
  simulationRunId?: string | null;
  arenaTaskId?: string | null;
  externalUrl?: string | null;
}

export type LearningEvidenceResourceProjectionScene = 'path' | 'konling' | 'diagnosis' | 'grading' | 'prep-pack' | 'report';

export interface LearningEvidenceResourceProjectionGraphRefs {
  knowledge: string[];
  capability: string[];
  quality: string[];
}

export interface LearningEvidenceResourceProjectionSceneAvailability {
  allowed: boolean;
  limitation?: string | null;
}

export type LearningEvidenceResourceProjectionSceneAvailabilityMap = Partial<
  Record<LearningEvidenceResourceProjectionScene, LearningEvidenceResourceProjectionSceneAvailability>
>;

export interface LearningEvidenceResourceProjectionCitationReadiness {
  status: 'verified' | 'resolvable' | 'unverified-anchor' | 'missing-target' | 'missing-transcript-or-anchor';
  verified: boolean;
  limitations: string[];
}

export interface LearningEvidenceResourceProjectionMetadata {
  resourceId?: string | null;
  segmentRef: string;
  citationTargetRef?: string | null;
  knowledgeNodeRefs: string[];
  capabilityTargetRefs: string[];
  graphNodeRefs?: LearningEvidenceResourceProjectionGraphRefs;
  sceneAvailability?: LearningEvidenceResourceProjectionSceneAvailabilityMap;
  citationReadiness?: LearningEvidenceResourceProjectionCitationReadiness;
  authorityLevel?: LearningEvidenceAuthorityLevel;
  privacyScope?: LearningEvidenceCorpusPrivacyClass;
  versionRefs?: KaqArtifactVersionRefs;
  versionLimitations?: KaqArtifactVersionLimitation[];
  pathEligibility?: {
    eligible: boolean;
    reason: string | null;
  };
  mediaTimeRange?: {
    startSeconds: number;
    endSeconds?: number | null;
  } | null;
  exerciseAnchor?: string | null;
  contentHash?: string | null;
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
    courseBasisId?: string | null;
    documentId?: string | null;
    versionId?: string | null;
    documentSourceType?: string | null;
    reviewState?: string | null;
    lifecycleState?: string | null;
    versionState?: string | null;
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
  citationAddress?: LearningEvidenceCitationAddress;
  content: {
    text: string | null;
    redactedSummary: string | null;
    hash: string;
  };
  resourceProjection?: LearningEvidenceResourceProjectionMetadata;
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
  teacherCourseBasis?: {
    selectedVersionIds: string[];
    explicitRetiredVersionIds?: string[];
    verifiedSarRetrievalChunkIds: string[];
  };
}

export interface LearningEvidenceRetrievalQuery {
  text?: string;
  tags?: string[];
  knowledgeNodeRefs?: string[];
  capabilityTargetRefs?: string[];
  semanticScores?: Record<string, number>;
  limit?: number;
}

export interface LearningEvidenceCitationRef {
  chunkId: string;
  sourceType?: LearningEvidenceCorpusSourceType;
  useCase: LearningEvidenceCitationUseCase;
  quoteHash?: string;
  spanRef?: LearningEvidenceCorpusChunk['spanRef'];
  addressKind?: LearningEvidenceCitationAddressKind;
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
    addressKind?: LearningEvidenceCitationAddressKind;
    citationAddress?: LearningEvidenceCitationAddress;
    confidence: LearningEvidenceConfidence;
    capsule: string;
    authorityLevel: LearningEvidenceAuthorityLevel;
    freshnessBucket: LearningEvidenceFreshnessBucket;
    privacyVisibility: 'public' | 'redacted' | 'privileged';
    sourceVersionRefs?: KaqArtifactVersionRefs;
    sourceVersionLimitations?: KaqArtifactVersionLimitation[];
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
      | 'expired-source'
      | 'unresolved-address'
      | 'unsafe-address'
      | 'address-kind-mismatch'
      | 'missing-version-ref';
  }>;
}

export interface LearningEvidenceCitationChipPayload {
  chunkId: string;
  displayTitle: string;
  displayHref: string | null;
  sourceType: LearningEvidenceCorpusSourceType;
  addressKind?: LearningEvidenceCitationAddressKind;
  citationAddress?: LearningEvidenceCitationAddress;
  authorityLevel: LearningEvidenceAuthorityLevel;
  confidence: LearningEvidenceConfidence;
  freshnessBucket: LearningEvidenceFreshnessBucket;
  privacyVisibility: 'public' | 'redacted' | 'privileged';
  limitationState: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null;
  sourceVersionRefs?: KaqArtifactVersionRefs;
  sourceVersionLimitations?: KaqArtifactVersionLimitation[];
}

export interface LearningEvidenceCitationAuditPayload {
  chunkId: string;
  outcome: 'verified' | 'rejected' | 'redacted' | 'downgraded';
  reason: LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] | null;
  reasons: Array<LearningEvidenceCitationVerificationResult['limitations'][number]['reason']>;
  citationChip: LearningEvidenceCitationChipPayload | null;
}

export const LEARNING_EVIDENCE_CORPUS_FAMILY_SOURCE_TYPES: Record<LearningEvidenceCorpusFamily, LearningEvidenceCorpusSourceType[]> = {
  'course-content': ['course-content', 'teacher-course-basis'],
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
  'prep-pack': new Set(['course-content', 'teacher-course-basis', 'knowledge-card', 'runtime-handout', 'diagnosis', 'grading-artifact', 'teacher-report']),
};

const KNOWLEDGE_SOURCE_TYPES = new Set<LearningEvidenceCorpusSourceType>(['course-content', 'teacher-course-basis', 'knowledge-card', 'runtime-handout']);
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
  'teacher-course-basis': new Set(['teacher-authored', 'verified', 'contextual']),
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
const MIN_SEMANTIC_ELIGIBILITY_SCORE = 0.2;

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
    record.citationAddress === undefined || isCitationAddress(record.citationAddress) ? null : 'invalid-citation-address',
    record.resourceProjection === undefined || isResourceProjectionMetadata(record.resourceProjection) ? null : 'invalid-resource-projection',
    hasResourceProjectionAuthorityMismatch(record.resourceProjection, authority.level) ? 'resource-projection-authority-mismatch' : null,
    hasResourceProjectionPrivacyMismatch(record.resourceProjection, record.privacyClass) ? 'resource-projection-privacy-mismatch' : null,
  ];
  if (hasUnsupportedResourceProjectionPathEligibility(record.resourceProjection)) {
    errors.push('resource-projection-path-eligibility-unsupported');
  }
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
  const ranked = chunks
    .filter((chunk) => validateLearningEvidenceCorpusChunk(chunk).length === 0)
    .filter((chunk) => matchesRetrievalScope(chunk, scope))
    .filter((chunk) => matchesSemanticOnlyQuery(chunk, query, text, tags))
    .filter((chunk) => tags.size === 0 || chunk.retrieval.tags.some((tag) => tags.has(tag.toLowerCase())))
    .filter((chunk) => !text || visibleSearchText(chunk, scope).includes(text) || isSemanticCandidate(chunk, query) || matchesResourceProjectionQueryContext(chunk, query))
    .filter((chunk) => matchesResourceProjectionContext(chunk, query))
    .sort((left, right) => rankChunk(right, scope, query) - rankChunk(left, scope, query));
  return limitRecommendationLearnerEvidence(ranked, scope, limit)
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
    if (!matchesResourceProjectionSceneAvailability(chunk, citation.useCase)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'inaccessible-source' });
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
    const resolvedAddress = resolveLearningEvidenceCitationAddress(chunk, citation);
    if (citation.addressKind && citation.addressKind !== resolvedAddress.address.kind) {
      limitations.push({ chunkId: citation.chunkId, reason: 'address-kind-mismatch' });
      continue;
    }
    if (!isSafeCitationAddress(resolvedAddress.address)) {
      limitations.push({ chunkId: citation.chunkId, reason: 'unsafe-address' });
      continue;
    }
    if (!resolvedAddress.address.href) {
      limitations.push({ chunkId: chunk.id, reason: 'unresolved-address' });
    }
    if (resolvedAddress.address.contentHash && resolvedAddress.address.contentHash !== chunk.content.hash) {
      limitations.push({ chunkId: chunk.id, reason: 'stale-source' });
    }
    const sourceVersionLimitations = citationVersionLimitations(chunk);
    verifiedRefs.push({
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      displayTitle: chunk.display.title,
      displayHref: resolvedAddress.address.href,
      addressKind: resolvedAddress.address.kind,
      citationAddress: resolvedAddress.address,
      confidence: chunk.confidence,
      capsule: chunk.display.capsule,
      authorityLevel: chunk.authority.level,
      freshnessBucket: chunk.authority.freshnessBucket,
      privacyVisibility: privacyVisibilityFor(chunk, scope),
      sourceVersionRefs: chunk.resourceProjection?.versionRefs,
      sourceVersionLimitations,
    });
    for (const versionLimitation of sourceVersionLimitations) {
      limitations.push({
        chunkId: chunk.id,
        reason: citationVersionLimitationReason(versionLimitation),
      });
    }
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
    item.reason === 'span-ref-mismatch' ||
    item.reason === 'unsafe-address' ||
    item.reason === 'address-kind-mismatch'
  );
  const hasDowngrade = limitations.some((item) =>
    item.reason === 'insufficient-authority' ||
    item.reason === 'missing-learner-evidence' ||
    item.reason === 'conflicting-source' ||
    item.reason === 'stale-source' ||
    item.reason === 'expired-source' ||
    item.reason === 'unresolved-address' ||
    item.reason === 'missing-version-ref'
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
  return verification.verifiedRefs.map((ref) => {
    const shouldRedactHref = scope.role === 'student' && ref.privacyVisibility === 'privileged';
    const displayHref = shouldRedactHref ? null : ref.displayHref;
    const baseAddress = ref.citationAddress ?? {
      kind: ref.addressKind ?? defaultCitationAddressKind(ref.sourceType),
      sourceRefId: ref.chunkId,
      href: ref.displayHref,
      locator: null,
    } satisfies LearningEvidenceCitationAddress;
    const citationAddress = {
      ...baseAddress,
      href: displayHref,
      externalUrl: shouldRedactHref ? null : baseAddress.externalUrl,
    };
    return {
      chunkId: ref.chunkId,
      displayTitle: ref.displayTitle,
      displayHref,
      sourceType: ref.sourceType,
      addressKind: ref.addressKind ?? citationAddress.kind,
      citationAddress,
      authorityLevel: ref.authorityLevel,
      confidence: ref.confidence,
      freshnessBucket: ref.freshnessBucket,
      privacyVisibility: ref.privacyVisibility,
      limitationState: primaryCitationReason(ref, limitationsByChunk.get(ref.chunkId) ?? []),
      sourceVersionRefs: ref.sourceVersionRefs,
      sourceVersionLimitations: ref.sourceVersionLimitations,
    };
  });
}

export function resolveLearningEvidenceCitationAddress(
  chunk: LearningEvidenceCorpusChunk,
  citation: Pick<LearningEvidenceCitationRef, 'spanRef'> = {},
): { address: LearningEvidenceCitationAddress; freshnessState: LearningEvidenceFreshnessBucket } {
  const baseAddress = chunk.citationAddress ?? deriveCitationAddressFromChunk(chunk, citation.spanRef ?? chunk.spanRef);
  return {
    address: {
      ...baseAddress,
      contentHash: baseAddress.contentHash ?? chunk.content.hash,
      href: chunk.citationAddress ? baseAddress.href : baseAddress.href ?? chunk.display.href,
    },
    freshnessState: chunk.authority.freshnessBucket,
  };
}

export function citationVersionLimitations(chunk: LearningEvidenceCorpusChunk): KaqArtifactVersionLimitation[] {
  if (!chunk.resourceProjection) return [];
  if (!chunk.resourceProjection.versionRefs) {
    return [{
      code: 'legacy-artifact-unversioned',
      ref: 'resourceProjectionVersion',
      severity: 'warning',
      message: 'Resource projection citation is missing artifact version refs.',
    }];
  }
  return [
    ...validateKaqArtifactVersionRefs(chunk.resourceProjection.versionRefs, [
      'graphCatalogVersion',
      'resourceProjectionVersion',
    ]),
    ...detectKaqArtifactStaleness(chunk.resourceProjection.versionRefs),
    ...(chunk.resourceProjection.versionLimitations ?? []),
  ];
}

export function citationVersionLimitationReason(
  limitation: KaqArtifactVersionLimitation,
): LearningEvidenceCitationVerificationResult['limitations'][number]['reason'] {
  if (limitation.code === 'missing-version-ref' || limitation.code === 'legacy-artifact-unversioned') {
    return 'missing-version-ref';
  }
  return 'stale-source';
}

function deriveCitationAddressFromChunk(
  chunk: LearningEvidenceCorpusChunk,
  spanRef: LearningEvidenceCorpusChunk['spanRef'],
): LearningEvidenceCitationAddress {
  const kind = defaultCitationAddressKind(chunk.sourceType);
  const base = {
    kind,
    sourceRefId: chunk.sourceRef.id,
    href: chunk.display.href,
    locator: spanRef.locator ?? chunk.authority.pageAnchor ?? null,
    contentHash: chunk.content.hash,
  } satisfies LearningEvidenceCitationAddress;
  if (kind === 'interactive') {
    return { ...base, interactiveStepId: spanRef.locator ?? chunk.sourceRef.resourceId ?? null };
  }
  if (kind === 'simulation') {
    return { ...base, simulationRunId: chunk.sourceRef.id };
  }
  if (kind === 'arena') {
    return { ...base, arenaTaskId: chunk.sourceRef.resourceId ?? chunk.sourceRef.id };
  }
  return base;
}

function defaultCitationAddressKind(sourceType: LearningEvidenceCorpusSourceType): LearningEvidenceCitationAddressKind {
  if (sourceType === 'simulation-summary') return 'simulation';
  if (sourceType === 'arena-summary') return 'arena';
  if (sourceType === 'path-summary') return 'interactive';
  return 'text';
}

export function isSafeCitationAddress(address: LearningEvidenceCitationAddress): boolean {
  if (address.kind === 'external') {
    return isSafeHttpUrl(address.href) && (!address.externalUrl || isSafeHttpUrl(address.externalUrl));
  }
  if (address.externalUrl && !isSafeHttpUrl(address.externalUrl)) {
    return false;
  }
  return !address.href || isSafeInternalOrHttpUrl(address.href);
}

function isSafeInternalOrHttpUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.startsWith('/')) return !value.startsWith('//');
  return isSafeHttpUrl(value);
}

function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
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
    reason === 'expired-source' ||
    reason === 'unresolved-address' ||
    reason === 'missing-version-ref'
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
    reason === 'span-ref-mismatch' ||
    reason === 'unsafe-address' ||
    reason === 'address-kind-mismatch'
  ) return 0;
  if (
    reason === 'insufficient-authority' ||
    reason === 'missing-learner-evidence' ||
    reason === 'conflicting-source' ||
    reason === 'low-confidence-source' ||
    reason === 'stale-source' ||
    reason === 'expired-source' ||
    reason === 'unresolved-address' ||
    reason === 'missing-version-ref'
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
    matchesTeacherCourseBasisRetrievalScope(chunk, scope) &&
    matchesResourceProjectionSceneAvailability(chunk, scope.useCase) &&
    isChunkVisible(chunk, scope);
}

export function matchesTeacherCourseBasisRetrievalScope(
  chunk: LearningEvidenceCorpusChunk,
  scope: LearningEvidenceRetrievalScope,
): boolean {
  if (chunk.sourceType !== 'teacher-course-basis') return true;
  const basisScope = scope.teacherCourseBasis;
  const versionId = chunk.sourceRef.versionId;
  if (!basisScope || !versionId) return false;
  if (chunk.sourceRef.reviewState !== 'confirmed') return false;
  if (!basisScope.selectedVersionIds.includes(versionId)) return false;
  if (
    chunk.sourceRef.versionState === 'retired'
    && !basisScope.explicitRetiredVersionIds?.includes(versionId)
  ) return false;
  if (chunk.sourceRef.versionState !== 'active' && chunk.sourceRef.versionState !== 'retired') return false;
  return basisScope.verifiedSarRetrievalChunkIds.includes(chunk.id);
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
  if (sourceType === 'teacher-course-basis') return 'teacher-authored';
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
  if (chunk.sourceType === 'teacher-course-basis' && (scope.role === 'admin' || scope.role === 'service')) return true;
  if (scope.role === 'student') return Boolean(scope.userId && ownerUserId === scope.userId);
  if (!scope.targetUserId) return true;
  return ownerUserId === scope.targetUserId;
}

function isChunkVisible(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  if (chunk.privacyClass === 'service-only') return scope.role === 'service';
  if (chunk.privacyClass === 'admin-only') return scope.role === 'admin' || scope.role === 'service';
  if (chunk.privacyClass === 'teacher-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    if (chunk.sourceType === 'teacher-course-basis') {
      return scope.role === 'teacher' && scope.userId === chunk.sourceRef.ownerUserId;
    }
    return scope.role === 'teacher' && Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
  }
  if (chunk.privacyClass === 'student-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    if (scope.role === 'teacher') return Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
    return scope.role === 'student' && (!scope.targetUserId || scope.targetUserId === scope.userId);
  }
  return chunk.privacyClass === 'public';
}

export function privacyVisibilityFor(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): 'public' | 'redacted' | 'privileged' {
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

function matchesSemanticOnlyQuery(
  chunk: LearningEvidenceCorpusChunk,
  query: LearningEvidenceRetrievalQuery,
  text: string | undefined,
  tags: Set<string>,
) {
  const hasSemanticScores = Boolean(query.semanticScores && Object.keys(query.semanticScores).length > 0);
  const hasLexicalOrContext = Boolean(text) ||
    tags.size > 0 ||
    Boolean(query.knowledgeNodeRefs?.length) ||
    Boolean(query.capabilityTargetRefs?.length);
  if (!hasSemanticScores || hasLexicalOrContext) return true;
  return isSemanticCandidate(chunk, query);
}

function matchesResourceProjectionContext(chunk: LearningEvidenceCorpusChunk, query: LearningEvidenceRetrievalQuery) {
  const projection = chunk.resourceProjection;
  const hasKnowledgeQuery = Boolean(query.knowledgeNodeRefs?.length);
  const hasCapabilityQuery = Boolean(query.capabilityTargetRefs?.length);
  if (!hasKnowledgeQuery && !hasCapabilityQuery) return true;
  if (!projection) return true;
  if (hasKnowledgeQuery && hasAnyReference(projection.knowledgeNodeRefs, query.knowledgeNodeRefs)) return true;
  if (hasCapabilityQuery && hasAnyReference(projection.capabilityTargetRefs, query.capabilityTargetRefs)) return true;
  return false;
}

function matchesResourceProjectionQueryContext(chunk: LearningEvidenceCorpusChunk, query: LearningEvidenceRetrievalQuery) {
  const projection = chunk.resourceProjection;
  if (!projection) return false;
  return hasAnyReference(projection.knowledgeNodeRefs, query.knowledgeNodeRefs) ||
    hasAnyReference(projection.capabilityTargetRefs, query.capabilityTargetRefs);
}

function limitRecommendationLearnerEvidence(
  chunks: LearningEvidenceCorpusChunk[],
  scope: LearningEvidenceRetrievalScope,
  limit: number,
) {
  const limited = chunks.slice(0, limit);
  if (scope.useCase !== 'recommendation' || limited.some(isLearnerEvidenceChunk)) return limited;
  const learnerEvidence = chunks.find(isLearnerEvidenceChunk);
  if (!learnerEvidence) return limited;
  if (limited.length < limit) return [...limited, learnerEvidence];
  return [...limited.slice(0, Math.max(0, limit - 1)), learnerEvidence];
}

function isLearnerEvidenceChunk(chunk: LearningEvidenceCorpusChunk) {
  return LEARNER_EVIDENCE_SOURCE_TYPES.has(chunk.sourceType);
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
  const queryMatch = text && visibleSearchText(chunk, scope).includes(text) ? 14 : 0;
  const semantic = Math.max(0, Math.min(1, semanticScoreFor(chunk, query))) * 8;
  const knowledgeContext = hasAnyReference(chunk.resourceProjection?.knowledgeNodeRefs, query.knowledgeNodeRefs) ? 8 : 0;
  const capabilityContext = hasAnyReference(chunk.resourceProjection?.capabilityTargetRefs, query.capabilityTargetRefs) ? 10 : 0;
  const learnerContext = scope.useCase === 'recommendation' &&
    LEARNER_EVIDENCE_SOURCE_TYPES.has(chunk.sourceType) &&
    (!chunk.sourceRef.ownerUserId || chunk.sourceRef.ownerUserId === scope.targetUserId)
    ? 14
    : 0;
  return AUTHORITY_SCORE[chunk.authority.level] +
    confidence * 4 +
    freshness +
    scopeSpecificity +
    useCase +
    queryMatch +
    semantic +
    knowledgeContext +
    capabilityContext +
    learnerContext;
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

function isCitationAddressKind(value: unknown): value is LearningEvidenceCitationAddressKind {
  return value === 'text' ||
    value === 'image' ||
    value === 'audio' ||
    value === 'video' ||
    value === 'slides' ||
    value === 'interactive' ||
    value === 'simulation' ||
    value === 'arena' ||
    value === 'external';
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isNullableFiniteNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isCitationImageRegion(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const record = readRecord(value);
  return typeof record.x === 'number' &&
    typeof record.y === 'number' &&
    typeof record.width === 'number' &&
    typeof record.height === 'number';
}

function isCitationAddress(value: unknown): value is LearningEvidenceCitationAddress {
  const record = readRecord(value);
  const mediaStartSeconds = record.mediaStartSeconds;
  const mediaEndSeconds = record.mediaEndSeconds;
  const hasValidMediaRange =
    record.kind !== 'audio' && record.kind !== 'video' ||
    (typeof mediaStartSeconds === 'number' &&
      Number.isFinite(mediaStartSeconds) &&
      mediaStartSeconds >= 0 &&
      (mediaEndSeconds === undefined || mediaEndSeconds === null ||
        typeof mediaEndSeconds === 'number' && Number.isFinite(mediaEndSeconds) && mediaEndSeconds >= mediaStartSeconds));
  return isCitationAddressKind(record.kind) &&
    typeof record.sourceRefId === 'string' &&
    (typeof record.href === 'string' || record.href === null) &&
    isNullableString(record.locator) &&
    isNullableString(record.contentHash) &&
    isNullableFiniteNumber(record.mediaStartSeconds) &&
    isNullableFiniteNumber(record.mediaEndSeconds) &&
    hasValidMediaRange &&
    isCitationImageRegion(record.imageRegion) &&
    isNullableString(record.interactiveStepId) &&
    isNullableString(record.simulationRunId) &&
    isNullableString(record.arenaTaskId) &&
    isNullableString(record.externalUrl);
}

function isResourceProjectionMetadata(value: unknown): value is LearningEvidenceResourceProjectionMetadata {
  const record = readRecord(value);
  const mediaTimeRange = readRecord(record.mediaTimeRange);
  const hasValidMediaTimeRange = record.mediaTimeRange === undefined ||
    record.mediaTimeRange === null ||
    typeof mediaTimeRange.startSeconds === 'number' &&
      Number.isFinite(mediaTimeRange.startSeconds) &&
      mediaTimeRange.startSeconds >= 0 &&
      (mediaTimeRange.endSeconds === undefined ||
        mediaTimeRange.endSeconds === null ||
        typeof mediaTimeRange.endSeconds === 'number' &&
          Number.isFinite(mediaTimeRange.endSeconds) &&
          mediaTimeRange.endSeconds >= mediaTimeRange.startSeconds);
  return isNullableString(record.resourceId) &&
    typeof record.segmentRef === 'string' &&
    record.segmentRef.length > 0 &&
    isNullableString(record.citationTargetRef) &&
    isStringArray(record.knowledgeNodeRefs) &&
    isStringArray(record.capabilityTargetRefs) &&
    isOptionalResourceProjectionGraphRefs(record.graphNodeRefs) &&
    isOptionalResourceProjectionSceneAvailability(record.sceneAvailability) &&
    isOptionalResourceProjectionCitationReadiness(record.citationReadiness) &&
    (record.authorityLevel === undefined || isAuthorityLevel(record.authorityLevel)) &&
    (record.privacyScope === undefined || isPrivacyClass(record.privacyScope)) &&
    isOptionalKaqArtifactVersionRefs(record.versionRefs) &&
    isOptionalKaqArtifactVersionLimitations(record.versionLimitations) &&
    isOptionalResourceProjectionPathEligibility(record.pathEligibility) &&
    hasValidMediaTimeRange &&
    isNullableString(record.exerciseAnchor) &&
    isNullableString(record.contentHash);
}

function isOptionalKaqArtifactVersionRefs(value: unknown): value is KaqArtifactVersionRefs | undefined {
  if (value === undefined) return true;
  const record = readRecord(value);
  return typeof record.artifactVersioningVersion === 'string' &&
    (record.learningGoalPackageVersion === undefined || isNullableString(record.learningGoalPackageVersion)) &&
    (record.objectiveCatalogVersion === undefined || isNullableString(record.objectiveCatalogVersion)) &&
    (record.graphCatalogVersion === undefined || isNullableString(record.graphCatalogVersion)) &&
    (record.resourceRegistryVersion === undefined || isNullableString(record.resourceRegistryVersion)) &&
    (record.resourceProjectionVersion === undefined || isNullableString(record.resourceProjectionVersion)) &&
    (record.overlayVersion === undefined || isNullableString(record.overlayVersion)) &&
    (record.plannerVersion === undefined || isNullableString(record.plannerVersion)) &&
    (record.groundingVersion === undefined || isNullableString(record.groundingVersion)) &&
    (record.citationVersion === undefined || isNullableString(record.citationVersion));
}

function isOptionalKaqArtifactVersionLimitations(
  value: unknown,
): value is KaqArtifactVersionLimitation[] | undefined {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((item) => {
    const record = readRecord(item);
    return typeof record.code === 'string' &&
      typeof record.ref === 'string' &&
      (record.severity === 'blocking' || record.severity === 'warning') &&
      typeof record.message === 'string';
  });
}

function hasUnsupportedResourceProjectionPathEligibility(value: unknown): boolean {
  const record = readRecord(value);
  const pathEligibility = readRecord(record.pathEligibility);
  return pathEligibility.eligible === true;
}

function hasResourceProjectionAuthorityMismatch(value: unknown, authorityLevel: unknown): boolean {
  const record = readRecord(value);
  return record.authorityLevel !== undefined && record.authorityLevel !== authorityLevel;
}

function hasResourceProjectionPrivacyMismatch(value: unknown, privacyClass: unknown): boolean {
  const record = readRecord(value);
  return record.privacyScope !== undefined && record.privacyScope !== privacyClass;
}

function matchesResourceProjectionSceneAvailability(
  chunk: LearningEvidenceCorpusChunk,
  useCase: LearningEvidenceCitationUseCase | undefined,
): boolean {
  if (!useCase) return true;
  const scene = resourceProjectionSceneForUseCase(useCase);
  if (!scene) return true;
  const availability = chunk.resourceProjection?.sceneAvailability?.[scene];
  return availability?.allowed !== false;
}

function resourceProjectionSceneForUseCase(
  useCase: LearningEvidenceCitationUseCase,
): LearningEvidenceResourceProjectionScene | null {
  if (useCase === 'diagnosis') return 'diagnosis';
  if (useCase === 'grading') return 'grading';
  if (useCase === 'konling') return 'konling';
  if (useCase === 'recommendation') return 'path';
  if (useCase === 'prep-pack') return 'prep-pack';
  if (useCase === 'teacher-report') return 'report';
  return null;
}

function isOptionalResourceProjectionGraphRefs(value: unknown): value is LearningEvidenceResourceProjectionGraphRefs | undefined {
  if (value === undefined) return true;
  const record = readRecord(value);
  return isStringArray(record.knowledge) &&
    isStringArray(record.capability) &&
    isStringArray(record.quality);
}

function isOptionalResourceProjectionSceneAvailability(
  value: unknown,
): value is LearningEvidenceResourceProjectionSceneAvailabilityMap | undefined {
  if (value === undefined) return true;
  const record = readRecord(value);
  return Object.entries(record).every(([scene, availability]) => (
    isResourceProjectionScene(scene) &&
    isResourceProjectionSceneAvailability(availability)
  ));
}

function isResourceProjectionScene(value: string): value is LearningEvidenceResourceProjectionScene {
  return value === 'path' ||
    value === 'konling' ||
    value === 'diagnosis' ||
    value === 'grading' ||
    value === 'prep-pack' ||
    value === 'report';
}

function isResourceProjectionSceneAvailability(value: unknown): value is LearningEvidenceResourceProjectionSceneAvailability {
  const record = readRecord(value);
  return typeof record.allowed === 'boolean' && isNullableString(record.limitation);
}

function isOptionalResourceProjectionCitationReadiness(
  value: unknown,
): value is LearningEvidenceResourceProjectionCitationReadiness | undefined {
  if (value === undefined) return true;
  const record = readRecord(value);
  return isResourceProjectionCitationReadinessStatus(record.status) &&
    typeof record.verified === 'boolean' &&
    isStringArray(record.limitations);
}

function isResourceProjectionCitationReadinessStatus(value: unknown): value is LearningEvidenceResourceProjectionCitationReadiness['status'] {
  return value === 'verified' ||
    value === 'resolvable' ||
    value === 'unverified-anchor' ||
    value === 'missing-target' ||
    value === 'missing-transcript-or-anchor';
}

function isOptionalResourceProjectionPathEligibility(
  value: unknown,
): value is LearningEvidenceResourceProjectionMetadata['pathEligibility'] | undefined {
  if (value === undefined) return true;
  const record = readRecord(value);
  return typeof record.eligible === 'boolean' && isNullableString(record.reason);
}

function semanticScoreFor(chunk: LearningEvidenceCorpusChunk, query: LearningEvidenceRetrievalQuery) {
  const score = query.semanticScores?.[chunk.id] ?? 0;
  return typeof score === 'number' && Number.isFinite(score) ? score : 0;
}

function isSemanticCandidate(chunk: LearningEvidenceCorpusChunk, query: LearningEvidenceRetrievalQuery) {
  return semanticScoreFor(chunk, query) >= MIN_SEMANTIC_ELIGIBILITY_SCORE;
}

function hasAnyReference(candidateRefs: string[] | undefined, requestedRefs: string[] | undefined) {
  if (!candidateRefs?.length || !requestedRefs?.length) return false;
  const requested = new Set(requestedRefs);
  return candidateRefs.some((ref) => requested.has(ref));
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
