/**
 * Complete Teaching Projection rebuild from impact + decisions (#1272).
 *
 * Combines carried-forward, auto-rebased, and authored records into a new
 * full Projection Snapshot. Never patches prior runtime files in place.
 */

import {
  type AuthorityNodeIndexEntry,
  type TeachingBindingAuthoring,
  type TeachingCardAuthoring,
  type TeachingCoreNodeAuthoring,
  type TeachingPrerequisiteAuthoring,
  type TeachingProjectionArtifacts,
  type TeachingProjectionAuthoringInput,
  type TeachingResourceAuthoring,
} from '../../../src/lib/teaching-projection/contracts';
import {
  applyTeachingProjectionGateFindings,
  buildTeachingProjection,
} from '../../../src/lib/teaching-projection/builder';
import type { TeachingProjectionGateFinding } from '../../../src/lib/teaching-projection/contracts';
import { deriveBindingId } from '../../../src/lib/teaching-projection/identity';
import { projectionDigest } from '../../../src/lib/teaching-projection/hash';
import {
  ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION,
  ACT_TEACHING_PROJECTION_REBASE_REPORT_CONTRACT,
  type ActDeltaChangeEvent,
  type ActImpactItem,
  type CarriedForwardDigestEntry,
  type RebaseDecisionRecord,
  type TeachingProjectionRebaseReport,
  type TeachingProjectionRebaseResult,
  TeachingProjectionRebaseError,
} from './contracts';
import {
  applyCanonicalRewrites,
  applyPrerequisiteRewrites,
  resolveRebaseDecisions,
} from './decisions';
import {
  computeActTeachingProjectionImpactSet,
  impactSetFromArtifacts,
} from './impact';
import type {
  StagedTeachingProjectionFiles,
  TeachingProjectionStorePaths,
} from '../../../src/lib/teaching-projection/store';
import {
  loadStagedTeachingProjection,
  readCurrentTeachingProjectionPointer,
  stageTeachingProjectionArtifacts,
} from '../../../src/lib/teaching-projection/store';

export interface RebaseTeachingProjectionInput {
  priorArtifacts: TeachingProjectionArtifacts;
  /**
   * Authoring snapshot that produced the prior projection
   * (or an equivalent reconstruction). Used as the rebuild base.
   */
  priorAuthoring: TeachingProjectionAuthoringInput;
  changes: readonly ActDeltaChangeEvent[];
  targetAuthority: {
    authorityReleaseId: string;
    authorityReleaseSetId?: string | null;
    authoritySnapshotId?: string | null;
    authoritySnapshotHash?: string | null;
    authorityNodes: readonly AuthorityNodeIndexEntry[];
  };
  authoringRevision: string;
  authorDecisions?: readonly RebaseDecisionRecord[];
  packageId?: string;
  deltaOutputDigest?: string;
  baseAuthorityReleaseId?: string | null;
  /**
   * When true, throw if any REVIEW_REQUIRED / LOCAL_CHECK remains unresolved.
   * Default false: report incomplete rebuild with prior still readable.
   */
  requireResolved?: boolean;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function resourceAuthoringFromRuntime(
  prior: TeachingProjectionArtifacts,
  priorAuthoring: TeachingProjectionAuthoringInput,
): TeachingResourceAuthoring[] {
  if (priorAuthoring.resources && priorAuthoring.resources.length > 0) {
    return [...priorAuthoring.resources];
  }
  // Reconstruct minimal authoring from runtime when authoring resources omitted.
  return prior.resources.map((r) => ({
    resourceId: r.resourceId,
    resourceType: r.resourceType,
    projectionMode: r.projectionMode,
    scopeId: r.scopeId,
    title: r.title ?? undefined,
    sourcePath: r.sourcePath ?? undefined,
    legacyCrosswalkRef: r.legacyCrosswalkRef,
  }));
}

function bindingAuthoringFromRuntime(
  prior: TeachingProjectionArtifacts,
  priorAuthoring: TeachingProjectionAuthoringInput,
): TeachingBindingAuthoring[] {
  if (priorAuthoring.bindings && priorAuthoring.bindings.length > 0) {
    return [...priorAuthoring.bindings];
  }
  return prior.bindings.map((b) => ({
    resourceId: b.resourceId,
    canonicalId: b.canonicalId,
    role: b.role,
    scopeId: b.scopeId,
    sourcePath: b.sourcePath ?? undefined,
    primary: b.primary,
    rationale: b.rationale ?? undefined,
  }));
}

function prerequisiteAuthoringFromRuntime(
  prior: TeachingProjectionArtifacts,
  priorAuthoring: TeachingProjectionAuthoringInput,
): TeachingPrerequisiteAuthoring[] {
  if (priorAuthoring.prerequisites && priorAuthoring.prerequisites.length > 0) {
    return [...priorAuthoring.prerequisites];
  }
  return prior.prerequisites.map((p) => ({
    prerequisiteId: p.prerequisiteId,
    sourceCanonicalId: p.sourceCanonicalId,
    targetCanonicalId: p.targetCanonicalId,
    strength: p.strength,
    evidenceRef: p.evidenceRef,
    rationale: p.rationale,
    scopeId: p.scopeId ?? undefined,
  }));
}

function coreAuthoringFromRuntime(
  prior: TeachingProjectionArtifacts,
  priorAuthoring: TeachingProjectionAuthoringInput,
): TeachingCoreNodeAuthoring[] {
  if (priorAuthoring.coreNodes && priorAuthoring.coreNodes.length > 0) {
    return [...priorAuthoring.coreNodes];
  }
  return prior.coreNodes.map((c) => ({
    canonicalId: c.canonicalId,
    pathEligible: c.pathEligible,
    cardPolicy: c.cardPolicy,
    moduleId: c.moduleId,
    scopeId: c.scopeId,
    rationale: c.rationale,
  }));
}

function cardAuthoringFromRuntime(
  prior: TeachingProjectionArtifacts,
  priorAuthoring: TeachingProjectionAuthoringInput,
): TeachingCardAuthoring[] {
  if (priorAuthoring.cards && priorAuthoring.cards.length > 0) {
    return [...priorAuthoring.cards];
  }
  return prior.cardsIndex.cards.map((c) => ({
    cardId: c.cardId,
    canonicalId: c.canonicalId,
    active: c.active,
    required: c.required,
    sourcePath: c.sourcePath ?? undefined,
    title: c.title ?? undefined,
  }));
}

function buildCarriedForwardMap(
  prior: TeachingProjectionArtifacts,
  next: TeachingProjectionArtifacts,
  affectedIds: {
    resources: Set<string>;
    bindings: Set<string>;
    prerequisites: Set<string>;
    coreNodes: Set<string>;
    cards: Set<string>;
  },
): CarriedForwardDigestEntry[] {
  const entries: CarriedForwardDigestEntry[] = [];

  const priorResourceById = new Map(prior.resources.map((r) => [r.resourceId, r]));
  for (const row of next.resources) {
    if (affectedIds.resources.has(row.resourceId)) continue;
    const prev = priorResourceById.get(row.resourceId);
    if (!prev) continue;
    const priorDigest = projectionDigest(prev);
    const rebuiltDigest = projectionDigest(row);
    entries.push({
      kind: 'resource',
      id: row.resourceId,
      priorDigest,
      rebuiltDigest,
      unchanged: priorDigest === rebuiltDigest,
    });
  }

  const priorBindingById = new Map(prior.bindings.map((b) => [b.bindingId, b]));
  for (const row of next.bindings) {
    if (affectedIds.bindings.has(row.bindingId)) continue;
    const prev = priorBindingById.get(row.bindingId);
    if (!prev) continue;
    // Binding identity includes canonicalId; after rewrite id changes — skip.
    const priorDigest = projectionDigest(prev);
    const rebuiltDigest = projectionDigest(row);
    entries.push({
      kind: 'binding',
      id: row.bindingId,
      priorDigest,
      rebuiltDigest,
      unchanged: priorDigest === rebuiltDigest,
    });
  }

  const priorPrereqById = new Map(prior.prerequisites.map((p) => [p.prerequisiteId, p]));
  for (const row of next.prerequisites) {
    if (affectedIds.prerequisites.has(row.prerequisiteId)) continue;
    const prev = priorPrereqById.get(row.prerequisiteId);
    if (!prev) continue;
    const priorDigest = projectionDigest(prev);
    const rebuiltDigest = projectionDigest(row);
    entries.push({
      kind: 'prerequisite',
      id: row.prerequisiteId,
      priorDigest,
      rebuiltDigest,
      unchanged: priorDigest === rebuiltDigest,
    });
  }

  const priorCoreById = new Map(prior.coreNodes.map((c) => [c.canonicalId, c]));
  for (const row of next.coreNodes) {
    if (affectedIds.coreNodes.has(row.canonicalId)) continue;
    const prev = priorCoreById.get(row.canonicalId);
    if (!prev) continue;
    const priorDigest = projectionDigest(prev);
    const rebuiltDigest = projectionDigest(row);
    entries.push({
      kind: 'core-node',
      id: row.canonicalId,
      priorDigest,
      rebuiltDigest,
      unchanged: priorDigest === rebuiltDigest,
    });
  }

  const priorCardById = new Map(prior.cardsIndex.cards.map((c) => [c.cardId, c]));
  for (const row of next.cardsIndex.cards) {
    if (affectedIds.cards.has(row.cardId)) continue;
    const prev = priorCardById.get(row.cardId);
    if (!prev) continue;
    const priorDigest = projectionDigest(prev);
    const rebuiltDigest = projectionDigest(row);
    entries.push({
      kind: 'card',
      id: row.cardId,
      priorDigest,
      rebuiltDigest,
      unchanged: priorDigest === rebuiltDigest,
    });
  }

  return entries.sort((a, b) =>
    compareCodePoint(`${a.kind}:${a.id}`, `${b.kind}:${b.id}`));
}

/**
 * Rebuild a complete Teaching Projection from prior artifacts + Delta impact.
 * Does not write files; pair with stageRebasedTeachingProjection for immutability.
 */
export function rebaseTeachingProjection(
  input: RebaseTeachingProjectionInput,
): TeachingProjectionRebaseResult {
  const priorManifest = input.priorArtifacts.manifest;
  const packageId = input.packageId ?? priorManifest.scopeId;

  const impact = impactSetFromArtifacts(input.priorArtifacts, {
    changes: input.changes,
    authorityReleaseId: input.targetAuthority.authorityReleaseId,
    baseAuthorityReleaseId:
      input.baseAuthorityReleaseId ?? priorManifest.authorityReleaseId,
    deltaOutputDigest: input.deltaOutputDigest,
    packageId,
  });

  const resolved = resolveRebaseDecisions({
    impact,
    authorDecisions: input.authorDecisions,
    allowUnresolved: true,
  });

  const blockingUnresolved = resolved.unresolved.filter(
    (u) => u.disposition === 'REVIEW_REQUIRED',
  );

  const reasons: string[] = [];
  if (blockingUnresolved.length > 0) {
    reasons.push(`review-required:${blockingUnresolved.length}`);
  }
  const localChecks = resolved.unresolved.filter((u) => u.disposition === 'LOCAL_CHECK');
  if (localChecks.length > 0) {
    reasons.push(`local-check:${localChecks.length}`);
  }

  if (input.requireResolved && resolved.unresolved.length > 0) {
    throw new TeachingProjectionRebaseError(
      'review-required',
      `unresolved rebase items: ${resolved.unresolved.map((u) => u.subjectId).join(', ')}`,
    );
  }

  // Always attempt rebuild so unaffected records stay carried-forward and
  // auto-rebased bindings land even when some packages still need review.
  // Gate may fail (REVIEW_REQUIRED) — staging is still allowed for review.
  const resources = resourceAuthoringFromRuntime(input.priorArtifacts, input.priorAuthoring);
  let bindings = bindingAuthoringFromRuntime(input.priorArtifacts, input.priorAuthoring);
  let cards = cardAuthoringFromRuntime(input.priorArtifacts, input.priorAuthoring);
  let coreNodes = coreAuthoringFromRuntime(input.priorArtifacts, input.priorAuthoring);
  let prerequisites = prerequisiteAuthoringFromRuntime(
    input.priorArtifacts,
    input.priorAuthoring,
  );

  // Apply canonical rewrites from AUTO_REBASE / AUTHOR_DECISION.
  bindings = applyCanonicalRewrites(
    bindings,
    resolved.decisions,
    (b) => deriveBindingId({
      resourceId: b.resourceId,
      canonicalId: b.canonicalId,
      role: b.role,
      scopeId: b.scopeId,
    }),
  ).map((b) => {
    // After rewrite, re-derive using successor for identity consistency in authoring.
    return b;
  });

  // Prefer source-canonical rewrite map for bindings (stable subject ids change with canonical).
  const successorBySource = new Map<string, string>();
  for (const d of resolved.decisions) {
    if (
      (d.kind === 'AUTO_REBASE' || d.kind === 'AUTHOR_DECISION')
      && d.sourceCanonicalId
      && d.successorCanonicalId
    ) {
      successorBySource.set(d.sourceCanonicalId, d.successorCanonicalId);
    }
  }
  bindings = bindings.map((b) => {
    const next = successorBySource.get(b.canonicalId);
    return next ? { ...b, canonicalId: next } : b;
  });

  // Cards: only rewrite when AUTHOR_DECISION exists (LOCAL_CHECK stays put).
  const cardDecisionById = new Map(
    resolved.decisions
      .filter((d) => d.subjectKind === 'card')
      .map((d) => [d.subjectId, d]),
  );
  cards = cards.map((c) => {
    const d = cardDecisionById.get(c.cardId);
    if (d && (d.kind === 'AUTHOR_DECISION' || d.kind === 'AUTO_REBASE') && d.successorCanonicalId) {
      return { ...c, canonicalId: d.successorCanonicalId };
    }
    return c;
  });

  coreNodes = coreNodes.map((c) => {
    const next = successorBySource.get(c.canonicalId);
    return next ? { ...c, canonicalId: next } : c;
  });

  prerequisites = applyPrerequisiteRewrites(prerequisites, resolved.decisions);

  const authoring: TeachingProjectionAuthoringInput = {
    contract: input.priorAuthoring.contract,
    scopeId: input.priorAuthoring.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.targetAuthority.authorityReleaseId,
    authorityReleaseSetId: input.targetAuthority.authorityReleaseSetId ?? null,
    authoritySnapshotId: input.targetAuthority.authoritySnapshotId ?? null,
    authoritySnapshotHash: input.targetAuthority.authoritySnapshotHash ?? null,
    resources,
    bindings,
    prerequisites,
    coreNodes,
    cards,
    authorityNodes: [...input.targetAuthority.authorityNodes],
  };

  const built = buildTeachingProjection(authoring);

  // Unresolved REVIEW_REQUIRED must fail the activation gate even when the
  // structural Authority gate would otherwise pass (e.g. source-anchor changes).
  const rebaseGateFindings = rebaseReviewRequiredGateFindings(blockingUnresolved);
  const artifacts = applyTeachingProjectionGateFindings(
    built,
    rebaseGateFindings,
    { forceFail: blockingUnresolved.length > 0 },
  );

  const affected = {
    resources: new Set(
      impact.items
        .filter((i) => i.subjectKind === 'resource' || i.subjectKind === 'textbook-locator')
        .map((i) => i.subjectId),
    ),
    bindings: new Set(
      impact.items.filter((i) => i.subjectKind === 'binding').map((i) => i.subjectId),
    ),
    prerequisites: new Set(
      impact.items.filter((i) => i.subjectKind === 'prerequisite').map((i) => i.subjectId),
    ),
    coreNodes: new Set(
      impact.items.filter((i) => i.subjectKind === 'core-node').map((i) => i.subjectId),
    ),
    cards: new Set(
      impact.items.filter((i) => i.subjectKind === 'card').map((i) => i.subjectId),
    ),
  };

  // Auto-rebased bindings change identity (canonical in bindingId) — mark old ids affected.
  for (const d of resolved.decisions) {
    if (d.kind === 'AUTO_REBASE' || d.kind === 'AUTHOR_DECISION') {
      if (d.subjectKind === 'binding') affected.bindings.add(d.subjectId);
      if (d.subjectKind === 'card') affected.cards.add(d.subjectId);
      if (d.subjectKind === 'core-node' && d.sourceCanonicalId) {
        affected.coreNodes.add(d.sourceCanonicalId);
      }
    }
  }

  const carriedForward = buildCarriedForwardMap(
    input.priorArtifacts,
    artifacts,
    affected,
  );

  if (resolved.autoRebasedSubjectIds.length > 0) {
    reasons.push(`auto-rebase:${resolved.autoRebasedSubjectIds.length}`);
  }
  reasons.push('complete-rebuild');

  const gatePassed =
    artifacts.gate.passed
    && artifacts.manifest.gatePassed
    && blockingUnresolved.length === 0;

  const report: TeachingProjectionRebaseReport = {
    contract: ACT_TEACHING_PROJECTION_REBASE_REPORT_CONTRACT,
    engineVersion: ACT_TEACHING_PROJECTION_REBASE_ENGINE_VERSION,
    packageId,
    priorProjectionId: priorManifest.projectionId,
    priorProjectionHash: priorManifest.projectionHash,
    newProjectionId: artifacts.manifest.projectionId,
    newProjectionHash: artifacts.manifest.projectionHash,
    deltaOutputDigest: impact.deltaOutputDigest,
    authorityReleaseId: input.targetAuthority.authorityReleaseId,
    baseAuthorityReleaseId:
      input.baseAuthorityReleaseId ?? priorManifest.authorityReleaseId,
    impact,
    decisions: resolved.decisions,
    unresolvedReviewRequired: resolved.unresolved,
    carriedForward,
    rebuildCompleted: true,
    gatePassed,
    reasons: reasons.sort(compareCodePoint),
    rollback: {
      projectionId: priorManifest.projectionId,
      projectionHash: priorManifest.projectionHash,
      authorityReleaseId: priorManifest.authorityReleaseId,
      ready: true,
    },
  };

  return {
    report,
    authoring,
    artifacts,
    priorManifest,
  };
}

function rebaseReviewRequiredGateFindings(
  unresolved: readonly ActImpactItem[],
): TeachingProjectionGateFinding[] {
  return unresolved
    .filter((u) => u.disposition === 'REVIEW_REQUIRED')
    .map((u) => {
      const finding: TeachingProjectionGateFinding = {
        code: 'rebase-review-required',
        severity: 'error',
        message: `unresolved rebase REVIEW_REQUIRED for ${u.subjectKind} ${u.subjectId}`,
      };
      if (u.canonicalId) finding.canonicalId = u.canonicalId;
      if (u.subjectKind === 'resource' || u.subjectKind === 'textbook-locator') {
        finding.resourceId = u.subjectId;
      } else if (u.subjectKind === 'binding') {
        finding.bindingId = u.subjectId;
      } else if (u.subjectKind === 'prerequisite') {
        finding.prerequisiteId = u.subjectId;
      } else if (u.subjectKind === 'card') {
        finding.cardId = u.subjectId;
      }
      return finding;
    })
    .sort((a, b) => compareCodePoint(
      `${a.code}:${a.message}`,
      `${b.code}:${b.message}`,
    ));
}

/**
 * Stage a rebased projection into an immutable release directory.
 * Never mutates current.json; prior projection remains readable.
 */
export function stageRebasedTeachingProjection(
  paths: TeachingProjectionStorePaths,
  rebaseResult: TeachingProjectionRebaseResult,
): {
  staged: StagedTeachingProjectionFiles | null;
  priorStillReadable: boolean;
  currentPointerUnchanged: boolean;
  report: TeachingProjectionRebaseReport;
} {
  const priorPointer = readCurrentTeachingProjectionPointer(paths);
  const priorStillReadable = (() => {
    try {
      loadStagedTeachingProjection(paths, rebaseResult.priorManifest.projectionId);
      return true;
    } catch {
      // Prior may only exist in memory during pure unit tests.
      return false;
    }
  })();

  if (!rebaseResult.artifacts) {
    return {
      staged: null,
      priorStillReadable,
      currentPointerUnchanged: true,
      report: rebaseResult.report,
    };
  }

  const staged = stageTeachingProjectionArtifacts(paths, rebaseResult.artifacts);
  const pointerAfter = readCurrentTeachingProjectionPointer(paths);
  const currentPointerUnchanged =
    JSON.stringify(priorPointer) === JSON.stringify(pointerAfter);

  // Prior release directory must still load after staging the new one.
  let priorOk = priorStillReadable;
  try {
    loadStagedTeachingProjection(paths, rebaseResult.priorManifest.projectionId);
    priorOk = true;
  } catch {
    // If prior was never staged in this store, leave as-is.
  }

  return {
    staged,
    priorStillReadable: priorOk,
    currentPointerUnchanged,
    report: rebaseResult.report,
  };
}

/**
 * Convenience: compute impact only (no rebuild).
 */
export function calculateImpactOnly(input: {
  artifacts: TeachingProjectionArtifacts;
  changes: readonly ActDeltaChangeEvent[];
  authorityReleaseId: string;
  baseAuthorityReleaseId?: string | null;
  packageId?: string;
  deltaOutputDigest?: string;
}) {
  return computeActTeachingProjectionImpactSet({
    changes: input.changes,
    projection: {
      resources: input.artifacts.resources,
      bindings: input.artifacts.bindings,
      prerequisites: input.artifacts.prerequisites,
      coreNodes: input.artifacts.coreNodes,
      cards: input.artifacts.cardsIndex.cards,
      projectionId: input.artifacts.manifest.projectionId,
      scopeId: input.artifacts.manifest.scopeId,
    },
    authorityReleaseId: input.authorityReleaseId,
    baseAuthorityReleaseId: input.baseAuthorityReleaseId,
    packageId: input.packageId,
    deltaOutputDigest: input.deltaOutputDigest,
  });
}
