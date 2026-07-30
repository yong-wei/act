/**
 * One-time Teaching Projection ↔ KAQ knowledge-relation conflict review (#1113).
 *
 * - Role→canonical maps require reviewed bindings.
 * - Planner gate is bound to KaqAuthoritySelector (formal consumers fail closed).
 * - Conflict ledger integrity is checked against full relation sets.
 * - Terminal conflict review states are immutable; re-detection preserves them.
 */

import { createHash } from 'node:crypto';

import {
  assertVerifiedKaqPinnedContext,
  type VerifiedKaqPinnedContext,
} from './authority-capability';
import {
  KAQ_RELATION_CONFLICT_REVIEW_VERSION,
  REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION,
  type ActkgTeachingProjectionRelation,
  type KaqAuthoritySelector,
  type KaqCanonicalBinding,
  type KaqKnowledgeToKnowledgeRelation,
  type PlannerTeachingRelationGate,
  type ReviewedKaqRoleCanonicalMapping,
  type TeachingProjectionAvailability,
  type TeachingRelationConflict,
  type TeachingRelationConflictReviewState,
} from './contracts';
import { assertReviewedKaqRoleCanonicalMapping } from './bindings';
import {
  actkgRelationMatchesAvailability,
  unavailableTeachingProjection,
} from './teaching-projection';

const TERMINAL_CONFLICT_STATES = new Set<TeachingRelationConflictReviewState>([
  'ACCEPTED_ACTKG',
  'RETAIN_KAQ',
  'RETIRED_KAQ',
]);

function conflictId(input: {
  kaqEdgeId: string;
  actkgRelationId: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.kaqEdgeId}\u001f${input.actkgRelationId}`, 'utf8')
    .digest('hex');
  return `kaq-teaching-conflict:${digest}`;
}

function roleMapFromReviewed(
  mapping: ReviewedKaqRoleCanonicalMapping,
): Map<string, readonly string[]> {
  return new Map(Object.entries(mapping.roleToCanonicalIds));
}

export function closeReviewedMapping(input: {
  reviewedMapping: ReviewedKaqRoleCanonicalMapping | Record<string, unknown>;
  pinned: VerifiedKaqPinnedContext;
  bindings: readonly KaqCanonicalBinding[];
}): ReviewedKaqRoleCanonicalMapping {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  return assertReviewedKaqRoleCanonicalMapping(
    input.reviewedMapping,
    pinned,
    input.bindings,
  );
}

/**
 * Exact conflict-set closure: ledger ids and fields must equal the fresh
 * conflict set re-derived from current relations + reviewed mapping.
 */
export function assertConflictLedgerMatchesFreshSet(input: {
  conflicts: readonly TeachingRelationConflict[];
  fresh: readonly TeachingRelationConflict[];
}): void {
  const ledgerById = new Map(input.conflicts.map((c) => [c.id, c]));
  const freshById = new Map(input.fresh.map((c) => [c.id, c]));
  if (ledgerById.size !== freshById.size) {
    throw new Error(
      `Conflict ledger rejected: size mismatch ledger=${ledgerById.size} fresh=${freshById.size}`,
    );
  }
  for (const [id, fresh] of freshById) {
    const ledger = ledgerById.get(id);
    if (!ledger) {
      throw new Error(
        `Conflict ledger rejected: missing actual conflict ${id}`,
      );
    }
    // Structural endpoints must match; review state may be terminal on ledger.
    if (
      ledger.kaqEdgeId !== fresh.kaqEdgeId
      || ledger.actkgRelationId !== fresh.actkgRelationId
      || ledger.kaqSourceRoleId !== fresh.kaqSourceRoleId
      || ledger.kaqTargetRoleId !== fresh.kaqTargetRoleId
      || ledger.kaqRelation !== fresh.kaqRelation
      || ledger.actkgSourceCanonicalId !== fresh.actkgSourceCanonicalId
      || ledger.actkgTargetCanonicalId !== fresh.actkgTargetCanonicalId
      || ledger.actkgPredicate !== fresh.actkgPredicate
    ) {
      throw new Error(
        `Conflict ledger rejected: field mismatch for conflict ${id}`,
      );
    }
  }
  for (const id of ledgerById.keys()) {
    if (!freshById.has(id)) {
      throw new Error(
        `Conflict ledger rejected: extra non-current conflict ${id}`,
      );
    }
  }
}

/**
 * Ledger integrity: every conflict must reference existing KAQ/ActKG relations
 * with matching endpoints; no duplicate conflict ids.
 */
export function assertConflictLedgerIntegrity(input: {
  conflicts: readonly TeachingRelationConflict[];
  kaqRelations: readonly KaqKnowledgeToKnowledgeRelation[];
  actkgRelations: readonly ActkgTeachingProjectionRelation[];
}): void {
  const kaqById = new Map(input.kaqRelations.map((r) => [r.edgeId, r]));
  const actkgById = new Map(input.actkgRelations.map((r) => [r.id, r]));
  const seen = new Set<string>();

  for (const conflict of input.conflicts) {
    if (seen.has(conflict.id)) {
      throw new Error(`Conflict ledger rejected: duplicate conflict id ${conflict.id}`);
    }
    seen.add(conflict.id);

    const expectedId = conflictId({
      kaqEdgeId: conflict.kaqEdgeId,
      actkgRelationId: conflict.actkgRelationId,
    });
    if (conflict.id !== expectedId) {
      throw new Error(
        `Conflict ledger rejected: conflict id does not match endpoints (${conflict.id})`,
      );
    }

    const kaq = kaqById.get(conflict.kaqEdgeId);
    if (!kaq) {
      throw new Error(
        `Conflict ledger rejected: missing KAQ relation ${conflict.kaqEdgeId}`,
      );
    }
    if (
      kaq.sourceRoleId !== conflict.kaqSourceRoleId
      || kaq.targetRoleId !== conflict.kaqTargetRoleId
      || kaq.relation !== conflict.kaqRelation
    ) {
      throw new Error(
        `Conflict ledger rejected: KAQ relation fields mismatch for ${conflict.kaqEdgeId}`,
      );
    }

    const actkg = actkgById.get(conflict.actkgRelationId);
    if (!actkg) {
      throw new Error(
        `Conflict ledger rejected: missing ActKG relation ${conflict.actkgRelationId}`,
      );
    }
    if (
      actkg.sourceCanonicalId !== conflict.actkgSourceCanonicalId
      || actkg.targetCanonicalId !== conflict.actkgTargetCanonicalId
      || actkg.predicate !== conflict.actkgPredicate
    ) {
      throw new Error(
        `Conflict ledger rejected: ActKG relation fields mismatch for ${conflict.actkgRelationId}`,
      );
    }
  }
}

function detectFreshConflicts(input: {
  kaqRelations: readonly KaqKnowledgeToKnowledgeRelation[];
  actkgRelations: readonly ActkgTeachingProjectionRelation[];
  mapping: ReviewedKaqRoleCanonicalMapping;
}): TeachingRelationConflict[] {
  const roleMap = roleMapFromReviewed(input.mapping);
  const conflicts: TeachingRelationConflict[] = [];

  for (const kaq of input.kaqRelations) {
    if (kaq.lifecycleState !== 'ACTIVE') continue;
    const sourceCanonicals = new Set(roleMap.get(kaq.sourceRoleId) ?? []);
    const targetCanonicals = new Set(roleMap.get(kaq.targetRoleId) ?? []);
    if (sourceCanonicals.size === 0 || targetCanonicals.size === 0) continue;

    for (const actkg of input.actkgRelations) {
      const forward =
        sourceCanonicals.has(actkg.sourceCanonicalId)
        && targetCanonicals.has(actkg.targetCanonicalId);
      const reverse =
        sourceCanonicals.has(actkg.targetCanonicalId)
        && targetCanonicals.has(actkg.sourceCanonicalId);
      if (!forward && !reverse) continue;

      conflicts.push({
        id: conflictId({ kaqEdgeId: kaq.edgeId, actkgRelationId: actkg.id }),
        schemaVersion: KAQ_RELATION_CONFLICT_REVIEW_VERSION,
        kaqEdgeId: kaq.edgeId,
        kaqSourceRoleId: kaq.sourceRoleId,
        kaqTargetRoleId: kaq.targetRoleId,
        kaqRelation: kaq.relation,
        actkgRelationId: actkg.id,
        actkgSourceCanonicalId: actkg.sourceCanonicalId,
        actkgTargetCanonicalId: actkg.targetCanonicalId,
        actkgPredicate: actkg.predicate,
        reviewState: 'UNRESOLVED',
        reviewIdentity: null,
        reviewRationale: null,
      });
    }
  }

  return conflicts.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Detect conflicts. `existingLedger` is REQUIRED (use `[]` for first pass).
 * Terminal rows are kept and never reset to UNRESOLVED; only new pairs are
 * added as UNRESOLVED. Omitting the ledger is a type error and not supported.
 */
export function detectTeachingRelationConflicts(input: {
  kaqRelations: readonly KaqKnowledgeToKnowledgeRelation[];
  actkgRelations: readonly ActkgTeachingProjectionRelation[];
  reviewedMapping: ReviewedKaqRoleCanonicalMapping;
  pinned: VerifiedKaqPinnedContext;
  bindings: readonly KaqCanonicalBinding[];
  /** Required prior ledger; pass [] on first detection. */
  existingLedger: readonly TeachingRelationConflict[];
}): TeachingRelationConflict[] {
  if (!Array.isArray(input.existingLedger)) {
    throw new Error(
      'detectTeachingRelationConflicts requires existingLedger (use [] on first pass)',
    );
  }

  const mapping = closeReviewedMapping({
    reviewedMapping: input.reviewedMapping,
    pinned: input.pinned,
    bindings: input.bindings,
  });

  // Validate prior ledger rows that still reference current relations.
  // (Stale pairs no longer in the relation set are dropped below, not required
  // to pass integrity against current graphs when they are obsolete.)
  const priorStillReferenced = input.existingLedger.filter((conflict) => (
    input.kaqRelations.some((r) => r.edgeId === conflict.kaqEdgeId)
    && input.actkgRelations.some((r) => r.id === conflict.actkgRelationId)
  ));
  assertConflictLedgerIntegrity({
    conflicts: priorStillReferenced,
    kaqRelations: input.kaqRelations,
    actkgRelations: input.actkgRelations,
  });

  const fresh = detectFreshConflicts({
    kaqRelations: input.kaqRelations,
    actkgRelations: input.actkgRelations,
    mapping,
  });

  // Return ONLY the current fresh pair set. Preserve terminal state from prior
  // ledger for matching ids; drop obsolete pairs not in fresh.
  const existingById = new Map(input.existingLedger.map((c) => [c.id, c]));
  return fresh.map((row) => {
    const existing = existingById.get(row.id);
    if (!existing) return row;
    if (TERMINAL_CONFLICT_STATES.has(existing.reviewState)) {
      return existing;
    }
    return existing.reviewState === 'UNRESOLVED' ? existing : row;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function reviewTeachingRelationConflict(
  conflict: TeachingRelationConflict,
  input: {
    outcome: Extract<
      TeachingRelationConflictReviewState,
      'ACCEPTED_ACTKG' | 'RETAIN_KAQ'
    >;
    reviewIdentity: string;
    reviewRationale: string;
  },
): TeachingRelationConflict {
  if (conflict.reviewState !== 'UNRESOLVED') {
    throw new Error(
      `Teaching relation conflict ${conflict.id} is already reviewed (${conflict.reviewState}); terminal states are immutable`,
    );
  }
  if (!input.reviewIdentity.trim() || !input.reviewRationale.trim()) {
    throw new Error('Teaching relation conflict review requires identity and rationale');
  }
  return {
    ...conflict,
    reviewState: input.outcome,
    reviewIdentity: input.reviewIdentity.trim(),
    reviewRationale: input.reviewRationale.trim(),
  };
}

/**
 * After ACCEPTED_ACTKG, retire corresponding KAQ edges. Conflict rows become
 * RETIRED_KAQ only when the relation is actually retired.
 */
export function retireAcceptedConflictingKaqRelations(input: {
  kaqRelations: readonly KaqKnowledgeToKnowledgeRelation[];
  conflicts: readonly TeachingRelationConflict[];
}): {
  relations: KaqKnowledgeToKnowledgeRelation[];
  conflicts: TeachingRelationConflict[];
} {
  const retireEdgeIds = new Set(
    input.conflicts
      .filter((conflict) => (
        conflict.reviewState === 'ACCEPTED_ACTKG'
        || conflict.reviewState === 'RETIRED_KAQ'
      ))
      .map((conflict) => conflict.kaqEdgeId),
  );

  const relations = input.kaqRelations.map((relation) => (
    retireEdgeIds.has(relation.edgeId)
      ? { ...relation, lifecycleState: 'RETIRED' as const }
      : relation
  ));

  const conflicts = input.conflicts.map((conflict) => {
    if (
      conflict.reviewState === 'ACCEPTED_ACTKG'
      || conflict.reviewState === 'RETIRED_KAQ'
    ) {
      const relation = relations.find((r) => r.edgeId === conflict.kaqEdgeId);
      if (relation?.lifecycleState === 'RETIRED') {
        return { ...conflict, reviewState: 'RETIRED_KAQ' as const };
      }
    }
    return conflict;
  });

  return { relations, conflicts };
}

export function detectTeachingRelationCycles(
  relations: ReadonlyArray<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    active: boolean;
  }>,
): string[] {
  const adjacency = new Map<string, Array<{ target: string; edgeId: string }>>();
  for (const edge of relations) {
    if (!edge.active) continue;
    const list = adjacency.get(edge.sourceId) ?? [];
    list.push({ target: edge.targetId, edgeId: edge.edgeId });
    adjacency.set(edge.sourceId, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleEdgeIds = new Set<string>();

  function dfs(node: string, stackEdges: string[]): void {
    if (visiting.has(node)) {
      for (const edgeId of stackEdges) cycleEdgeIds.add(edgeId);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      dfs(next.target, [...stackEdges, next.edgeId]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adjacency.keys()) {
    dfs(node, []);
  }

  return [...cycleEdgeIds].sort();
}

export function projectKaqEdgeToCanonicalSpace(input: {
  edge: KaqKnowledgeToKnowledgeRelation;
  reviewedMapping: ReviewedKaqRoleCanonicalMapping;
}): {
  projected: Array<{ edgeId: string; sourceId: string; targetId: string; active: true }>;
  unmappedRoleIds: string[];
} {
  if (input.reviewedMapping.schemaVersion !== REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION) {
    return {
      projected: [],
      unmappedRoleIds: [input.edge.sourceRoleId, input.edge.targetRoleId],
    };
  }
  const roleMap = roleMapFromReviewed(input.reviewedMapping);
  const sources = roleMap.get(input.edge.sourceRoleId) ?? [];
  const targets = roleMap.get(input.edge.targetRoleId) ?? [];
  const unmappedRoleIds: string[] = [];
  if (sources.length === 0) unmappedRoleIds.push(input.edge.sourceRoleId);
  if (targets.length === 0) unmappedRoleIds.push(input.edge.targetRoleId);
  if (unmappedRoleIds.length > 0) {
    return { projected: [], unmappedRoleIds: [...new Set(unmappedRoleIds)].sort() };
  }

  const projected: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    active: true;
  }> = [];
  for (const sourceId of sources) {
    for (const targetId of targets) {
      if (sourceId === targetId) continue;
      projected.push({
        edgeId: `${input.edge.edgeId}::${sourceId}->${targetId}`,
        sourceId,
        targetId,
        active: true,
      });
    }
  }
  return { projected, unmappedRoleIds: [] };
}

function blocked(
  reason: PlannerTeachingRelationGate['reason'],
  blockedEdgeIds: string[] = [],
  selectorConsumer?: PlannerTeachingRelationGate['selectorConsumer'],
): PlannerTeachingRelationGate {
  return {
    available: false,
    blocked: true,
    reason,
    activeKaqEdgeIds: [],
    activeActkgRelationIds: [],
    blockedEdgeIds,
    selectorConsumer,
  };
}

/**
 * Migration-review planner/preview gate for knowledge-to-knowledge teaching
 * relations. Requires explicit KaqAuthoritySelector:
 * - FORMAL_* → fail closed (no ActKG active edges before cutover)
 * - MIGRATION_REVIEW → shadow preview with ActKG when TP available
 * - CUTOVER_ACTIVATION → fail closed (not implemented in #1113)
 */
export function selectPlannerTeachingRelations(input: {
  selector: KaqAuthoritySelector;
  availability: TeachingProjectionAvailability;
  kaqRelations: readonly KaqKnowledgeToKnowledgeRelation[];
  actkgRelations: readonly ActkgTeachingProjectionRelation[];
  conflicts: readonly TeachingRelationConflict[];
  reviewedMapping: ReviewedKaqRoleCanonicalMapping | Record<string, unknown>;
  pinned: VerifiedKaqPinnedContext;
  bindings: readonly KaqCanonicalBinding[];
}): PlannerTeachingRelationGate {
  const consumer = input.selector.consumer;

  if (
    consumer === 'FORMAL_DIAGNOSIS'
    || consumer === 'FORMAL_RECOMMENDATION'
    || consumer === 'FORMAL_PLANNING'
  ) {
    return blocked('formal-selector-cannot-activate-actkg', [], consumer);
  }
  if (consumer === 'CUTOVER_ACTIVATION') {
    return blocked('cutover-selector-not-implemented', [], consumer);
  }
  if (input.selector.consumer !== 'MIGRATION_REVIEW') {
    return blocked('formal-selector-cannot-activate-actkg', [], consumer);
  }

  let pinned: VerifiedKaqPinnedContext;
  try {
    pinned = assertVerifiedKaqPinnedContext(input.pinned);
  } catch {
    return blocked('invalid-reviewed-mapping', ['pinned-unbranded'], consumer);
  }

  let mapping: ReviewedKaqRoleCanonicalMapping;
  try {
    mapping = closeReviewedMapping({
      reviewedMapping: input.reviewedMapping,
      pinned,
      bindings: input.bindings,
    });
  } catch {
    return blocked('invalid-reviewed-mapping', [], consumer);
  }

  // Re-derive fresh conflict pairs from the current relation set — ledger alone
  // is not trusted. Empty ledger cannot bypass actual conflicts.
  const fresh = detectFreshConflicts({
    kaqRelations: input.kaqRelations,
    actkgRelations: input.actkgRelations,
    mapping,
  });
  try {
    assertConflictLedgerIntegrity({
      conflicts: input.conflicts,
      kaqRelations: input.kaqRelations,
      actkgRelations: input.actkgRelations,
    });
    assertConflictLedgerMatchesFreshSet({
      conflicts: input.conflicts,
      fresh,
    });
  } catch {
    return blocked('invalid-conflict-ledger', [], consumer);
  }

  if (input.availability.available) {
    if (input.availability.pinnedContextDigest !== mapping.pinnedContextDigest) {
      return blocked('invalid-reviewed-mapping', ['pinnedContextDigest'], consumer);
    }
    if (
      input.availability.releaseSetId !== mapping.releaseSetId
      || input.availability.releaseId !== mapping.releaseId
    ) {
      return blocked('invalid-reviewed-mapping', ['releaseIdentity'], consumer);
    }
  }

  const unresolved = input.conflicts.filter(
    (conflict) => conflict.reviewState === 'UNRESOLVED',
  );
  if (unresolved.length > 0) {
    return blocked(
      'unresolved-conflict',
      unresolved.map((conflict) => conflict.kaqEdgeId).sort(),
      consumer,
    );
  }

  // Parallel only when a terminal ledger claims KAQ retirement but the KAQ edge
  // is still ACTIVE. RETAIN_KAQ may keep the conflicting ActKG relation present
  // in the supplied relation set for audit / exact-set ledger closure; that
  // presence is not parallel activation — ActKG is suppressed from effective
  // activation via suppressedActkgIds below.
  const parallel = input.conflicts.filter((conflict) => {
    if (
      conflict.reviewState === 'ACCEPTED_ACTKG'
      || conflict.reviewState === 'RETIRED_KAQ'
    ) {
      return input.kaqRelations.some(
        (relation) => (
          relation.edgeId === conflict.kaqEdgeId
          && relation.lifecycleState === 'ACTIVE'
        ),
      );
    }
    return false;
  });
  if (parallel.length > 0) {
    return blocked(
      'parallel-conflict-versions',
      parallel.map((conflict) => conflict.kaqEdgeId).sort(),
      consumer,
    );
  }

  const retiredKaqIds = new Set(
    input.conflicts
      .filter((conflict) => (
        conflict.reviewState === 'RETIRED_KAQ'
        || conflict.reviewState === 'ACCEPTED_ACTKG'
      ))
      .map((conflict) => conflict.kaqEdgeId),
  );
  const retainedKaqIds = new Set(
    input.conflicts
      .filter((conflict) => conflict.reviewState === 'RETAIN_KAQ')
      .map((conflict) => conflict.kaqEdgeId),
  );
  const acceptedActkgIds = new Set(
    input.conflicts
      .filter((conflict) => (
        conflict.reviewState === 'RETIRED_KAQ'
        || conflict.reviewState === 'ACCEPTED_ACTKG'
      ))
      .map((conflict) => conflict.actkgRelationId),
  );
  const suppressedActkgIds = new Set(
    input.conflicts
      .filter((conflict) => conflict.reviewState === 'RETAIN_KAQ')
      .map((conflict) => conflict.actkgRelationId),
  );
  const conflictedActkgIds = new Set(
    input.conflicts.map((conflict) => conflict.actkgRelationId),
  );

  if (!input.availability.available) {
    const activeKaqRelations = input.kaqRelations.filter((relation) => (
      relation.lifecycleState === 'ACTIVE'
      && !retiredKaqIds.has(relation.edgeId)
    ));
    const projected: Array<{
      edgeId: string;
      sourceId: string;
      targetId: string;
      active: true;
    }> = [];
    const unmapped: string[] = [];
    for (const edge of activeKaqRelations) {
      const result = projectKaqEdgeToCanonicalSpace({
        edge,
        reviewedMapping: mapping,
      });
      if (result.unmappedRoleIds.length > 0) {
        unmapped.push(...result.unmappedRoleIds);
        continue;
      }
      projected.push(...result.projected);
    }
    if (unmapped.length > 0) {
      return blocked('unmapped-role-endpoint', [...new Set(unmapped)].sort(), consumer);
    }

    const cycleEdges = detectTeachingRelationCycles(projected);
    if (cycleEdges.length > 0) {
      return blocked('cycle-detected', cycleEdges, consumer);
    }

    return {
      available: true,
      blocked: false,
      reason: 'teaching-projection-unavailable-using-kaq',
      activeKaqEdgeIds: activeKaqRelations.map((r) => r.edgeId).sort(),
      activeActkgRelationIds: [],
      blockedEdgeIds: [],
      selectorConsumer: consumer,
    };
  }

  const availability = input.availability;
  const mixedIds: string[] = [];
  for (const relation of input.actkgRelations) {
    if (!actkgRelationMatchesAvailability(relation, availability)) {
      mixedIds.push(relation.id);
    }
  }
  if (mixedIds.length > 0) {
    return blocked('mixed-actkg-relation-identity', mixedIds.sort(), consumer);
  }

  const retainedKaqRelations = input.kaqRelations.filter((relation) => (
    relation.lifecycleState === 'ACTIVE'
    && retainedKaqIds.has(relation.edgeId)
    && !retiredKaqIds.has(relation.edgeId)
  ));

  // Non-conflict ActKG relations remain active even when other conflicts exist.
  // Conflicted ActKG relations activate only after ACCEPTED_ACTKG / RETIRED_KAQ.
  const effectiveActkg = input.actkgRelations
    .filter((relation) => {
      if (suppressedActkgIds.has(relation.id)) return false;
      if (!conflictedActkgIds.has(relation.id)) return true;
      return acceptedActkgIds.has(relation.id);
    })
    .map((relation) => relation.id)
    .sort();

  const canonicalEdges: Array<{
    edgeId: string;
    sourceId: string;
    targetId: string;
    active: true;
  }> = [];

  for (const relation of input.actkgRelations) {
    if (!effectiveActkg.includes(relation.id)) continue;
    canonicalEdges.push({
      edgeId: relation.id,
      sourceId: relation.sourceCanonicalId,
      targetId: relation.targetCanonicalId,
      active: true,
    });
  }

  if (retainedKaqRelations.length > 0) {
    const unmapped: string[] = [];
    for (const edge of retainedKaqRelations) {
      const result = projectKaqEdgeToCanonicalSpace({
        edge,
        reviewedMapping: mapping,
      });
      if (result.unmappedRoleIds.length > 0) {
        unmapped.push(...result.unmappedRoleIds);
        continue;
      }
      canonicalEdges.push(...result.projected);
    }
    if (unmapped.length > 0) {
      return blocked('unmapped-role-endpoint', [...new Set(unmapped)].sort(), consumer);
    }
  }

  const cycleEdges = detectTeachingRelationCycles(canonicalEdges);
  if (cycleEdges.length > 0) {
    return blocked('cycle-detected', cycleEdges, consumer);
  }

  const activeKaqEdgeIds = retainedKaqRelations.map((r) => r.edgeId).sort();

  if (effectiveActkg.length > 0) {
    return {
      available: true,
      blocked: false,
      reason: conflictedActkgIds.size === 0
        ? 'teaching-projection-authority'
        : 'accepted-actkg-active',
      activeKaqEdgeIds,
      activeActkgRelationIds: effectiveActkg,
      blockedEdgeIds: [],
      selectorConsumer: consumer,
    };
  }

  return {
    available: true,
    blocked: false,
    reason: activeKaqEdgeIds.length > 0
      ? 'no-conflicts'
      : 'teaching-projection-authority',
    activeKaqEdgeIds,
    activeActkgRelationIds: [],
    blockedEdgeIds: [],
    selectorConsumer: consumer,
  };
}

export function assertPlannerMayConsumeTeachingRelations(
  gate: PlannerTeachingRelationGate,
): void {
  if (gate.blocked || !gate.available) {
    throw new Error(
      `Planner blocked from teaching relations: ${gate.reason}`
      + (gate.blockedEdgeIds.length
        ? ` (edges=${gate.blockedEdgeIds.join(',')})`
        : ''),
    );
  }
}

export function defaultUnavailableTeachingProjection(): TeachingProjectionAvailability {
  return unavailableTeachingProjection();
}
