/**
 * Aggregate CourseCoverage authoring helpers for #1126.
 *
 * Production governance loads the Git-tracked ACTIVE authoring file only.
 * Candidate generation is an explicit helper that MUST NOT assign a production
 * review identity or write the active path.
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
  AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
  AGGREGATE_COURSE_ID,
  buildDispositionFromReview,
  computeCoverageSourceHash,
  validateCourseCoverageAuthoring,
  type CourseCoverageAuthoringOverlay,
  type CourseCoverageDisposition,
  type CourseCoverageRole,
} from '../../src/lib/aggregate-governance';

export const AGGREGATE_COVERAGE_SCHEMA_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/course-coverage-overlay.v2.schema.json';
export const AGGREGATE_COVERAGE_ACTIVE_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/active/automatic-control.json';
export const AGGREGATE_COVERAGE_CANDIDATE_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/candidates/automatic-control.heuristic-candidate.json';
/** Controlled ACT Crosswalk semantic reviews (optional; missing → all unresolved). */
export const AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json';
/** Controlled #1124 binding reviews keyed by pairId (optional; never auto-accept). */
export const AGGREGATE_BINDING_REVIEWS_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/active/resource-binding-reviews.json';

/**
 * Generator worklists (deterministic, Git-trackable). Never contain final roles/outcomes.
 * A separate Grok semantic-review session authors the pending review decision files.
 */
export const AGGREGATE_COVERAGE_WORKLIST_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/candidates/course-coverage-worklist.json';
export const AGGREGATE_CROSSWALK_WORKLIST_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/candidates/act-crosswalk-semantic-worklist.json';
export const AGGREGATE_BINDING_WORKLIST_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/candidates/resource-binding-worklist.json';

/** Reviewer-authored decision files (pending until a separate session writes them). */
export const AGGREGATE_COVERAGE_REVIEW_DECISIONS_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/course-coverage-review-decisions.json';
export const AGGREGATE_CROSSWALK_REVIEW_DECISIONS_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/act-crosswalk-review-decisions.json';
export const AGGREGATE_BINDING_REVIEW_DECISIONS_PATH =
  'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/resource-binding-review-decisions.json';

/** Relocated heuristic self-review artifacts — never load as production evidence. */
export const AGGREGATE_INVALIDATED_HEURISTIC_DIR =
  'course-content/authoring/knowledge/course-coverage/aggregate/candidates/invalidated-heuristic-self-review';

export const RUNTIME_RESOURCE_PROJECTION_ARTIFACT_PATH =
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';

/** Unreviewed candidate generator marker — never a production review identity. */
export const AGGREGATE_CANDIDATE_GENERATOR_IDENTITY =
  'candidate-generator:unreviewed-heuristic-v1' as const;

export const AGGREGATE_GOVERNANCE_PROTECTED_PATHS = [
  AGGREGATE_COVERAGE_ACTIVE_PATH,
  AGGREGATE_COVERAGE_SCHEMA_PATH,
  AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH,
  AGGREGATE_BINDING_REVIEWS_PATH,
  AGGREGATE_COVERAGE_WORKLIST_PATH,
  AGGREGATE_CROSSWALK_WORKLIST_PATH,
  AGGREGATE_BINDING_WORKLIST_PATH,
  'scripts/course-coverage/aggregate-coverage.ts',
  'scripts/db/run-aggregate-course-resource-governance.ts',
  'src/lib/aggregate-governance',
  'prisma/schema.prisma',
  'prisma/migrations/20260730010000_govern_aggregate_course_coverage_and_resource_bindings/migration.sql',
] as const;

/**
 * Bounded buffer for `git show` of controlled governance JSON.
 * Active Crosswalk reviews are multi-MiB; Node's default maxBuffer (1 MiB) fails closed incorrectly.
 * Keep explicit and finite — not an unbounded shell workaround.
 */
export const AGGREGATE_GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

const GIT_ERROR_DETAIL_MAX_CHARS = 400;

function asUtf8Text(value: string | Buffer | null | undefined): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : value.toString('utf8');
}

/**
 * Build a fail-closed Git error message without echoing stdout (protected artifact bodies).
 * Stderr is length-bounded and suppressed when it looks like structured payload.
 */
export function formatAggregateGitFailure(
  args: readonly string[],
  result: {
    status: number | null;
    signal?: NodeJS.Signals | null;
    error?: Error | null;
    stderr?: string | Buffer | null;
    stdout?: string | Buffer | null;
  },
): string {
  const command = args.join(' ');
  const prefix = `Aggregate coverage Git verification failed for ${command}`;

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === 'ENOBUFS') {
      return (
        `${prefix}: output exceeded maxBuffer `
        + `(${AGGREGATE_GIT_MAX_BUFFER_BYTES} bytes); refuse to echo artifact contents`
      );
    }
    // error.message may mention buffer limits; never append stdout.
    return `${prefix}: ${result.error.message}`;
  }

  const parts: string[] = [];
  if (result.status != null) parts.push(`exit ${result.status}`);
  if (result.signal) parts.push(`signal ${result.signal}`);

  const stderr = asUtf8Text(result.stderr).trim();
  if (stderr) {
    const clipped = stderr.length > GIT_ERROR_DETAIL_MAX_CHARS
      ? `${stderr.slice(0, GIT_ERROR_DETAIL_MAX_CHARS)}…`
      : stderr;
    // Never re-emit structured payload-looking stderr as diagnostics.
    if (/^\s*[{[]/u.test(clipped)) {
      parts.push('stderr omitted (looks like structured payload)');
    } else {
      parts.push(clipped);
    }
  } else {
    parts.push('no stderr (stdout suppressed to avoid leaking protected artifacts)');
  }

  // Intentionally ignore result.stdout — may hold entire protected JSON.
  return `${prefix}: ${parts.join('; ')}`;
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: AGGREGATE_GIT_MAX_BUFFER_BYTES,
  });
  if (result.error || result.status !== 0) {
    throw new Error(formatAggregateGitFailure(args, result));
  }
  return result.stdout.trim();
}

export interface ProjectionNodeLike {
  entity_id?: string;
  entityId?: string;
  semantic_name?: string | null;
  semanticName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  concept_kind?: string | null;
  conceptKind?: string | null;
  entity_type?: string | null;
  entityType?: string | null;
  description?: string | null;
}

export interface ActCurriculumEvidence {
  formalObjectiveIds?: readonly string[];
  curriculumTopicTerms?: readonly string[];
  curriculumNodeNames?: readonly string[];
}

/**
 * Heuristic candidate disposition ONLY.
 * Does not claim review. Uses candidate-generator identity.
 * Must never write the active controlled path as authoritative review.
 */
export function disposeAggregateObjectHeuristicCandidate(input: {
  canonicalId: string;
  entityType: string | null;
  conceptKind: string | null;
  semanticName: string | null;
  displayName: string | null;
  description?: string | null;
  curriculum: ActCurriculumEvidence;
}): CourseCoverageDisposition {
  const profileText = [
    input.semanticName,
    input.displayName,
    input.description,
    input.conceptKind,
    input.entityType,
  ].filter(Boolean).join(' ').toLowerCase();

  const profileEvidence = [
    `canonical:${input.canonicalId}`,
    input.entityType ? `type:${input.entityType}` : null,
    input.conceptKind ? `kind:${input.conceptKind}` : null,
    input.semanticName ? `semantic-name:${input.semanticName}` : null,
    input.displayName ? `display-name:${input.displayName}` : null,
  ].filter((row): row is string => Boolean(row));

  const formalIds = new Set(input.curriculum.formalObjectiveIds ?? []);
  if (formalIds.has(input.canonicalId)) {
    return buildDispositionFromReview({
      canonicalId: input.canonicalId,
      role: 'formal_objective',
      rationale: null,
      evidenceRefs: [
        ...profileEvidence,
        'act-course-source:course-coverage/active/automatic-control.json',
        `generator:${AGGREGATE_CANDIDATE_GENERATOR_IDENTITY}`,
      ],
      reviewIdentity: AGGREGATE_CANDIDATE_GENERATOR_IDENTITY,
      allowCandidateIdentity: true,
    });
  }

  const topicTerms = (input.curriculum.curriculumTopicTerms ?? [])
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);
  const nodeNames = (input.curriculum.curriculumNodeNames ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length >= 2);
  const matchedTopics = topicTerms.filter((term) => profileText.includes(term));
  const matchedNodes = nodeNames.filter((name) => profileText.includes(name));

  let role: CourseCoverageRole = 'excluded_with_rationale';
  let rationale: string | null =
    'HEURISTIC CANDIDATE ONLY — no ACT curriculum mapping detected; not a reviewed decision.';
  const evidenceRefs = [
    ...profileEvidence,
    'act-course-source:canonical-nodes+lesson-topics',
    `generator:${AGGREGATE_CANDIDATE_GENERATOR_IDENTITY}`,
  ];

  if (matchedNodes.length > 0 || matchedTopics.length >= 2) {
    role = 'formal_objective';
    rationale = null;
    evidenceRefs.push(
      ...matchedNodes.slice(0, 3).map((name) => `act-curriculum-node-name:${name}`),
      ...matchedTopics.slice(0, 3).map((term) => `act-curriculum-topic-term:${term}`),
    );
  } else if (matchedTopics.length === 1) {
    role = 'necessary_prerequisite';
    rationale = null;
    evidenceRefs.push(`act-curriculum-topic-term:${matchedTopics[0]!}`);
  } else {
    evidenceRefs.push('exclusion:no-act-curriculum-binding-heuristic');
  }

  return buildDispositionFromReview({
    canonicalId: input.canonicalId,
    role,
    rationale,
    evidenceRefs,
    reviewIdentity: AGGREGATE_CANDIDATE_GENERATOR_IDENTITY,
    allowCandidateIdentity: true,
  });
}

/**
 * Build an unreviewed candidate overlay for human/agent review.
 * Production import MUST NOT consume this without a separate reviewed activation.
 */
export function buildCandidateCoverageAuthoring(input: {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  /** Candidate may leave null until bound at review activation. */
  deltaReceiptId: string | null;
  authoringRevision: string;
  overlayVersion?: string;
  memberIds: readonly string[];
  nodes: readonly ProjectionNodeLike[];
  curriculum: ActCurriculumEvidence;
}): CourseCoverageAuthoringOverlay & { deltaReceiptId: string | null; unreviewedCandidate: true } {
  const byId = new Map<string, ProjectionNodeLike>();
  for (const node of input.nodes) {
    const id = node.entity_id ?? node.entityId;
    if (id) byId.set(id, node);
  }
  const ids = [...new Set(input.memberIds)].sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) {
    throw new Error('Candidate coverage authoring rejected: empty membership');
  }

  const entries = ids.map((canonicalId) => {
    const node = byId.get(canonicalId);
    return disposeAggregateObjectHeuristicCandidate({
      canonicalId,
      entityType: (node?.entity_type ?? node?.entityType ?? null) as string | null,
      conceptKind: (node?.concept_kind ?? node?.conceptKind ?? null) as string | null,
      semanticName: (node?.semantic_name ?? node?.semanticName ?? null) as string | null,
      displayName: (node?.display_name ?? node?.displayName ?? null) as string | null,
      description: (node?.description ?? null) as string | null,
      curriculum: input.curriculum,
    });
  });

  const withoutHash = {
    schemaVersion: AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
    overlayId: AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
    overlayVersion: input.overlayVersion ?? '1',
    courseId: AGGREGATE_COURSE_ID,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    deltaReceiptId: input.deltaReceiptId ?? 'UNBOUND_CANDIDATE_REQUIRES_REVIEW_ACTIVATION',
    mode: 'baseline' as const,
    authoringRevision: input.authoringRevision,
    entries,
  };
  return {
    ...withoutHash,
    sourceHash: computeCoverageSourceHash(withoutHash),
    // Preserve original null-ish intent for tooling; validation of active rejects unbound.
    deltaReceiptId: input.deltaReceiptId ?? 'UNBOUND_CANDIDATE_REQUIRES_REVIEW_ACTIVATION',
    unreviewedCandidate: true,
  };
}

/**
 * Load and verify the controlled ACTIVE authoring file for production.
 * Rejects alternate paths, dirty/untracked protected inputs, and source hash drift.
 */
export async function loadTrackedActiveCoverageAuthoring(
  root: string,
): Promise<{ overlay: unknown; captureRevision: string; committedSourceHash: string }> {
  const relativePath = AGGREGATE_COVERAGE_ACTIVE_PATH;
  const dirty = git(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...AGGREGATE_GOVERNANCE_PROTECTED_PATHS,
  ]);
  if (dirty) {
    throw new Error(
      `Aggregate coverage rejected: protected authoring/implementation paths are dirty:\n${dirty}`,
    );
  }
  git(root, ['ls-files', '--error-unmatch', '--', relativePath, AGGREGATE_COVERAGE_SCHEMA_PATH]);
  const captureRevision = git(root, ['rev-parse', '--verify', 'HEAD']);
  if (!/^[a-f0-9]{40}$/u.test(captureRevision)) {
    throw new Error('Aggregate coverage rejected: governance HEAD is not a 40-char commit');
  }
  const committed = git(root, ['show', `${captureRevision}:${relativePath}`]);
  let committedOverlay: unknown;
  try {
    committedOverlay = JSON.parse(committed);
  } catch {
    throw new Error('Aggregate coverage rejected: committed active authoring is not valid JSON');
  }
  const absolute = path.join(root, relativePath);
  const working = JSON.parse(await readFile(absolute, 'utf8')) as unknown;
  const workingJson = JSON.stringify(working);
  const committedJson = JSON.stringify(committedOverlay);
  if (workingJson !== committedJson) {
    throw new Error(
      'Aggregate coverage rejected: active authoring working tree does not match committed capture',
    );
  }
  const record = committedOverlay as { sourceHash?: string; deltaReceiptId?: unknown };
  if (typeof record.deltaReceiptId !== 'string' || !record.deltaReceiptId.trim()) {
    throw new Error(
      'Aggregate coverage rejected: active authoring must bind a non-null deltaReceiptId',
    );
  }
  if (
    record.deltaReceiptId === 'UNBOUND_CANDIDATE_REQUIRES_REVIEW_ACTIVATION'
    || record.deltaReceiptId.startsWith('UNBOUND_')
  ) {
    throw new Error(
      'Aggregate coverage rejected: active authoring still has unbound candidate deltaReceiptId',
    );
  }
  if (typeof record.sourceHash !== 'string' || !/^[a-f0-9]{64}$/u.test(record.sourceHash)) {
    throw new Error('Aggregate coverage rejected: active authoring sourceHash invalid');
  }
  // Full production validation (rejects candidate-generator identities even if
  // a heuristic file is copied under active/ and re-hashed).
  const overlay = committedOverlay as {
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash?: string | null;
    entries: Array<{ canonicalId: string }>;
  };
  validateCourseCoverageAuthoring(committedOverlay, {
    currentCanonicalIds: overlay.entries.map((row) => row.canonicalId),
    releaseSetId: overlay.releaseSetId,
    releaseId: overlay.releaseId,
    releaseHash: overlay.releaseHash,
    sourceDatasetHash: overlay.sourceDatasetHash,
    mode: 'baseline',
    requireExhaustive: false,
  });
  return {
    overlay: committedOverlay,
    captureRevision,
    committedSourceHash: record.sourceHash,
  };
}

/** @deprecated Use loadTrackedActiveCoverageAuthoring — production forbids alternate paths. */
export async function loadTrackedCoverageAuthoring(
  root: string,
  relativePath?: string,
): Promise<unknown> {
  if (relativePath && relativePath !== AGGREGATE_COVERAGE_ACTIVE_PATH) {
    throw new Error(
      `Aggregate coverage rejected: production may only load controlled path ${AGGREGATE_COVERAGE_ACTIVE_PATH}`,
    );
  }
  const loaded = await loadTrackedActiveCoverageAuthoring(root);
  return loaded.overlay;
}

export async function loadProjectionNodes(root: string, projectionPath: string) {
  const raw = JSON.parse(await readFile(path.join(root, projectionPath), 'utf8')) as {
    nodes?: ProjectionNodeLike[];
  };
  return raw.nodes ?? [];
}

export function validateBaselineAuthoring(
  overlay: CourseCoverageAuthoringOverlay,
  currentCanonicalIds: readonly string[],
) {
  return validateCourseCoverageAuthoring(overlay, {
    currentCanonicalIds,
    releaseSetId: overlay.releaseSetId,
    releaseId: overlay.releaseId,
    releaseHash: overlay.releaseHash,
    sourceDatasetHash: overlay.sourceDatasetHash,
    mode: 'baseline',
  });
}

export type LoadedCrosswalkSemanticReviews = Readonly<Record<string, {
  outcome: 'ACCEPT' | 'REJECT' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'HIGH_IMPACT';
  reviewIdentity: string;
  reviewerPromptVersion: string;
  evidenceDigest: string;
  rationale: string;
  candidateId?: string;
}>>;

export type LoadedBindingReviews = Readonly<Record<string, {
  outcome: 'ACCEPT' | 'REJECT' | 'DISPUTE' | 'HUMAN_REQUIRED';
  proposedRole: 'EXPLAINS' | 'PRACTICES' | 'ASSESSES' | 'REFERENCES';
  reviewIdentity: string;
  reviewerPromptVersion: string;
  evidenceDigest: string;
  evidenceIds?: readonly string[];
  rationale: string;
  reviewProvider: 'GPT' | 'FIXTURE' | 'HUMAN' | 'NONE' | 'GROK';
}>>;

/**
 * Load optional controlled Crosswalk semantic reviews for the production runner.
 * Missing file is valid (all semantic alignments stay unresolved).
 * When present, file must be Git-tracked, clean, and bind the accepted Delta.
 */
/**
 * @param allowedTripleKeys When provided, every review key must be in this set
 *   (current work manifest) and every allowed key is not required to be reviewed.
 *   Unknown keys fail closed. Empty set means "require no reviews loaded".
 */
export async function loadTrackedCrosswalkSemanticReviews(
  root: string,
  expectedDeltaReceiptId: string,
  allowedTripleKeys?: ReadonlySet<string>,
): Promise<LoadedCrosswalkSemanticReviews> {
  const relativePath = AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH;
  const tracked = git(root, ['ls-files', '--', relativePath]);
  if (!tracked) return {};
  const dirty = git(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    relativePath,
  ]);
  if (dirty) {
    throw new Error(
      `Aggregate coverage rejected: crosswalk semantic reviews path is dirty:\n${dirty}`,
    );
  }
  const captureRevision = git(root, ['rev-parse', '--verify', 'HEAD']);
  const committed = JSON.parse(git(root, ['show', `${captureRevision}:${relativePath}`])) as {
    schemaVersion?: string;
    deltaReceiptId?: string;
    reviews?: Record<string, {
      outcome?: string;
      reviewIdentity?: string;
      reviewerPromptVersion?: string;
      evidenceDigest?: string;
      rationale?: string;
      candidateId?: string;
    }>;
  };
  const working = JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as typeof committed;
  if (JSON.stringify(working) !== JSON.stringify(committed)) {
    throw new Error(
      'Aggregate coverage rejected: crosswalk semantic reviews working tree drifts from HEAD',
    );
  }
  if (committed.schemaVersion !== 'act-crosswalk-semantic-reviews/v1') {
    throw new Error('Aggregate coverage rejected: crosswalk semantic reviews schemaVersion invalid');
  }
  if (committed.deltaReceiptId !== expectedDeltaReceiptId) {
    throw new Error(
      `Aggregate coverage rejected: crosswalk semantic reviews deltaReceiptId `
      + `${committed.deltaReceiptId} does not match accepted Delta ${expectedDeltaReceiptId}`,
    );
  }
  const out: Record<string, {
    outcome: 'ACCEPT' | 'REJECT' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'HIGH_IMPACT';
    reviewIdentity: string;
    reviewerPromptVersion: string;
    evidenceDigest: string;
    rationale: string;
    candidateId?: string;
  }> = {};
  for (const [key, row] of Object.entries(committed.reviews ?? {})) {
    if (!row || typeof row !== 'object') continue;
    if (allowedTripleKeys && !allowedTripleKeys.has(key)) {
      throw new Error(
        `Aggregate coverage rejected: crosswalk review key not in current workset: ${key}`,
      );
    }
    const outcome = String(row.outcome ?? '');
    if (!['ACCEPT', 'REJECT', 'AMBIGUOUS', 'UNSUPPORTED', 'HIGH_IMPACT'].includes(outcome)) {
      throw new Error(`Aggregate coverage rejected: invalid crosswalk review outcome for ${key}`);
    }
    const reviewIdentity = String(row.reviewIdentity ?? '').trim();
    if (!reviewIdentity || /candidate-generator|unreviewed|unbound/iu.test(reviewIdentity)) {
      throw new Error(
        `Aggregate coverage rejected: non-production crosswalk reviewIdentity for ${key}`,
      );
    }
    const candidateId = row.candidateId == null ? undefined : String(row.candidateId).trim();
    if (outcome === 'ACCEPT' && !candidateId) {
      throw new Error(
        `Aggregate coverage rejected: ACCEPT crosswalk review requires candidateId for ${key}`,
      );
    }
    out[key] = {
      outcome: outcome as 'ACCEPT' | 'REJECT' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'HIGH_IMPACT',
      reviewIdentity,
      reviewerPromptVersion: String(row.reviewerPromptVersion ?? '').trim() || 'aggregate-semantic-align/v1',
      evidenceDigest: String(row.evidenceDigest ?? '').trim(),
      rationale: String(row.rationale ?? '').trim(),
      candidateId,
    };
    if (!out[key]!.evidenceDigest || !/^[a-f0-9]{64}$/u.test(out[key]!.evidenceDigest)) {
      throw new Error(`Aggregate coverage rejected: crosswalk review evidenceDigest invalid for ${key}`);
    }
    if (!out[key]!.rationale) {
      throw new Error(`Aggregate coverage rejected: crosswalk review rationale required for ${key}`);
    }
  }
  return out;
}

/**
 * Load optional controlled #1124 binding reviews. Missing file is valid.
 * Reviews never auto-elevate to SHADOW_PUBLISHED without #1124 gates.
 */
/**
 * @param allowedPairIds When provided, every review pairId must belong to the
 *   current generated candidate workset. Unknown keys fail closed.
 */
export async function loadTrackedBindingReviews(
  root: string,
  expectedDeltaReceiptId: string,
  allowedPairIds?: ReadonlySet<string>,
): Promise<LoadedBindingReviews> {
  const relativePath = AGGREGATE_BINDING_REVIEWS_PATH;
  const tracked = git(root, ['ls-files', '--', relativePath]);
  if (!tracked) return {};
  const dirty = git(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    relativePath,
  ]);
  if (dirty) {
    throw new Error(
      `Aggregate coverage rejected: binding reviews path is dirty:\n${dirty}`,
    );
  }
  const captureRevision = git(root, ['rev-parse', '--verify', 'HEAD']);
  const committed = JSON.parse(git(root, ['show', `${captureRevision}:${relativePath}`])) as {
    schemaVersion?: string;
    deltaReceiptId?: string;
    reviews?: Record<string, {
      outcome?: string;
      proposedRole?: string;
      reviewIdentity?: string;
      reviewerPromptVersion?: string;
      evidenceDigest?: string;
      evidenceIds?: string[];
      rationale?: string;
      reviewProvider?: string;
    }>;
  };
  const working = JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as typeof committed;
  if (JSON.stringify(working) !== JSON.stringify(committed)) {
    throw new Error(
      'Aggregate coverage rejected: binding reviews working tree drifts from HEAD',
    );
  }
  if (committed.schemaVersion !== 'act-resource-binding-reviews/v1') {
    throw new Error('Aggregate coverage rejected: binding reviews schemaVersion invalid');
  }
  if (committed.deltaReceiptId !== expectedDeltaReceiptId) {
    throw new Error(
      `Aggregate coverage rejected: binding reviews deltaReceiptId `
      + `${committed.deltaReceiptId} does not match accepted Delta ${expectedDeltaReceiptId}`,
    );
  }
  const out: Record<string, {
    outcome: 'ACCEPT' | 'REJECT' | 'DISPUTE' | 'HUMAN_REQUIRED';
    proposedRole: 'EXPLAINS' | 'PRACTICES' | 'ASSESSES' | 'REFERENCES';
    reviewIdentity: string;
    reviewerPromptVersion: string;
    evidenceDigest: string;
    evidenceIds?: readonly string[];
    rationale: string;
    reviewProvider: 'GPT' | 'FIXTURE' | 'HUMAN' | 'NONE' | 'GROK';
  }> = {};
  for (const [pairId, row] of Object.entries(committed.reviews ?? {})) {
    if (!row || typeof row !== 'object') continue;
    if (allowedPairIds && !allowedPairIds.has(pairId)) {
      throw new Error(
        `Aggregate coverage rejected: binding review pairId not in current workset: ${pairId}`,
      );
    }
    const outcome = String(row.outcome ?? '');
    if (!['ACCEPT', 'REJECT', 'DISPUTE', 'HUMAN_REQUIRED'].includes(outcome)) {
      throw new Error(`Aggregate coverage rejected: invalid binding review outcome for ${pairId}`);
    }
    const proposedRole = String(row.proposedRole ?? '');
    if (!['EXPLAINS', 'PRACTICES', 'ASSESSES', 'REFERENCES'].includes(proposedRole)) {
      throw new Error(`Aggregate coverage rejected: invalid binding proposedRole for ${pairId}`);
    }
    const reviewIdentity = String(row.reviewIdentity ?? '').trim();
    if (!reviewIdentity || /candidate-generator|unreviewed|unbound/iu.test(reviewIdentity)) {
      throw new Error(
        `Aggregate coverage rejected: non-production binding reviewIdentity for ${pairId}`,
      );
    }
    const reviewProvider = String(row.reviewProvider ?? '').trim();
    if (!['GPT', 'FIXTURE', 'HUMAN', 'NONE', 'GROK'].includes(reviewProvider)) {
      throw new Error(
        `Aggregate coverage rejected: binding reviewProvider required/valid for ${pairId}`,
      );
    }
    if (reviewProvider === 'GPT' && /grok/iu.test(reviewIdentity)) {
      throw new Error(
        `Aggregate coverage rejected: reviewProvider=GPT conflicts with Grok identity for ${pairId}`,
      );
    }
    out[pairId] = {
      outcome: outcome as 'ACCEPT' | 'REJECT' | 'DISPUTE' | 'HUMAN_REQUIRED',
      proposedRole: proposedRole as 'EXPLAINS' | 'PRACTICES' | 'ASSESSES' | 'REFERENCES',
      reviewIdentity,
      reviewerPromptVersion: String(row.reviewerPromptVersion ?? '').trim() || 'aggregate-binding-review/v1',
      evidenceDigest: String(row.evidenceDigest ?? '').trim(),
      evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds.map(String) : undefined,
      rationale: String(row.rationale ?? '').trim(),
      reviewProvider: reviewProvider as 'GPT' | 'FIXTURE' | 'HUMAN' | 'NONE' | 'GROK',
    };
    if (!out[pairId]!.evidenceDigest || !/^[a-f0-9]{64}$/u.test(out[pairId]!.evidenceDigest)) {
      throw new Error(`Aggregate coverage rejected: binding review evidenceDigest invalid for ${pairId}`);
    }
    if (!out[pairId]!.rationale) {
      throw new Error(`Aggregate coverage rejected: binding review rationale required for ${pairId}`);
    }
  }
  return out;
}

export async function loadActCurriculumEvidence(root: string): Promise<ActCurriculumEvidence> {
  const formalObjectiveIds: string[] = [];
  try {
    const v1 = JSON.parse(
      await readFile(
        path.join(root, 'course-content/authoring/knowledge/course-coverage/active/automatic-control.json'),
        'utf8',
      ),
    ) as { entries?: Array<{ canonicalId: string; role: string }> };
    for (const entry of v1.entries ?? []) {
      if (entry.role === 'formal_objective') formalObjectiveIds.push(entry.canonicalId);
    }
  } catch {
    // optional
  }

  const curriculumNodeNames: string[] = [];
  try {
    const nodesDoc = JSON.parse(
      await readFile(
        path.join(root, 'course-content/authoring/knowledge/canonical-nodes.json'),
        'utf8',
      ),
    ) as { nodes?: Array<{ canonical_name?: string; aliases?: string[] }> };
    for (const node of nodesDoc.nodes ?? []) {
      if (node.canonical_name) curriculumNodeNames.push(node.canonical_name);
      for (const alias of node.aliases ?? []) curriculumNodeNames.push(alias);
    }
  } catch {
    // optional
  }

  const curriculumTopicTerms = [
    '根轨迹', '劳斯', '奈奎斯特', '伯德', 'bode', 'nyquist',
    '稳定性', '传递函数', '反馈', 'pid', '频域', '时域',
    '状态空间', '开环', '闭环', '相位裕度', '幅值裕度',
    '稳态误差', '超调', '阻尼', '自然频率', '极点', '零点',
    '控制系统', '动态系统', '建模', '频率响应', '根轨迹法',
    'root locus', 'transfer function', 'stability', 'feedback',
  ];

  return {
    formalObjectiveIds,
    curriculumTopicTerms,
    curriculumNodeNames,
  };
}

export { buildResourceIndexFromValidatedCrosswalks } from '../../src/lib/aggregate-governance';
