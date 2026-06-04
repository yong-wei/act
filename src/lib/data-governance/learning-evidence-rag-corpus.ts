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

export interface LearningEvidenceCitationVerificationResult {
  status: 'verified' | 'rejected' | 'redacted' | 'downgraded';
  verifiedRefs: Array<{
    chunkId: string;
    sourceType: LearningEvidenceCorpusSourceType;
    displayTitle: string;
    displayHref: string | null;
    confidence: LearningEvidenceConfidence;
    capsule: string;
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
      | 'span-ref-mismatch';
  }>;
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

export function validateLearningEvidenceCorpusChunk(chunk: LearningEvidenceCorpusChunk): string[] {
  const errors = [
    chunk.id ? null : 'missing-id',
    chunk.sourceRef.id ? null : 'missing-source-ref',
    chunk.display.title ? null : 'missing-display-title',
    chunk.display.capsule ? null : 'missing-display-capsule',
    chunk.content.hash ? null : 'missing-content-hash',
    chunk.freshness.indexedAt ? null : 'missing-indexed-at',
    LEARNING_EVIDENCE_CORPUS_FAMILY_SOURCE_TYPES[chunk.family]?.includes(chunk.sourceType) ? null : 'family-source-type-mismatch',
  ];
  if (!chunk.content.text && !chunk.content.redactedSummary) errors.push('missing-retrievable-text');
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
    .sort((left, right) => rankChunk(right) - rankChunk(left))
    .slice(0, limit)
    .map((chunk) => redactChunkForScope(chunk, scope));
}

export function verifyLearningEvidenceCitations(
  chunks: LearningEvidenceCorpusChunk[],
  scope: LearningEvidenceRetrievalScope,
  citations: LearningEvidenceCitationRef[],
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
    });
  }

  const hasRejected = limitations.length > 0;
  const hasLowConfidence = verifiedRefs.some((ref) => ref.confidence === 'none' || ref.confidence === 'low');
  return {
    status: hasRejected ? 'rejected' : hasLowConfidence ? 'downgraded' : 'verified',
    verifiedRefs,
    limitations,
  };
}

function matchesRetrievalScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope) {
  return matchesGoalScope(chunk, scope) &&
    matchesClassScope(chunk, scope) &&
    matchesOwnerScope(chunk, scope) &&
    (!scope.allowedSourceTypes || scope.allowedSourceTypes.includes(chunk.sourceType)) &&
    (!scope.useCase || chunk.retrieval.useCases.includes(scope.useCase)) &&
    isChunkVisible(chunk, scope);
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
  return true;
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

function rankChunk(chunk: LearningEvidenceCorpusChunk) {
  const confidence = { high: 4, medium: 3, low: 2, none: 1 }[chunk.confidence];
  const freshness = chunk.freshness.stale ? 0 : 1;
  return confidence * 10 + freshness;
}

function sameSpanRef(left: LearningEvidenceCorpusChunk['spanRef'], right: LearningEvidenceCorpusChunk['spanRef']) {
  return left.kind === right.kind &&
    (left.locator ?? null) === (right.locator ?? null) &&
    (left.start ?? null) === (right.start ?? null) &&
    (left.end ?? null) === (right.end ?? null);
}
