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

/** Unreviewed candidate generator marker — never a production review identity. */
export const AGGREGATE_CANDIDATE_GENERATOR_IDENTITY =
  'candidate-generator:unreviewed-heuristic-v1' as const;

export const AGGREGATE_GOVERNANCE_PROTECTED_PATHS = [
  AGGREGATE_COVERAGE_ACTIVE_PATH,
  AGGREGATE_COVERAGE_SCHEMA_PATH,
  'scripts/course-coverage/aggregate-coverage.ts',
  'scripts/db/run-aggregate-course-resource-governance.ts',
  'src/lib/aggregate-governance',
  'prisma/schema.prisma',
  'prisma/migrations/20260730010000_govern_aggregate_course_coverage_and_resource_bindings/migration.sql',
] as const;

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `Aggregate coverage Git verification failed for ${args.join(' ')}: ${result.stderr || result.stdout}`,
    );
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
