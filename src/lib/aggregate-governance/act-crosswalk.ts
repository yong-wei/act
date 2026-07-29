import type {
  ActStructuralUnitCrosswalkRecord,
  CaptureIdentity,
  DeterministicAlignmentInput,
  OpaqueUpstreamRagReference,
  SemanticAlignmentCandidate,
  SemanticAlignmentReview,
  StructuralUnitIndexEntry,
} from './contracts';
import { sha256Canonical, tripleKey } from './hash';
import { includesTermBounded, normalizeEvidenceText, sortNames } from './term-match';

/**
 * Deterministic retrieval lexicon for ranking only. Intersection with a
 * Canonical profile yields terms; presence in unit evidence raises score.
 * Never becomes an ACCEPT/REJECT outcome.
 */
export const SEMANTIC_RETRIEVAL_LEXICON: readonly string[] = sortNames([
  '根轨迹', '劳斯', '奈奎斯特', '伯德', 'bode', 'nyquist',
  '稳定性', '传递函数', 'transfer function', '反馈', 'pid',
  '频域', '时域', '状态空间', 'state space', 'state variable', '状态变量',
  '开环', '闭环', '相位裕度', '幅值裕度', 'phase margin', 'gain margin',
  '稳态误差', '超调', '阻尼', '自然频率', '极点', '零点',
  '控制系统', '动态系统', '建模', '频率响应', '根轨迹法', 'root locus',
  'stability', 'feedback', '前向通路', '微分方程', '方框图', '信号流图',
  '校正', '超前', '滞后', '主导极点', '一阶系统', '二阶系统',
  'block diagram', 'signal flow', 'steady state', 'overshoot', 'damping',
  'open loop', 'closed loop', 'routh', 'hurwitz', 'compensator', 'lead lag',
  '梅森', '增益', '支路', '拉普拉斯', 'laplace', '伯德图', 'bode plot',
  '频率特性', '奈氏', 'routh-hurwitz', '控制器', '伺服', '扰动',
  '前馈', '反馈通路', '闭环传递函数', '开环传递函数', '脉冲传递函数',
]);

const PROFILE_STOP_TERMS = new Set([
  '我们', '可以', '一个', '这个', '那个', '以及', '或者', '因为', '所以',
  '通过', '进行', '关于', '如果', '但是', '不是', '已经', '之后', '之前',
  '课程', '学生', '教师', '本节', '目标', '内容', '总结', '如下', '如图',
  '例如', '其中', '同时', '因此', '然后', '需要', '一般', '表示', '定义',
  '方法', '理论', '基本', '相关', '对应', '用于', '采用', '得到', '给出',
  'contract', 'canonical', 'domainconcept', 'theoretical', 'construct',
  'companion', 'recovered', 'formula', 'object', 'entity',
]);

/** Optional tracked source evidence used only for deterministic ranking. */
export interface SemanticUnitEvidenceText {
  title?: string | null;
  family?: string | null;
  sourcePath?: string | null;
  /** Bounded verifiable source text or title/front-matter excerpt. */
  sourceText?: string | null;
  knowledgeNodeIds?: readonly string[];
  capabilityTargetIds?: readonly string[];
}

export function structuralUnitEvidenceKey(entry: Pick<
  StructuralUnitIndexEntry,
  'structuralUnitId' | 'structuralUnitVersion' | 'structuralUnitHash'
>): string {
  return `${entry.structuralUnitId}\u001f${entry.structuralUnitVersion}\u001f${entry.structuralUnitHash}`;
}

/**
 * Extract deterministic retrieval terms from a Canonical profile blob.
 * Ranking aid only — does not assert semantic acceptance.
 */
export function extractProfileRetrievalTerms(profileText: string): string[] {
  const normalized = normalizeEvidenceText(profileText ?? '');
  if (!normalized) return [];
  const terms = new Set<string>();

  for (const term of SEMANTIC_RETRIEVAL_LEXICON) {
    const t = normalizeEvidenceText(term);
    if (t.length >= 2 && includesTermBounded(normalized, t)) terms.add(t);
  }

  // Latin/digit tokens (word-like).
  for (const token of normalized.split(/[^a-z0-9]+/iu)) {
    const t = token.trim().toLowerCase();
    if (t.length >= 3 && !PROFILE_STOP_TERMS.has(t) && !/^\d+$/u.test(t)) {
      terms.add(t);
    }
  }

  // CJK runs → bounded n-grams (2..6) plus full run when short enough.
  const cjkRuns = (profileText ?? '').match(/[\u4e00-\u9fff]{2,}/gu) ?? [];
  for (const run of cjkRuns) {
    if (run.length <= 12 && !PROFILE_STOP_TERMS.has(run)) terms.add(run);
    const maxLen = Math.min(6, run.length);
    for (let len = 2; len <= maxLen; len += 1) {
      for (let i = 0; i + len <= run.length; i += 1) {
        const gram = run.slice(i, i + len);
        if (!PROFILE_STOP_TERMS.has(gram)) terms.add(gram);
      }
    }
  }

  return sortNames([...terms].filter((t) => t.length >= 2));
}

function familyRankBoost(family: string | null | undefined): number {
  const f = (family ?? '').toLowerCase();
  if (f.includes('knowledge-card') || f.includes('textbook-section')) return 4;
  if (f.includes('infograph') || f.includes('handout')) return 2;
  if (f.includes('runtime-lesson-step') || f.includes('runtime-step')) return -3;
  if (f.includes('classroom') || f.includes('lesson-item')) return -2;
  return 0;
}

function termWeight(term: string): number {
  // Longer domain phrases outrank short common n-grams.
  if (term.length >= 6) return 8;
  if (term.length >= 4) return 5;
  if (term.length === 3) return 3;
  return 2;
}

/**
 * Score one structural unit against profile retrieval terms using optional
 * tracked source evidence. Zero means "no usable overlap".
 */
export function scoreSemanticUnitMatch(input: {
  entry: StructuralUnitIndexEntry;
  terms: readonly string[];
  evidence?: SemanticUnitEvidenceText | null;
}): number {
  if (input.terms.length === 0) return 0;
  const evidence = input.evidence ?? {};
  const title = normalizeEvidenceText(evidence.title ?? '');
  const sourceText = normalizeEvidenceText(evidence.sourceText ?? '');
  const knowledge = normalizeEvidenceText((evidence.knowledgeNodeIds ?? []).join(' '));
  const capability = normalizeEvidenceText((evidence.capabilityTargetIds ?? []).join(' '));
  const idBlob = normalizeEvidenceText([
    input.entry.structuralUnitId,
    input.entry.resourceId,
    input.entry.segmentId,
    input.entry.atomicResourceId,
    ...(input.entry.stableIds ?? []),
  ].filter(Boolean).join(' '));

  let score = 0;
  let contentHits = 0;
  for (const term of input.terms) {
    const w = termWeight(term);
    if (title && includesTermBounded(title, term)) {
      score += w * 3;
      contentHits += 1;
    }
    if (knowledge && includesTermBounded(knowledge, term)) {
      score += w * 4;
      contentHits += 1;
    }
    if (capability && includesTermBounded(capability, term)) {
      score += w * 3;
      contentHits += 1;
    }
    if (sourceText && includesTermBounded(sourceText, term)) {
      score += w * 2;
      contentHits += 1;
    }
    // Meaningful ID tokens (CJK names / long Latin) count as content evidence.
    // Opaque cuid fragments never pass includesTermBounded for domain terms.
    if (idBlob && includesTermBounded(idBlob, term)) {
      const meaningfulId = /[\u4e00-\u9fff]/u.test(term) || term.length >= 4;
      if (meaningfulId) {
        score += w * 2;
        contentHits += 1;
      } else {
        score += 1;
      }
    }
  }
  // No title/source/graph/meaningful-id overlap → omit (no alphabetical fill-in).
  if (contentHits === 0) return 0;
  score += familyRankBoost(evidence.family);
  return score;
}

/**
 * Upstream triples are opaque positioning inputs. Governance references them
 * without rewriting authority data or assigning teaching roles.
 */
export function referenceOpaqueUpstream(
  upstream: OpaqueUpstreamRagReference,
): OpaqueUpstreamRagReference {
  return {
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
  };
}

export function crosswalkIdFor(input: {
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string | null;
  captureRevision: string;
}): string {
  return `act-xwalk:${sha256Canonical({
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    deltaReceiptId: input.deltaReceiptId,
    upstream: referenceOpaqueUpstream(input.upstream),
    canonicalId: input.canonicalId,
    captureRevision: input.captureRevision,
  })}`;
}

function matchingIndexEntries(
  index: readonly StructuralUnitIndexEntry[],
  stableIds: readonly string[],
  contentHashes: readonly string[],
): StructuralUnitIndexEntry[] {
  const idSet = new Set(stableIds.filter(Boolean));
  const hashSet = new Set(contentHashes.filter(Boolean));
  return index.filter((entry) => {
    const idHit = entry.stableIds.some((id) => idSet.has(id));
    const hashHit = entry.contentHashes.some((hash) => hashSet.has(hash));
    return idHit || hashHit;
  });
}

function completeTuple(entry: StructuralUnitIndexEntry, capture: CaptureIdentity): boolean {
  return Boolean(
    entry.sourceEditionId
    && entry.sourceVersion
    && entry.structuralUnitId
    && entry.structuralUnitVersion
    && entry.structuralUnitHash
    && entry.atomicResourceId
    && entry.resourceId
    && entry.segmentId
    && entry.resourceSegmentHash
    && capture.inventoryRunId
    && capture.captureRevision,
  );
}

function unresolvedRecord(input: {
  baseId: string;
  capture: CaptureIdentity;
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string | null;
  validationState?: ActStructuralUnitCrosswalkRecord['validationState'];
  reviewIdentity?: string | null;
  evidenceDigest?: string | null;
}): ActStructuralUnitCrosswalkRecord {
  return {
    id: input.baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: input.upstream.publishedEntityId,
    retrievalChunkId: input.upstream.retrievalChunkId,
    citationTargetId: input.upstream.citationTargetId,
    canonicalId: input.canonicalId,
    sourceEditionId: null,
    sourceVersion: null,
    structuralUnitId: null,
    structuralUnitVersion: null,
    structuralUnitHash: null,
    evidenceContentHash: null,
    // Unresolved diagnostics must not partially bind inventory (pair CHECK).
    inventoryRunId: null,
    atomicResourceId: null,
    resourceId: null,
    segmentId: null,
    resourceSegmentHash: null,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'UNRESOLVED',
    validationState: input.validationState ?? 'UNRESOLVED',
    validationDigest: null,
    reviewIdentity: input.reviewIdentity ?? null,
    evidenceDigest: input.evidenceDigest ?? null,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Deterministic alignment requires unique stable-ID/hash match against one
 * versioned ACT structural-unit index entry and the complete
 * edition/unit/version/hash/inventory/resource/segment tuple.
 */
export function attemptDeterministicAlignment(
  input: DeterministicAlignmentInput,
): ActStructuralUnitCrosswalkRecord {
  // Observed capture for deterministic work is the caller's capture identity
  // already verified at pipeline entry. Re-check shape only.
  if (!input.capture.inventoryRunId || !input.capture.captureRevision) {
    throw new Error(
      'Deterministic alignment rejected: inventoryRunId and captureRevision required',
    );
  }
  const upstream = referenceOpaqueUpstream(input.upstream);
  const baseId = crosswalkIdFor({
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    upstream,
    canonicalId: input.canonicalId,
    captureRevision: input.capture.captureRevision,
  });

  // Relation-type / non-object upstream cannot become VALIDATED Canonical Crosswalks.
  if (!input.canonicalId) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: null,
    });
  }

  const matches = matchingIndexEntries(
    input.index,
    input.stableIds ?? [],
    input.contentHashes ?? [],
  ).filter((entry) => completeTuple(entry, input.capture));

  if (matches.length !== 1) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.canonicalId,
    });
  }

  const match = matches[0]!;
  const validationDigest = sha256Canonical({
    upstream,
    canonicalId: input.canonicalId,
    sourceEditionId: match.sourceEditionId,
    sourceVersion: match.sourceVersion,
    structuralUnitId: match.structuralUnitId,
    structuralUnitVersion: match.structuralUnitVersion,
    structuralUnitHash: match.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: match.atomicResourceId,
    resourceId: match.resourceId,
    segmentId: match.segmentId,
    resourceSegmentHash: match.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    releaseSetId: input.capture.releaseSetId,
    deltaReceiptId: input.capture.deltaReceiptId,
  });

  return {
    id: baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
    canonicalId: input.canonicalId,
    sourceEditionId: match.sourceEditionId,
    sourceVersion: match.sourceVersion,
    structuralUnitId: match.structuralUnitId,
    structuralUnitVersion: match.structuralUnitVersion,
    structuralUnitHash: match.structuralUnitHash,
    evidenceContentHash: match.contentHashes[0] ?? match.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: match.atomicResourceId,
    resourceId: match.resourceId,
    segmentId: match.segmentId,
    resourceSegmentHash: match.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'DETERMINISTIC',
    validationState: 'VALIDATED',
    validationDigest,
    reviewIdentity: null,
    evidenceDigest: validationDigest,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Authoritative generator prompt / identity version for semantic alignment
 * candidateIds. Worklist generation and production full-index resolution MUST
 * use this same value — candidateId digests include generatorPromptVersion.
 *
 * v3: binds structural unit *content hash*, not Git capture revision
 * (structuralUnitVersion). Prevents review candidateIds from invalidating
 * when controlled authoring is committed and inventory captureRevision moves.
 */
export const AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION =
  'aggregate-semantic-align/v3' as const;

/**
 * Stable candidateId contract shared by worklist generators and production.
 *
 * Identity fields:
 * - exact upstream triple
 * - canonicalId
 * - structuralUnitId
 * - structuralUnitHash (content identity; NOT capture revision)
 * - generatorPromptVersion
 */
export function semanticAlignmentCandidateId(input: {
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string;
  structuralUnitId: string;
  structuralUnitHash: string;
  generatorPromptVersion?: string;
}): string {
  return sha256Canonical({
    upstream: referenceOpaqueUpstream(input.upstream),
    canonicalId: input.canonicalId,
    structuralUnitId: input.structuralUnitId,
    structuralUnitHash: input.structuralUnitHash,
    generatorPromptVersion:
      input.generatorPromptVersion
      ?? AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
  });
}

/**
 * Generate semantic candidates from Canonical identity against one structural
 * index. Does not publish; acceptance requires isolated review.
 *
 * Ranking uses deterministic term overlap between Canonical profile text and
 * optional tracked unit evidence (title/sourceText/graph ids) plus inventory
 * identities. Candidates with no usable overlap are omitted — alphabetical
 * fill-in is forbidden so Bode/process shells cannot monopolize zero-score sets.
 * Never auto-accepts and never emits final review outcomes.
 */
export function generateSemanticAlignmentCandidates(input: {
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string;
  canonicalProfileDigest: string;
  index: readonly StructuralUnitIndexEntry[];
  generatorPromptVersion?: string;
  maxCandidates?: number;
  /** Optional profile text for ranking only (not acceptance). */
  profileText?: string;
  /**
   * Optional per-unit evidence keyed by structuralUnitEvidenceKey().
   * sourceText/title must come from tracked sources, never model prose.
   */
  unitEvidenceByKey?: ReadonlyMap<string, SemanticUnitEvidenceText> | Record<string, SemanticUnitEvidenceText>;
  /** Minimum score to keep a candidate. Default 5 (requires real content overlap). */
  minScore?: number;
}): SemanticAlignmentCandidate[] {
  if (input.index.length === 0) return [];
  const limit = input.maxCandidates ?? 5;
  const minScore = input.minScore ?? 5;
  const generatorPromptVersion = input.generatorPromptVersion
    ?? AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION;
  const terms = extractProfileRetrievalTerms(input.profileText ?? '');

  const evidenceLookup = (entry: StructuralUnitIndexEntry): SemanticUnitEvidenceText | null => {
    if (!input.unitEvidenceByKey) return null;
    const key = structuralUnitEvidenceKey(entry);
    if (input.unitEvidenceByKey instanceof Map) {
      return input.unitEvidenceByKey.get(key) ?? null;
    }
    const record = input.unitEvidenceByKey as Record<string, SemanticUnitEvidenceText>;
    return record[key] ?? null;
  };

  // Node-driven semantic candidates require usable profile terms. Never fall
  // back to alphabetical structuralUnitId fill-in (that produced Bode/shell monopoly).
  if (terms.length === 0) return [];

  const complete = input.index.filter((entry) => (
    entry.sourceEditionId
    && entry.sourceVersion
    && entry.structuralUnitId
    && entry.structuralUnitVersion
    && entry.structuralUnitHash
  ));

  const ranked = complete
    .map((entry) => ({
      entry,
      score: scoreSemanticUnitMatch({
        entry,
        terms,
        evidence: evidenceLookup(entry),
      }),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => {
      const rankDelta = b.score - a.score;
      if (rankDelta !== 0) return rankDelta;
      return a.entry.structuralUnitId.localeCompare(b.entry.structuralUnitId)
        || String(a.entry.segmentId ?? '').localeCompare(String(b.entry.segmentId ?? ''));
    })
    .slice(0, limit);

  return ranked.map(({ entry, score }) => ({
    candidateId: semanticAlignmentCandidateId({
      upstream: input.upstream,
      canonicalId: input.canonicalId,
      structuralUnitId: entry.structuralUnitId,
      structuralUnitHash: entry.structuralUnitHash,
      generatorPromptVersion,
    }),
    upstream: referenceOpaqueUpstream(input.upstream),
    canonicalId: input.canonicalId,
    structuralUnitId: entry.structuralUnitId,
    structuralUnitVersion: entry.structuralUnitVersion,
    structuralUnitHash: entry.structuralUnitHash,
    sourceEditionId: entry.sourceEditionId,
    sourceVersion: entry.sourceVersion,
    rationale: `profile:${input.canonicalProfileDigest.slice(0, 12)};score:${score}`,
    generatorPromptVersion,
  }));
}

export function acceptSemanticAlignment(input: {
  candidate: SemanticAlignmentCandidate;
  review: SemanticAlignmentReview;
  capture: CaptureIdentity;
  inventoryAtomic?: {
    atomicResourceId: string | null;
    resourceId: string | null;
    segmentId: string | null;
    resourceSegmentHash: string | null;
  };
}): ActStructuralUnitCrosswalkRecord {
  const upstream = referenceOpaqueUpstream(input.candidate.upstream);
  const baseId = crosswalkIdFor({
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    upstream,
    canonicalId: input.candidate.canonicalId,
    captureRevision: input.capture.captureRevision,
  });

  if (
    input.review.outcome !== 'ACCEPT'
    || !input.review.reviewIdentity
    || !input.review.evidenceDigest
  ) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.candidate.canonicalId,
      validationState: input.review.outcome === 'REJECT' ? 'REJECTED' : 'UNRESOLVED',
      reviewIdentity: input.review.reviewIdentity,
      evidenceDigest: input.review.evidenceDigest,
    });
  }

  // Explicit evidence-bearing isolated review is required for semantic accept.
  // Still need the complete inventory/resource tuple for publication gates.
  const atomic = input.inventoryAtomic;
  if (
    !atomic?.atomicResourceId
    || !atomic.resourceId
    || !atomic.segmentId
    || !atomic.resourceSegmentHash
    || !input.capture.inventoryRunId
  ) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.candidate.canonicalId,
      validationState: 'UNRESOLVED',
      reviewIdentity: input.review.reviewIdentity,
      evidenceDigest: input.review.evidenceDigest,
    });
  }

  const validationDigest = sha256Canonical({
    upstream,
    canonicalId: input.candidate.canonicalId,
    structuralUnitId: input.candidate.structuralUnitId,
    structuralUnitVersion: input.candidate.structuralUnitVersion,
    structuralUnitHash: input.candidate.structuralUnitHash,
    reviewIdentity: input.review.reviewIdentity,
    evidenceDigest: input.review.evidenceDigest,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: atomic.atomicResourceId,
    resourceId: atomic.resourceId,
    segmentId: atomic.segmentId,
    resourceSegmentHash: atomic.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    deltaReceiptId: input.capture.deltaReceiptId,
  });

  return {
    id: baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
    canonicalId: input.candidate.canonicalId,
    sourceEditionId: input.candidate.sourceEditionId,
    sourceVersion: input.candidate.sourceVersion,
    structuralUnitId: input.candidate.structuralUnitId,
    structuralUnitVersion: input.candidate.structuralUnitVersion,
    structuralUnitHash: input.candidate.structuralUnitHash,
    evidenceContentHash: input.candidate.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: atomic.atomicResourceId,
    resourceId: atomic.resourceId,
    segmentId: atomic.segmentId,
    resourceSegmentHash: atomic.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'SEMANTIC',
    validationState: 'VALIDATED',
    validationDigest,
    reviewIdentity: input.review.reviewIdentity,
    evidenceDigest: input.review.evidenceDigest,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Re-run endpoint/version/hash/uniqueness/ReleaseSet/Delta/capture gates.
 */
export function validateCrosswalkForShadowPublication(input: {
  crosswalk: ActStructuralUnitCrosswalkRecord;
  capture: CaptureIdentity;
  existingCurrent: readonly ActStructuralUnitCrosswalkRecord[];
}): { ok: true; crosswalk: ActStructuralUnitCrosswalkRecord } | { ok: false; reason: string } {
  const row = input.crosswalk;
  if (row.validationState !== 'VALIDATED') {
    return { ok: false, reason: 'not-validated' };
  }
  if (!row.canonicalId) {
    return { ok: false, reason: 'missing-canonical-object' };
  }
  if (
    !row.structuralUnitId
    || !row.structuralUnitVersion
    || !row.structuralUnitHash
    || !row.sourceEditionId
    || !row.sourceVersion
    || !row.validationDigest
    || !row.inventoryRunId
    || !row.atomicResourceId
    || !row.resourceId
    || !row.segmentId
    || !row.resourceSegmentHash
  ) {
    return { ok: false, reason: 'missing-structural-or-inventory-identity' };
  }
  if (
    row.releaseSetId !== input.capture.releaseSetId
    || row.releaseId !== input.capture.releaseId
    || row.deltaReceiptId !== input.capture.deltaReceiptId
    || row.captureRevision !== input.capture.captureRevision
  ) {
    return { ok: false, reason: 'capture-or-release-drift' };
  }
  if (
    input.capture.inventoryRunId != null
    && row.inventoryRunId !== input.capture.inventoryRunId
  ) {
    return { ok: false, reason: 'inventory-run-drift' };
  }
  const duplicates = input.existingCurrent.filter((other) => (
    other.id !== row.id
    && other.lifecycleState === 'CURRENT'
    && other.validationState === 'VALIDATED'
    && other.publishedEntityId === row.publishedEntityId
    && other.retrievalChunkId === row.retrievalChunkId
    && other.citationTargetId === row.citationTargetId
    && other.canonicalId === row.canonicalId
  ));
  if (duplicates.length > 0) {
    return { ok: false, reason: 'non-unique-crosswalk' };
  }
  return { ok: true, crosswalk: row };
}

export function invalidateCrosswalks(input: {
  current: readonly ActStructuralUnitCrosswalkRecord[];
  removedObjectIds?: readonly string[];
  removedTripleKeys?: readonly string[];
  changedStructuralUnitIds?: readonly string[];
}): {
  retained: ActStructuralUnitCrosswalkRecord[];
  invalidated: ActStructuralUnitCrosswalkRecord[];
} {
  const removedObjects = new Set(input.removedObjectIds ?? []);
  const removedTriples = new Set(input.removedTripleKeys ?? []);
  const changedUnits = new Set(input.changedStructuralUnitIds ?? []);
  const retained: ActStructuralUnitCrosswalkRecord[] = [];
  const invalidated: ActStructuralUnitCrosswalkRecord[] = [];
  for (const row of input.current) {
    const key = tripleKey(row);
    const hit = (row.canonicalId != null && removedObjects.has(row.canonicalId))
      || removedTriples.has(key)
      || (row.structuralUnitId != null && changedUnits.has(row.structuralUnitId));
    if (hit) {
      invalidated.push({
        ...row,
        lifecycleState: 'STALE',
        resolutionState: 'STALE',
        validationState: 'STALE',
      });
    } else {
      retained.push(row);
    }
  }
  return { retained, invalidated };
}
