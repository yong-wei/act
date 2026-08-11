/**
 * Current CourseCoverage review-input contract (#1180 / #1265).
 *
 * This module is deliberately separate from review-workflow.ts.  The latter
 * owns the historical v1 worklist and its final-decision assembler; this
 * module freezes a provenance-bound current denominator and the batches that
 * a later B1..Bn review may consume.
 *
 * #1265: the ACT teaching denominator is the explicitly selected ACT resource /
 * core-node scope and MAY be empty. Full Release membership and historical
 * DEFER rows are not Authority gates. Use `selectActTeachingScopeMembership`
 * / `buildActTeachingScopeWorklistItems` for new teaching selectors; the
 * historical `buildCurrentCourseCoverageWorklist` remains for frozen batch
 * tooling and audit reproducibility.
 */
import { sha256Canonical, stableStringify } from './hash';
import {
  selectActTeachingScopeMembership,
  selectCanonicalObjectMembership,
} from './membership';

export const CURRENT_COURSE_COVERAGE_REVIEW_SCHEMA_VERSION =
  'current-course-coverage-review/v2' as const;
export const CURRENT_COURSE_COVERAGE_WORKLIST_SCHEMA_VERSION =
  'course-coverage-worklist/v2' as const;
export const CURRENT_COURSE_COVERAGE_BATCH_MANIFEST_SCHEMA_VERSION =
  'course-coverage-review-batch-manifest/v1' as const;
export const CURRENT_COURSE_COVERAGE_GENERATOR_VERSION =
  'current-course-coverage-review-generator/v1' as const;
export const CURRENT_COURSE_COVERAGE_POLICY_VERSION =
  'course-coverage-review-policy/v1' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

export type CurrentEvidenceBoundary =
  | 'profile'
  | 'aggregate'
  | 'independent-course';

export type CurrentEvidenceDigestSemantics =
  | 'raw-bytes'
  | 'selector-evidence'
  | 'semantic-payload';

export interface CurrentCourseCoverageEvidenceRef {
  evidenceId: string;
  sourcePath: string;
  selector: string;
  sourceDigest: string;
  boundary: CurrentEvidenceBoundary;
  kind: string;
  digestSemantics: CurrentEvidenceDigestSemantics;
}

export function classifyCurrentCourseEvidenceSource(sourcePath: string): {
  boundary: CurrentEvidenceBoundary;
  kind: string;
  digestSemantics: CurrentEvidenceDigestSemantics;
} | null {
  const isCanonicalMetadata = sourcePath === 'course-content/authoring/knowledge/canonical-nodes.json';
  const isTopicLexicon = sourcePath === 'topic-lexicon';
  const isCourseAuthoring = sourcePath.startsWith('course-content/authoring/lessons/');
  const isCourseBlueprint = sourcePath === 'course-content/syllabus-refactor/blueprint.md'
    || sourcePath === 'course-content/syllabus-refactor/main.md';
  if (!isCanonicalMetadata && !isTopicLexicon && !isCourseAuthoring && !isCourseBlueprint) return null;
  return {
    boundary: isCourseAuthoring || isCourseBlueprint ? 'independent-course' : 'aggregate',
    kind: isCanonicalMetadata
      ? 'canonical-metadata-provenance'
      : isTopicLexicon
        ? 'topic-lexicon-provenance'
        : 'course-authoring-evidence',
    digestSemantics: isTopicLexicon ? 'selector-evidence' : 'raw-bytes',
  };
}

/** Provenance only.  Do not add role, verdict, approval, or outcome fields. */
export interface CurrentPriorDecisionRef {
  sourcePath: string;
  selector: string;
  artifactDigest: string;
  releaseId: string | null;
  worklistDigest: string | null;
  authoringRevision: string | null;
}

export interface CurrentProjectionNodeLike {
  entity_id?: string;
  entityId?: string;
  entity_type?: string | null;
  entityType?: string | null;
  semantic_name?: string | null;
  semanticName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  description?: string | null;
  concept_kind?: string | null;
  conceptKind?: string | null;
  release_tier?: string | null;
  releaseTier?: string | null;
  publication_status?: string | null;
  publicationStatus?: string | null;
  review_status?: string | null;
  reviewStatus?: string | null;
  source_coverage_count?: number | null;
  sourceCoverageCount?: number | null;
  evidence_refs?: string[] | null;
  evidenceRefs?: string[] | null;
  [key: string]: unknown;
}

export interface CurrentReleaseEntryLike {
  entity?: string;
  entityId?: string;
  entity_role?: string | null;
  entityRole?: string | null;
  release_tier?: string | null;
  releaseTier?: string | null;
}

export interface CurrentRelationLike {
  id?: string;
  relation_id?: string;
  relationId?: string;
  source_id?: string;
  sourceId?: string;
  target_id?: string;
  targetId?: string;
  relation_type?: string | null;
  relationType?: string | null;
  relation_family?: string | null;
  relationFamily?: string | null;
  direction?: string | null;
  evidence_state?: string | null;
  evidenceState?: string | null;
  [key: string]: unknown;
}

export interface CurrentRiskFlags {
  profileOnly: boolean;
  new: boolean;
  changed: boolean;
  highRisk: boolean;
  reasons: string[];
}

export interface CurrentCourseCoverageWorklistItem {
  canonicalId: string;
  /** Digest of the object's semantic payload, not a release/row timestamp. */
  canonicalRevision: string;
  entityType: string | null;
  preferredLabel: string;
  descriptionDigest: string;
  sourceCoverage: {
    count: number;
    releaseTier: string | null;
    upstreamEvidenceCount: number;
  };
  moduleMembership: string[];
  relationNeighborhoodDigest: string;
  priorDecisionRefs: CurrentPriorDecisionRef[];
  profileOnly: boolean;
  evidenceRefs: CurrentCourseCoverageEvidenceRef[];
  evidenceDigest: string;
  riskFlags: CurrentRiskFlags;
  releaseId: string;
  deltaReceiptId: string;
  authoringRevision: string;
  worklistInputDigest: string;
}

export interface CurrentCourseCoverageAuthority {
  releaseSetId: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  projectionId: string;
  projectionDigest: string;
  bindingPath: string;
  bindingDigest: string;
  resolutionDigest: string;
  admissionReceiptPath: string;
  admissionReceiptDigest: string;
  chainReceiptPath: string;
  chainReceiptDigest: string;
  captureRevision: string;
  terminalDeltaReceiptId: string;
  terminalDeltaInputDigest: string;
  terminalDeltaOutputDigest: string;
  terminalDeltaCaptureRevision: string;
  terminalDeltaClassification: string;
  terminalDeltaAcceptedAt: string;
  predecessor: {
    releaseId: string;
    releaseVersion: string;
    bundleId: string;
    projectionId: string;
    projectionDigest: string;
    membershipCount: number;
  };
}

export interface CurrentCourseCoverageWorklist {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_WORKLIST_SCHEMA_VERSION;
  generatorVersion: typeof CURRENT_COURSE_COVERAGE_GENERATOR_VERSION;
  courseId: string;
  authority: CurrentCourseCoverageAuthority;
  authoringRevision: string;
  membership: {
    source: 'projection-nodes-eq-knowledge-object-entries';
    N_current: number;
    canonicalIdsDigest: string;
  };
  items: CurrentCourseCoverageWorklistItem[];
  worklistInputDigest: string;
  worklistDigest: string;
}

export interface CurrentReviewBatchMember {
  canonicalId: string;
  canonicalRevision: string;
  profileOnly: boolean;
  riskFlags: CurrentRiskFlags;
}

export interface CurrentReviewPolicy {
  version: typeof CURRENT_COURSE_COVERAGE_POLICY_VERSION;
  primaryRequired: true;
  challengerRequiredWhen: Array<'profile-only' | 'new' | 'changed' | 'high-risk'>;
  conditionalPrimaryAdmissionRequiresChallenger: true;
  runtimeRule: 'B1..Bn';
  roleAssignment: 'deferred-to-batch-runtime';
}

export interface CurrentReviewBatch {
  batchId: string;
  semanticGroupKey: string;
  sequence: number;
  worklistInputDigest: string;
  worklistDigest: string;
  memberDigest: string;
  members: CurrentReviewBatchMember[];
  policy: CurrentReviewPolicy;
  counts: {
    members: number;
    profileOnly: number;
    new: number;
    changed: number;
    highRisk: number;
    evidenceRefs: number;
    sourceCoverage: number;
    entityTypes: Record<string, number>;
    modules: Record<string, number>;
  };
}

export interface CurrentReviewBatchManifest {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_BATCH_MANIFEST_SCHEMA_VERSION;
  generatorVersion: typeof CURRENT_COURSE_COVERAGE_GENERATOR_VERSION;
  policy: CurrentReviewPolicy;
  worklistInputDigest: string;
  worklistDigest: string;
  N_current: number;
  batches: CurrentReviewBatch[];
  closure: {
    disjoint: true;
    unionEqualsCurrent: true;
    memberCount: number;
    batchCount: number;
    unionDigest: string;
  };
  manifestDigest: string;
}

export interface CurrentReviewInputIdentity {
  bindingResolutionDigest: string;
  aggregateBundleDigest: string;
  terminalDeltaReceiptId: string;
  terminalDeltaInputDigest: string;
  terminalDeltaOutputDigest: string;
  terminalDeltaCaptureRevision: string;
  authoringRevision: string;
  captureRevision: string;
  worklistInputDigest?: string;
}

export interface CurrentReviewReleasePaths {
  currentReleaseVersion: string;
  currentReleaseRoot: string;
  currentProjectionPath: string;
  currentReleasePath: string;
  currentDiffPath: string;
  predecessorReleaseVersion: string;
  predecessorReleaseRoot: string;
  predecessorProjectionPath: string;
  predecessorReleasePath: string;
}

export interface CurrentReviewBoundaryEvidence {
  authoringRevision: string;
  authoringInputPaths: string[];
  authoringInputDigest: string;
  currentCoverageArtifactPath: string;
  currentCoverageArtifactDigest: string;
  allowedWriteSet: string[];
  allowedWriteSetDigest: string;
  forbiddenAuthorityPaths: string[];
  forbiddenAuthorityPathsDigest: string;
  outsideAllowedWriteSetDigest: string;
  forbiddenAuthorityStatusDigest: string;
  selectorSnapshotDigest: string;
  selectorWorkingTreeDigest: string;
  gitDiffCheck: 'PASS';
  verificationProtocol: 'pre-publication-snapshot-and-post-publication-reread';
}

function requiredString(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`Current review rejected: ${field} is required`);
  return normalized;
}

function safeReleaseVersion(value: unknown, field: string): string {
  const version = requiredString(value, field);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(version) || version.includes('..')) {
    throw new Error(`Current review rejected: ${field} is not a safe release version`);
  }
  return version;
}

function projectionFileName(projectionId: string, field: string): string {
  const match = projectionId.match(/:([A-Za-z0-9][A-Za-z0-9-]*)-v\d+$/u);
  if (!match?.[1]) throw new Error(`Current review rejected: ${field} has no safe projection profile`);
  return `${match[1]}-projection.json`;
}

function assertReleaseIdentity(
  releaseId: string,
  releaseVersion: string,
  bundleId: string,
  field: string,
): void {
  if (!releaseId.endsWith(`:${releaseVersion}`)) {
    throw new Error(`Current review rejected: ${field}.releaseId does not match releaseVersion`);
  }
  const bundlePrefix = `ctb:${releaseVersion}:r`;
  if (!bundleId.startsWith(bundlePrefix) || !/^\d+$/u.test(bundleId.slice(bundlePrefix.length))) {
    throw new Error(`Current review rejected: ${field}.bundleId does not match releaseVersion`);
  }
}

/**
 * Derive release paths only after the immutable binding and terminal Delta
 * agree on the identities.  Release versions are data, never a hard-coded
 * v0.8/v0.9 path in the generator.
 */
export function deriveCurrentReviewReleasePaths(input: {
  admissionRoot: string;
  binding: Record<string, unknown>;
  terminal: Record<string, any>;
}): CurrentReviewReleasePaths {
  const candidate = input.terminal.candidate as Record<string, unknown> | undefined;
  const base = input.terminal.base as Record<string, unknown> | undefined;
  if (!candidate || !base) throw new Error('Current review rejected: terminal Delta identities are incomplete');
  const currentReleaseVersion = safeReleaseVersion(candidate.releaseVersion, 'terminal.candidate.releaseVersion');
  const currentReleaseId = requiredString(candidate.releaseId, 'terminal.candidate.releaseId');
  const currentBundleId = requiredString(candidate.bundleId, 'terminal.candidate.bundleId');
  const predecessorReleaseVersion = safeReleaseVersion(base.releaseVersion, 'terminal.base.releaseVersion');
  const predecessorReleaseId = requiredString(base.releaseId, 'terminal.base.releaseId');
  const predecessorBundleId = requiredString(base.bundleId, 'terminal.base.bundleId');
  const bindingReleaseVersion = safeReleaseVersion(input.binding.releaseVersion, 'binding.releaseVersion');
  const bindingReleaseId = requiredString(input.binding.releaseId, 'binding.releaseId');
  const bindingBundleId = requiredString(input.binding.bundleId, 'binding.bundleId');
  const bindingBundleDigest = requiredString(input.binding.bundleDigest, 'binding.bundleDigest');
  const candidateBundleDigest = requiredString(candidate.bundleDigest, 'terminal.candidate.bundleDigest');
  if (bindingReleaseVersion !== currentReleaseVersion || bindingReleaseId !== currentReleaseId
    || bindingBundleId !== currentBundleId || bindingBundleDigest !== candidateBundleDigest) {
    throw new Error('Current review rejected: binding and terminal Delta current identity mismatch');
  }
  if (requiredString(input.binding.predecessorBundleId, 'binding.predecessorBundleId') !== predecessorBundleId) {
    throw new Error('Current review rejected: binding and terminal Delta predecessor bundle mismatch');
  }
  assertReleaseIdentity(currentReleaseId, currentReleaseVersion, currentBundleId, 'terminal.candidate');
  assertReleaseIdentity(predecessorReleaseId, predecessorReleaseVersion, predecessorBundleId, 'terminal.base');
  const currentProjectionId = requiredString(candidate.runtimeProjectionId, 'terminal.candidate.runtimeProjectionId');
  const predecessorProjectionId = requiredString(base.runtimeProjectionId, 'terminal.base.runtimeProjectionId');
  const currentRoot = `${input.admissionRoot}/chain/releases/${currentReleaseVersion}`;
  const predecessorRoot = `${input.admissionRoot}/chain/releases/${predecessorReleaseVersion}`;
  return {
    currentReleaseVersion,
    currentReleaseRoot: currentRoot,
    currentProjectionPath: `${currentRoot}/${projectionFileName(currentProjectionId, 'terminal.candidate.runtimeProjectionId')}`,
    currentReleasePath: `${currentRoot}/release.json`,
    currentDiffPath: `${currentRoot}/release-diff.json`,
    predecessorReleaseVersion,
    predecessorReleaseRoot: predecessorRoot,
    predecessorProjectionPath: `${predecessorRoot}/${projectionFileName(predecessorProjectionId, 'terminal.base.runtimeProjectionId')}`,
    predecessorReleasePath: `${predecessorRoot}/release.json`,
  };
}

export function currentReviewInputFingerprint(digests: Record<string, string>): string {
  return sha256Canonical(Object.fromEntries(
    Object.entries(digests).sort(([a], [b]) => a.localeCompare(b, 'en')),
  ));
}

export function assertCurrentDeltaReceiptIdentity(
  admitted: readonly unknown[],
  staged: readonly unknown[],
): void {
  if (admitted.length !== staged.length) {
    throw new Error('Current review rejected: admission and staged Delta receipt counts disagree');
  }
  for (const [index, row] of staged.entries()) {
    if (stableStringify(admitted[index]) !== stableStringify(row)) {
      throw new Error(`Current review rejected: staged Delta ${index + 1} identity differs from admission receipt`);
    }
  }
}

export function assertCurrentReviewProtectedPathsClean(status: string): void {
  if (status.trim()) {
    throw new Error('Current review rejected: protected selector/writer paths are already modified');
  }
}

export function canonicalNodeId(node: CurrentProjectionNodeLike): string {
  return String(node.entity_id ?? node.entityId ?? '').trim();
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en'));
}

function assertSha(value: string, field: string): void {
  if (!SHA256.test(value)) throw new Error(`${field} must be a 64-hex SHA-256`);
}

function assertCommit(value: string, field: string): void {
  if (!COMMIT.test(value)) throw new Error(`${field} must be a 40-hex Git revision`);
}

/**
 * The canonical revision intentionally excludes wrapper timestamps and
 * relation/evidence rows.  It is a digest over the object's deterministic
 * semantic payload, so an identical object regenerates the same revision.
 */
export function canonicalRevisionForNode(
  node: CurrentProjectionNodeLike,
  canonicalId = canonicalNodeId(node),
): string {
  return sha256Canonical({
    canonicalId,
    entityType: stringOrNull(node.entity_type ?? node.entityType),
    semanticName: stringOrNull(node.semantic_name ?? node.semanticName),
    displayName: stringOrNull(node.display_name ?? node.displayName),
    description: stringOrNull(node.description),
    conceptKind: stringOrNull(node.concept_kind ?? node.conceptKind),
    releaseTier: stringOrNull(node.release_tier ?? node.releaseTier),
    publicationStatus: stringOrNull(node.publication_status ?? node.publicationStatus),
    reviewStatus: stringOrNull(node.review_status ?? node.reviewStatus),
    sourceCoverageCount: Number(node.source_coverage_count ?? node.sourceCoverageCount ?? 0),
  });
}

export function descriptionDigest(description: string | null | undefined): string {
  return sha256Canonical(description == null ? '' : String(description));
}

export function relationNeighborhoodDigest(
  canonicalId: string,
  relations: readonly CurrentRelationLike[],
): string {
  const neighborhood = relations
    .filter((relation) => (
      String(relation.source_id ?? relation.sourceId ?? '') === canonicalId
      || String(relation.target_id ?? relation.targetId ?? '') === canonicalId
    ))
    .map((relation) => ({
      id: stringOrNull(relation.id ?? relation.relation_id ?? relation.relationId),
      sourceId: stringOrNull(relation.source_id ?? relation.sourceId),
      targetId: stringOrNull(relation.target_id ?? relation.targetId),
      relationType: stringOrNull(relation.relation_type ?? relation.relationType),
      relationFamily: stringOrNull(relation.relation_family ?? relation.relationFamily),
      direction: stringOrNull(relation.direction),
      evidenceState: stringOrNull(relation.evidence_state ?? relation.evidenceState),
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), 'en'));
  return sha256Canonical(neighborhood);
}

function assertNoDuplicateIds(ids: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) throw new Error(`${field} contains an empty Canonical ID`);
    if (seen.has(id)) throw new Error(`${field} contains duplicate Canonical ID ${id}`);
    seen.add(id);
  }
}

function normalizeEvidenceRefs(
  refs: readonly CurrentCourseCoverageEvidenceRef[],
): CurrentCourseCoverageEvidenceRef[] {
  const byId = new Map<string, CurrentCourseCoverageEvidenceRef>();
  for (const ref of refs) {
    if (!ref.evidenceId || !ref.sourcePath || !ref.selector || !ref.sourceDigest) continue;
    byId.set(ref.evidenceId, { ...ref });
  }
  return [...byId.values()].sort((a, b) => (
    a.boundary.localeCompare(b.boundary, 'en')
    || a.sourcePath.localeCompare(b.sourcePath, 'en')
    || a.selector.localeCompare(b.selector, 'en')
    || a.evidenceId.localeCompare(b.evidenceId, 'en')
  ));
}

function priorRefsFor(
  refs: readonly CurrentPriorDecisionRef[] | undefined,
): CurrentPriorDecisionRef[] {
  return [...(refs ?? [])]
    .map((ref) => ({
      sourcePath: String(ref.sourcePath),
      selector: String(ref.selector),
      artifactDigest: String(ref.artifactDigest),
      releaseId: ref.releaseId == null ? null : String(ref.releaseId),
      worklistDigest: ref.worklistDigest == null ? null : String(ref.worklistDigest),
      authoringRevision: ref.authoringRevision == null ? null : String(ref.authoringRevision),
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), 'en'));
}

const REVIEW_POLICY: CurrentReviewPolicy = {
  version: CURRENT_COURSE_COVERAGE_POLICY_VERSION,
  primaryRequired: true,
  challengerRequiredWhen: ['profile-only', 'new', 'changed', 'high-risk'],
  conditionalPrimaryAdmissionRequiresChallenger: true,
  runtimeRule: 'B1..Bn',
  roleAssignment: 'deferred-to-batch-runtime',
};

function semanticGroupKey(item: CurrentCourseCoverageWorklistItem): string {
  const modules = item.moduleMembership.length > 0
    ? item.moduleMembership.join('|')
    : 'module:unassigned';
  return `${modules}::entityType:${item.entityType ?? 'unknown'}`;
}

function hasChallengerRisk(flags: CurrentRiskFlags): boolean {
  return flags.profileOnly || flags.new || flags.changed || flags.highRisk;
}

function itemCore(item: CurrentCourseCoverageWorklistItem): Record<string, unknown> {
  const { worklistInputDigest: _ignored, ...core } = item;
  return core;
}

export function computeCurrentWorklistInputDigest(
  doc: Omit<CurrentCourseCoverageWorklist, 'worklistInputDigest' | 'worklistDigest'>,
): string {
  return sha256Canonical({
    schemaVersion: doc.schemaVersion,
    generatorVersion: doc.generatorVersion,
    courseId: doc.courseId,
    authority: doc.authority,
    authoringRevision: doc.authoringRevision,
    membership: doc.membership,
    items: doc.items.map(itemCore),
  });
}

export function computeCurrentWorklistDigest(
  doc: Omit<CurrentCourseCoverageWorklist, 'worklistDigest'>,
): string {
  return sha256Canonical(doc);
}

export function assertNoCurrentCoverageDecisions(value: unknown, context: string): void {
  const forbidden = /^(role|verdict|approval|outcome|proposedRole|suggestedRoles|finalDecision)$/u;
  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((row, index) => visit(row, `${path}[${index}]`));
      return;
    }
    if (!current || typeof current !== 'object') return;
    for (const [key, nested] of Object.entries(current)) {
      if (forbidden.test(key)) {
        throw new Error(`Current CourseCoverage review rejected: ${context} contains decision field ${path}.${key}`);
      }
      visit(nested, `${path}.${key}`);
    }
  };
  visit(value, '$');
}

export function buildCurrentCourseCoverageWorklist(input: {
  courseId: string;
  authority: CurrentCourseCoverageAuthority;
  authoringRevision: string;
  projectionNodes: readonly CurrentProjectionNodeLike[];
  releaseEntries: readonly CurrentReleaseEntryLike[];
  relations?: readonly CurrentRelationLike[];
  predecessorProjectionNodes?: readonly CurrentProjectionNodeLike[];
  predecessorRelations?: readonly CurrentRelationLike[];
  moduleMembership?: ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;
  priorDecisionRefs?: ReadonlyMap<string, readonly CurrentPriorDecisionRef[]> | Record<string, readonly CurrentPriorDecisionRef[]>;
  independentEvidence?: ReadonlyMap<string, readonly CurrentCourseCoverageEvidenceRef[]> | Record<string, readonly CurrentCourseCoverageEvidenceRef[]>;
  deltaSignals?: { addedIds?: readonly string[]; changedIds?: readonly string[] };
}): CurrentCourseCoverageWorklist {
  assertCommit(input.authoringRevision, 'authoringRevision');
  if (!input.courseId.trim()) throw new Error('courseId is required');
  const projectionIds = input.projectionNodes.map(canonicalNodeId);
  const entryIds = input.releaseEntries
    .filter((row) => String(row.entity_role ?? row.entityRole ?? '') === 'knowledge_object')
    .map((row) => String(row.entity ?? row.entityId ?? '').trim());
  assertNoDuplicateIds(projectionIds, 'Projection membership');
  assertNoDuplicateIds(entryIds, 'knowledge_object membership');
  const membership = selectCanonicalObjectMembership({
    projectionNodes: projectionIds.map((entityId) => ({ entityId })),
    releaseEntries: input.releaseEntries.map((row) => ({
      entityId: String(row.entity ?? row.entityId ?? '').trim(),
      entityRole: row.entity_role ?? row.entityRole ?? null,
    })),
  });
  const byId = new Map(input.projectionNodes.map((node) => [canonicalNodeId(node), node]));
  const predecessorById = new Map(
    (input.predecessorProjectionNodes ?? []).map((node) => [canonicalNodeId(node), node]),
  );
  const relationRows = input.relations ?? [];
  const previousRelations = input.predecessorRelations ?? [];
  const added = new Set(input.deltaSignals?.addedIds ?? []);
  const changedSignals = new Set(input.deltaSignals?.changedIds ?? []);
  const lookupValues = <T>(
    source: ReadonlyMap<string, readonly T[]> | Record<string, readonly T[]> | undefined,
    id: string,
  ): readonly T[] => {
    if (source instanceof Map) return source.get(id) ?? [];
    return (source as Record<string, readonly T[]> | undefined)?.[id] ?? [];
  };
  const moduleLookup = (id: string): readonly string[] => lookupValues(input.moduleMembership, id);
  const priorLookup = (id: string): readonly CurrentPriorDecisionRef[] => lookupValues(input.priorDecisionRefs, id);
  const evidenceLookup = (id: string): readonly CurrentCourseCoverageEvidenceRef[] => lookupValues(input.independentEvidence, id);
  const rows = membership.canonicalIds.map((canonicalId) => {
    const node = byId.get(canonicalId);
    if (!node) throw new Error(`Projection membership missing node ${canonicalId}`);
    const revision = canonicalRevisionForNode(node, canonicalId);
    const previous = predecessorById.get(canonicalId);
    const previousRevision = previous ? canonicalRevisionForNode(previous, canonicalId) : null;
    const relationDigest = relationNeighborhoodDigest(canonicalId, relationRows);
    const previousRelationDigest = previous
      ? relationNeighborhoodDigest(canonicalId, previousRelations)
      : null;
    const isNew = !previous;
    const isChanged = Boolean(
      (previous && previousRevision !== revision)
      || changedSignals.has(canonicalId),
    );
    const relationChanged = Boolean(previous && previousRelationDigest !== relationDigest);
    const entityType = stringOrNull(node.entity_type ?? node.entityType);
    const description = stringOrNull(node.description);
    const sourceCount = Number(node.source_coverage_count ?? node.sourceCoverageCount ?? 0);
    const courseEvidence = normalizeEvidenceRefs(evidenceLookup(canonicalId));
    const profileEvidence: CurrentCourseCoverageEvidenceRef = {
      evidenceId: sha256Canonical({ canonicalId, revision, boundary: 'profile' }).slice(0, 32),
      sourcePath: 'aggregate-projection',
      selector: `canonicalId:${canonicalId}`,
      sourceDigest: revision,
      boundary: 'profile',
      kind: 'canonical-profile',
      digestSemantics: 'semantic-payload',
    };
    const aggregateEvidence = sortedUnique(
      (node.evidence_refs ?? node.evidenceRefs ?? []).map(String),
    ).map((evidenceId): CurrentCourseCoverageEvidenceRef => ({
      evidenceId: sha256Canonical({ canonicalId, evidenceId, boundary: 'aggregate' }).slice(0, 32),
      sourcePath: 'aggregate-projection',
      selector: `evidence:${evidenceId}`,
      sourceDigest: sha256Canonical(evidenceId),
      boundary: 'aggregate',
      kind: 'aggregate-evidence',
      digestSemantics: 'selector-evidence',
    }));
    const evidenceRefs = normalizeEvidenceRefs([
      profileEvidence,
      ...aggregateEvidence,
      ...courseEvidence,
    ]);
    const profileOnly = !evidenceRefs.some((ref) => ref.boundary === 'independent-course');
    const highRisk = profileOnly || relationChanged || !entityType || sourceCount <= 0
      || stringOrNull(node.review_status ?? node.reviewStatus) !== 'approved';
    const reasons = sortedUnique([
      ...(profileOnly ? ['profile-only'] : []),
      ...(isNew || added.has(canonicalId) ? ['new'] : []),
      ...(isChanged ? ['changed'] : []),
      ...(relationChanged ? ['relation-neighborhood-changed'] : []),
      ...(highRisk ? ['high-risk'] : []),
    ]);
    const riskFlags: CurrentRiskFlags = {
      profileOnly,
      new: isNew || added.has(canonicalId),
      changed: isChanged,
      highRisk,
      reasons,
    };
    return {
      canonicalId,
      canonicalRevision: revision,
      entityType,
      preferredLabel: stringOrNull(
        node.preferredLabel ?? node.preferred_label ?? node.display_name ?? node.displayName
          ?? node.semantic_name ?? node.semanticName,
      ) ?? canonicalId,
      descriptionDigest: descriptionDigest(description),
      sourceCoverage: {
        count: Number.isFinite(sourceCount) && sourceCount >= 0 ? sourceCount : 0,
        releaseTier: stringOrNull(node.release_tier ?? node.releaseTier),
        upstreamEvidenceCount: (node.evidence_refs ?? node.evidenceRefs ?? []).length,
      },
      moduleMembership: sortedUnique(moduleLookup(canonicalId)),
      relationNeighborhoodDigest: relationDigest,
      priorDecisionRefs: priorRefsFor(priorLookup(canonicalId)),
      profileOnly,
      evidenceRefs,
      evidenceDigest: sha256Canonical(evidenceRefs),
      riskFlags,
      releaseId: input.authority.releaseId,
      deltaReceiptId: input.authority.terminalDeltaReceiptId,
      authoringRevision: input.authoringRevision,
      worklistInputDigest: '',
    } satisfies CurrentCourseCoverageWorklistItem;
  });
  const base: Omit<CurrentCourseCoverageWorklist, 'worklistInputDigest' | 'worklistDigest'> = {
    schemaVersion: CURRENT_COURSE_COVERAGE_WORKLIST_SCHEMA_VERSION,
    generatorVersion: CURRENT_COURSE_COVERAGE_GENERATOR_VERSION,
    courseId: input.courseId,
    authority: input.authority,
    authoringRevision: input.authoringRevision,
    membership: {
      source: membership.source,
      N_current: membership.canonicalIds.length,
      canonicalIdsDigest: sha256Canonical(membership.canonicalIds),
    },
    items: rows,
  };
  const worklistInputDigest = computeCurrentWorklistInputDigest(base);
  const finalizedItems = rows.map((item) => ({ ...item, worklistInputDigest }));
  const withoutWorklistDigest: Omit<CurrentCourseCoverageWorklist, 'worklistDigest'> = {
    ...base,
    items: finalizedItems,
    worklistInputDigest,
  };
  const worklistDigest = computeCurrentWorklistDigest(withoutWorklistDigest);
  const result = { ...withoutWorklistDigest, worklistDigest };
  assertNoCurrentCoverageDecisions(result, 'current worklist');
  return result;
}

/**
 * ACT teaching-scope worklist denominator (#1265).
 *
 * Enumerates only explicitly selected ACT-bound resources/core nodes. Empty
 * scope is valid (Teaching Projection NOT_PROJECTED) and does not invalidate
 * the upstream engineering Release. Unprojected upstream IDs are reported but
 * never enter the denominator. Prior decision refs remain provenance-only.
 */
export function buildActTeachingScopeWorklistItems(input: {
  actBoundCanonicalIds: readonly string[];
  upstreamCanonicalIds?: readonly string[];
  priorDecisionRefs?: ReadonlyMap<string, readonly CurrentPriorDecisionRef[]>
    | Record<string, readonly CurrentPriorDecisionRef[]>;
}): {
  membership: ReturnType<typeof selectActTeachingScopeMembership>;
  items: Array<{
    canonicalId: string;
    priorDecisionRefs: CurrentPriorDecisionRef[];
    inActDenominator: true;
  }>;
  teachingProjection: 'NOT_PROJECTED' | 'REVIEW_REQUIRED';
  blocksEngineeringAuthority: false;
} {
  const membership = selectActTeachingScopeMembership({
    actBoundCanonicalIds: input.actBoundCanonicalIds,
    upstreamCanonicalIds: input.upstreamCanonicalIds,
  });
  const lookupPrior = (id: string): readonly CurrentPriorDecisionRef[] => {
    if (!input.priorDecisionRefs) return [];
    if (input.priorDecisionRefs instanceof Map) {
      return input.priorDecisionRefs.get(id) ?? [];
    }
    return (input.priorDecisionRefs as Record<string, readonly CurrentPriorDecisionRef[]>)[id] ?? [];
  };
  // Fail closed on duplicate ACT-bound identities within the selected scope.
  const seen = new Set<string>();
  for (const id of membership.canonicalIds) {
    if (seen.has(id)) {
      throw new Error(
        `ACT teaching worklist rejected: duplicate ACT-bound identity ${id}`,
      );
    }
    seen.add(id);
  }
  const items = membership.canonicalIds.map((canonicalId) => ({
    canonicalId,
    priorDecisionRefs: priorRefsFor(lookupPrior(canonicalId)),
    inActDenominator: true as const,
  }));
  assertNoCurrentCoverageDecisions({ items }, 'act teaching worklist');
  return {
    membership,
    items,
    teachingProjection: membership.empty ? 'NOT_PROJECTED' : 'REVIEW_REQUIRED',
    blocksEngineeringAuthority: false,
  };
}

export function currentReviewPolicy(): CurrentReviewPolicy {
  return { ...REVIEW_POLICY, challengerRequiredWhen: [...REVIEW_POLICY.challengerRequiredWhen] };
}

function memberDigest(members: readonly CurrentReviewBatchMember[]): string {
  return sha256Canonical(members.map((member) => ({
    canonicalId: member.canonicalId,
    canonicalRevision: member.canonicalRevision,
  })));
}

function batchIdFor(input: {
  worklistDigest: string;
  semanticGroupKey: string;
  sequence: number;
  members: readonly CurrentReviewBatchMember[];
  policy: CurrentReviewPolicy;
}): string {
  return sha256Canonical({
    worklistDigest: input.worklistDigest,
    semanticGroupKey: input.semanticGroupKey,
    sequence: input.sequence,
    memberDigest: memberDigest(input.members),
    members: input.members.map((member) => [member.canonicalId, member.canonicalRevision]),
    policy: input.policy,
  }).slice(0, 24);
}

function countsFor(
  members: readonly CurrentReviewBatchMember[],
  byId: ReadonlyMap<string, CurrentCourseCoverageWorklistItem>,
): CurrentReviewBatch['counts'] {
  const entityTypes: Record<string, number> = {};
  const modules: Record<string, number> = {};
  let evidenceRefs = 0;
  let sourceCoverage = 0;
  for (const member of members) {
    const item = byId.get(member.canonicalId)!;
    const entityType = item.entityType ?? 'unknown';
    entityTypes[entityType] = (entityTypes[entityType] ?? 0) + 1;
    for (const moduleName of item.moduleMembership.length > 0 ? item.moduleMembership : ['module:unassigned']) {
      modules[moduleName] = (modules[moduleName] ?? 0) + 1;
    }
    evidenceRefs += item.evidenceRefs.length;
    sourceCoverage += item.sourceCoverage.count;
  }
  return {
    members: members.length,
    profileOnly: members.filter((member) => member.profileOnly).length,
    new: members.filter((member) => member.riskFlags.new).length,
    changed: members.filter((member) => member.riskFlags.changed).length,
    highRisk: members.filter((member) => member.riskFlags.highRisk).length,
    evidenceRefs,
    sourceCoverage,
    entityTypes: Object.fromEntries(Object.entries(entityTypes).sort(([a], [b]) => a.localeCompare(b, 'en'))),
    modules: Object.fromEntries(Object.entries(modules).sort(([a], [b]) => a.localeCompare(b, 'en'))),
  };
}

export function assertBatchManifestClosure(
  worklist: CurrentCourseCoverageWorklist,
  manifest: CurrentReviewBatchManifest,
): void {
  const { manifestDigest: _storedManifestDigest, ...withoutManifestDigest } = manifest;
  if (sha256Canonical(withoutManifestDigest) !== manifest.manifestDigest) {
    throw new Error('Current batch closure rejected: manifest digest mismatch');
  }
  const byId = new Map(worklist.items.map((item) => [item.canonicalId, item]));
  if (byId.size !== worklist.items.length) throw new Error('Current batch closure rejected: duplicate worklist IDs');
  if (manifest.N_current !== worklist.membership.N_current) throw new Error('Current batch closure rejected: N_current drift');
  if (manifest.worklistInputDigest !== worklist.worklistInputDigest) throw new Error('Current batch closure rejected: worklist input drift');
  if (manifest.worklistDigest !== worklist.worklistDigest) throw new Error('Current batch closure rejected: worklist digest drift');
  const seen = new Set<string>();
  for (const batch of manifest.batches) {
    if (batch.worklistInputDigest !== worklist.worklistInputDigest || batch.worklistDigest !== worklist.worklistDigest) {
      throw new Error(`Current batch closure rejected: ${batch.batchId} worklist identity drift`);
    }
    const expectedMemberDigest = memberDigest(batch.members);
    if (batch.memberDigest !== expectedMemberDigest) throw new Error(`Current batch closure rejected: ${batch.batchId} memberDigest mismatch`);
    const expectedBatchId = batchIdFor({
      worklistDigest: worklist.worklistDigest,
      semanticGroupKey: batch.semanticGroupKey,
      sequence: batch.sequence,
      members: batch.members,
      policy: batch.policy,
    });
    if (batch.batchId !== expectedBatchId) throw new Error(`Current batch closure rejected: ${batch.batchId} identity mismatch`);
    for (const member of batch.members) {
      if (seen.has(member.canonicalId)) throw new Error(`Current batch closure rejected: overlapping member ${member.canonicalId}`);
      const item = byId.get(member.canonicalId);
      if (!item) throw new Error(`Current batch closure rejected: unknown member ${member.canonicalId}`);
      if (member.canonicalRevision !== item.canonicalRevision) throw new Error(`Current batch closure rejected: ${member.canonicalId} revision drift`);
      if (hasChallengerRisk(item.riskFlags) && !batch.policy.conditionalPrimaryAdmissionRequiresChallenger) {
        throw new Error(`Current batch closure rejected: challenger policy missing for ${member.canonicalId}`);
      }
      seen.add(member.canonicalId);
    }
  }
  if (seen.size !== byId.size) throw new Error(`Current batch closure rejected: union omits ${byId.size - seen.size} members`);
  if (manifest.closure.disjoint !== true || manifest.closure.unionEqualsCurrent !== true) throw new Error('Current batch closure rejected: closure flags are not PASS');
  const union = [...seen].sort((a, b) => a.localeCompare(b, 'en'));
  if (manifest.closure.memberCount !== union.length) throw new Error('Current batch closure rejected: member count mismatch');
  if (manifest.closure.batchCount !== manifest.batches.length) throw new Error('Current batch closure rejected: batch count mismatch');
  if (manifest.closure.unionDigest !== sha256Canonical(union)) throw new Error('Current batch closure rejected: union digest mismatch');
}

export function buildCurrentReviewBatchManifest(
  worklist: CurrentCourseCoverageWorklist,
  options: { maxMembersPerBatch?: number } = {},
): CurrentReviewBatchManifest {
  const max = options.maxMembersPerBatch ?? 500;
  if (!Number.isInteger(max) || max < 1) throw new Error('maxMembersPerBatch must be a positive integer');
  const { worklistDigest: _storedWorklistDigest, ...withoutWorklistDigest } = worklist;
  if (computeCurrentWorklistDigest(withoutWorklistDigest) !== worklist.worklistDigest) {
    throw new Error('Current batch generation rejected: worklist tamper detected');
  }
  const policy = currentReviewPolicy();
  const byId = new Map(worklist.items.map((item) => [item.canonicalId, item]));
  const groups = new Map<string, CurrentCourseCoverageWorklistItem[]>();
  for (const item of [...worklist.items].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId, 'en'))) {
    const key = semanticGroupKey(item);
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }
  const batches: CurrentReviewBatch[] = [];
  for (const [groupKey, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    for (let offset = 0, sequence = 0; offset < rows.length; offset += max, sequence += 1) {
      const members = rows.slice(offset, offset + max).map((item): CurrentReviewBatchMember => ({
        canonicalId: item.canonicalId,
        canonicalRevision: item.canonicalRevision,
        profileOnly: item.profileOnly,
        riskFlags: { ...item.riskFlags, reasons: [...item.riskFlags.reasons] },
      }));
      batches.push({
        batchId: batchIdFor({ worklistDigest: worklist.worklistDigest, semanticGroupKey: groupKey, sequence, members, policy }),
        semanticGroupKey: groupKey,
        sequence,
        worklistInputDigest: worklist.worklistInputDigest,
        worklistDigest: worklist.worklistDigest,
        memberDigest: memberDigest(members),
        members,
        policy,
        counts: countsFor(members, byId),
      });
    }
  }
  const union = batches.flatMap((batch) => batch.members.map((member) => member.canonicalId)).sort((a, b) => a.localeCompare(b, 'en'));
  const withoutDigest: Omit<CurrentReviewBatchManifest, 'manifestDigest'> = {
    schemaVersion: CURRENT_COURSE_COVERAGE_BATCH_MANIFEST_SCHEMA_VERSION,
    generatorVersion: CURRENT_COURSE_COVERAGE_GENERATOR_VERSION,
    policy,
    worklistInputDigest: worklist.worklistInputDigest,
    worklistDigest: worklist.worklistDigest,
    N_current: worklist.membership.N_current,
    batches,
    closure: {
      disjoint: true,
      unionEqualsCurrent: true,
      memberCount: union.length,
      batchCount: batches.length,
      unionDigest: sha256Canonical(union),
    },
  };
  const manifest = { ...withoutDigest, manifestDigest: sha256Canonical(withoutDigest) };
  assertBatchManifestClosure(worklist, manifest);
  assertNoCurrentCoverageDecisions(manifest, 'batch manifest');
  return manifest;
}

export function compareCurrentReviewInputs(input: {
  expected: CurrentReviewInputIdentity;
  observed: CurrentReviewInputIdentity;
}): { stable: boolean; driftFields: string[] } {
  const fields = [
    'bindingResolutionDigest',
    'aggregateBundleDigest',
    'terminalDeltaReceiptId',
    'terminalDeltaInputDigest',
    'terminalDeltaOutputDigest',
    'terminalDeltaCaptureRevision',
    'authoringRevision',
    'captureRevision',
    'worklistInputDigest',
  ] as const;
  const driftFields = fields.filter((field) => input.expected[field] !== input.observed[field]);
  return { stable: driftFields.length === 0, driftFields };
}

export function assertNoCurrentReviewInputDrift(input: {
  expected: CurrentReviewInputIdentity;
  observed: CurrentReviewInputIdentity;
}): void {
  const result = compareCurrentReviewInputs(input);
  if (!result.stable) throw new Error(`Current CourseCoverage review rejected: input drift (${result.driftFields.join(', ')})`);
}

export function buildCurrentReviewAssemblyReceipt(input: {
  worklist: CurrentCourseCoverageWorklist;
  manifest: CurrentReviewBatchManifest;
  generatedAt: string;
  boundaryEvidence?: CurrentReviewBoundaryEvidence;
}): Record<string, unknown> {
  assertBatchManifestClosure(input.worklist, input.manifest);
  const receipt = {
    schemaVersion: CURRENT_COURSE_COVERAGE_REVIEW_SCHEMA_VERSION,
    protocol: 'current-course-coverage-review-assembly/1',
    status: 'PASS',
    generatedAt: input.generatedAt,
    worklistInputDigest: input.worklist.worklistInputDigest,
    worklistDigest: input.worklist.worklistDigest,
    manifestDigest: input.manifest.manifestDigest,
    N_current: input.worklist.membership.N_current,
    authority: {
      releaseId: input.worklist.authority.releaseId,
      releaseSetId: input.worklist.authority.releaseSetId,
      bundleId: input.worklist.authority.bundleId,
      projectionDigest: input.worklist.authority.projectionDigest,
      terminalDeltaReceiptId: input.worklist.authority.terminalDeltaReceiptId,
      resolutionDigest: input.worklist.authority.resolutionDigest,
      admissionReceiptDigest: input.worklist.authority.admissionReceiptDigest,
      chainReceiptDigest: input.worklist.authority.chainReceiptDigest,
    },
    closure: input.manifest.closure,
    productionBoundaries: {
      currentCoverageDecisionWritten: false,
      productionSelectorChanged: false,
      graphRagSelectorChanged: false,
      writerFenceChanged: false,
      evidence: input.boundaryEvidence ?? null,
    },
  };
  assertNoCurrentCoverageDecisions(receipt, 'assembly receipt');
  return receipt;
}
