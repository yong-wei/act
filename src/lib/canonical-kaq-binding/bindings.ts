/**
 * Generate and review KAQ-role → Canonical Object bindings from explicit
 * semantic proposals. Never inherits Legacy IDs or same-name matches.
 */

import { createHash } from 'node:crypto';

import {
  assertVerifiedKaqPinnedContext,
  type VerifiedKaqPinnedContext,
} from './authority-capability';
import {
  CANONICAL_KAQ_BINDING_SCHEMA_VERSION,
  KAQ_CANONICAL_BINDING_ROLES,
  REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION,
  type ForbiddenKaqBindingAutoSource,
  type HistoricalFactRebindingResult,
  type HistoricalLearningFactIdentity,
  type KaqCanonicalBinding,
  type KaqCanonicalBindingProposal,
  type KaqCanonicalBindingReviewInput,
  type KaqCanonicalBindingRole,
  type ReviewedKaqRoleCanonicalMapping,
} from './contracts';
import {
  assertBindingMatchesPinnedContext,
  KaqPinnedContextError,
} from './pinned-context';

/**
 * Module-private registry of CANDIDATE bindings from generateKaqCanonicalBindings.
 * Only generate may register. Hand-built / cloned candidates cannot enter review.
 */
const GENERATED_KAQ_CANDIDATE_REGISTRY = new WeakSet<object>();

/**
 * Module-private registry of ACCEPTED reviewed KAQ bindings.
 * Only reviewKaqCanonicalBinding may register. Clones / field-forged objects
 * never pass isReviewedShadowBinding.
 */
const ACCEPTED_REVIEWED_KAQ_BINDING_REGISTRY = new WeakSet<object>();

function freezeKaqBinding(binding: KaqCanonicalBinding): KaqCanonicalBinding {
  return Object.freeze({
    ...binding,
    evidenceRefs: Object.freeze([...(binding.evidenceRefs ?? [])]) as string[],
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function kaqBindingSha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

export function isKaqCanonicalBindingRole(
  value: string,
): value is KaqCanonicalBindingRole {
  return (KAQ_CANONICAL_BINDING_ROLES as readonly string[]).includes(value);
}

export function bindingIdentity(input: {
  kaqRoleId: string;
  canonicalId: string;
  bindingRole: KaqCanonicalBindingRole;
  releaseSetId: string;
  releaseId: string;
  objectRevision: string;
}): string {
  return `kaq-canonical-binding:${kaqBindingSha256(input)}`;
}

export function evidenceDigest(input: {
  kaqRoleId: string;
  canonicalId: string;
  bindingRole: KaqCanonicalBindingRole;
  evidenceRefs: readonly string[];
  semanticRationale: string;
}): string {
  return kaqBindingSha256({
    kaqRoleId: input.kaqRoleId,
    canonicalId: input.canonicalId,
    bindingRole: input.bindingRole,
    evidenceRefs: [...input.evidenceRefs].sort(),
    semanticRationale: input.semanticRationale,
  });
}

/**
 * Reject any attempt to auto-bind via Legacy ID equality or same-name labels.
 * Callers that only have those signals must not produce candidates.
 */
export function rejectAutoInheritedBinding(input: {
  source: ForbiddenKaqBindingAutoSource;
  kaqRoleId: string;
  candidateCanonicalId: string;
  legacyNodeId?: string | null;
  kaqLabel?: string | null;
  canonicalLabel?: string | null;
}): never {
  if (input.source === 'legacy-id') {
    throw new Error(
      `KAQ binding rejected: Legacy ID inheritance is forbidden `
      + `(kaqRoleId=${input.kaqRoleId}, legacyNodeId=${input.legacyNodeId ?? 'n/a'}, `
      + `canonicalId=${input.candidateCanonicalId})`,
    );
  }
  throw new Error(
    `KAQ binding rejected: same-name auto-match is forbidden `
    + `(kaqRoleId=${input.kaqRoleId}, label=${input.kaqLabel ?? input.canonicalLabel ?? 'n/a'}, `
    + `canonicalId=${input.candidateCanonicalId})`,
  );
}

/**
 * Prove a generator did not rely on forbidden auto sources.
 *
 * - Legacy ID equality alone never creates a binding (always rejected).
 * - Same-name labels require independent semantic rationale + evidence;
 *   without them the binding is rejected as same-name auto-match.
 */
export function assertNoForbiddenAutoInheritance(input: {
  kaqRoleId: string;
  proposal: KaqCanonicalBindingProposal;
  legacyNodeIdByRole?: ReadonlyMap<string, string> | Record<string, string>;
  labelsByRole?: ReadonlyMap<string, string> | Record<string, string>;
  labelsByCanonical?: ReadonlyMap<string, string> | Record<string, string>;
}): void {
  const legacyMap = toMap(input.legacyNodeIdByRole);
  const roleLabels = toMap(input.labelsByRole);
  const canonicalLabels = toMap(input.labelsByCanonical);
  const legacyId = legacyMap.get(input.kaqRoleId);
  const roleLabel = roleLabels.get(input.kaqRoleId);

  for (const target of input.proposal.targets) {
    if (legacyId && legacyId === target.canonicalId) {
      rejectAutoInheritedBinding({
        source: 'legacy-id',
        kaqRoleId: input.kaqRoleId,
        candidateCanonicalId: target.canonicalId,
        legacyNodeId: legacyId,
      });
    }
    const canonicalLabel = canonicalLabels.get(target.canonicalId);
    const sameName = Boolean(
      roleLabel
      && canonicalLabel
      && normalizeLabel(roleLabel) === normalizeLabel(canonicalLabel),
    );
    if (!sameName) continue;
    const hasIndependentReview = (
      target.semanticRationale.trim().length > 0
      && target.evidenceRefs.some((ref) => ref.trim().length > 0)
    );
    if (!hasIndependentReview) {
      rejectAutoInheritedBinding({
        source: 'same-name',
        kaqRoleId: input.kaqRoleId,
        candidateCanonicalId: target.canonicalId,
        kaqLabel: roleLabel,
        canonicalLabel,
      });
    }
  }
}

function toMap(
  value?: ReadonlyMap<string, string> | Record<string, string>,
): Map<string, string> {
  if (!value) return new Map();
  if (value instanceof Map) return new Map(value);
  return new Map(Object.entries(value));
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface GenerateKaqCanonicalBindingsResult {
  bindings: KaqCanonicalBinding[];
  rejected: Array<{ kaqRoleId: string; canonicalId: string; reason: string }>;
}

/**
 * Materialize candidate shadow bindings from explicit semantic proposals.
 * Restricted to pinned aggregate ReleaseSet + admitted CourseCoverage.
 * Supports one-to-many (one role → many objects) and many-to-one
 * (many roles → one object) without forced singular mapping.
 */
export function generateKaqCanonicalBindings(input: {
  proposals: readonly KaqCanonicalBindingProposal[];
  pinned: VerifiedKaqPinnedContext;
  legacyNodeIdByRole?: ReadonlyMap<string, string> | Record<string, string>;
  labelsByRole?: ReadonlyMap<string, string> | Record<string, string>;
  labelsByCanonical?: ReadonlyMap<string, string> | Record<string, string>;
}): GenerateKaqCanonicalBindingsResult {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  const admitted = new Set(pinned.admittedCanonicalIds);
  const bindings: KaqCanonicalBinding[] = [];
  const rejected: GenerateKaqCanonicalBindingsResult['rejected'] = [];
  const seen = new Set<string>();

  for (const proposal of input.proposals) {
    if (!proposal.kaqRoleId.trim()) {
      throw new Error('KAQ binding rejected: kaqRoleId is required');
    }
    if (!proposal.targets.length) {
      rejected.push({
        kaqRoleId: proposal.kaqRoleId,
        canonicalId: '',
        reason: 'empty-targets',
      });
      continue;
    }

    assertNoForbiddenAutoInheritance({
      kaqRoleId: proposal.kaqRoleId,
      proposal,
      legacyNodeIdByRole: input.legacyNodeIdByRole,
      labelsByRole: input.labelsByRole,
      labelsByCanonical: input.labelsByCanonical,
    });

    for (const target of proposal.targets) {
      if (!isKaqCanonicalBindingRole(target.bindingRole)) {
        rejected.push({
          kaqRoleId: proposal.kaqRoleId,
          canonicalId: target.canonicalId,
          reason: `invalid-binding-role:${target.bindingRole}`,
        });
        continue;
      }
      if (!target.canonicalId.trim()) {
        rejected.push({
          kaqRoleId: proposal.kaqRoleId,
          canonicalId: target.canonicalId,
          reason: 'missing-canonical-id',
        });
        continue;
      }
      if (!admitted.has(target.canonicalId)) {
        rejected.push({
          kaqRoleId: proposal.kaqRoleId,
          canonicalId: target.canonicalId,
          reason: 'canonical-outside-coverage',
        });
        continue;
      }
      const evidenceRefs = [...new Set(
        target.evidenceRefs.map((ref) => ref.trim()).filter(Boolean),
      )].sort();
      if (evidenceRefs.length === 0 || !target.semanticRationale.trim()) {
        rejected.push({
          kaqRoleId: proposal.kaqRoleId,
          canonicalId: target.canonicalId,
          reason: 'missing-independent-semantic-evidence',
        });
        continue;
      }

      const identity = {
        kaqRoleId: proposal.kaqRoleId,
        canonicalId: target.canonicalId,
        bindingRole: target.bindingRole,
        releaseSetId: pinned.releaseSetId,
        releaseId: pinned.releaseId,
        objectRevision: target.objectRevision,
      };
      const id = bindingIdentity(identity);
      if (seen.has(id)) continue;
      seen.add(id);

      const candidate = freezeKaqBinding({
        id,
        schemaVersion: CANONICAL_KAQ_BINDING_SCHEMA_VERSION,
        ...identity,
        evidenceRefs: Object.freeze([...evidenceRefs]) as string[],
        evidenceDigest: evidenceDigest({
          kaqRoleId: proposal.kaqRoleId,
          canonicalId: target.canonicalId,
          bindingRole: target.bindingRole,
          evidenceRefs,
          semanticRationale: target.semanticRationale.trim(),
        }),
        semanticRationale: target.semanticRationale.trim(),
        reviewState: 'CANDIDATE',
        reviewIdentity: null,
        reviewRationale: null,
        lifecycleState: 'CURRENT',
        authorityState: 'SHADOW',
        productionAuthoritative: false,
        pinnedContextDigest: pinned.contextDigest,
        inheritedFromLegacyId: null,
        sameNameAutoMatch: false,
      });
      GENERATED_KAQ_CANDIDATE_REGISTRY.add(candidate);
      bindings.push(candidate);
    }
  }

  const sealedCandidates = bindings
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    bindings: Object.freeze(sealedCandidates) as KaqCanonicalBinding[],
    rejected: rejected.sort((a, b) => (
      a.kaqRoleId.localeCompare(b.kaqRoleId)
      || a.canonicalId.localeCompare(b.canonicalId)
    )),
  };
}

/**
 * Independent semantic review. ACCEPT requires non-empty reviewer identity.
 * Does not activate formal consumers.
 *
 * On ACCEPT: reconstructs a frozen binding, recomputes identity/evidence digests,
 * and registers the exact instance in a private WeakSet. Clones and field-edited
 * objects never pass isReviewedShadowBinding / SAR projection.
 */
export function reviewKaqCanonicalBinding(
  binding: KaqCanonicalBinding,
  review: KaqCanonicalBindingReviewInput,
  pinned: VerifiedKaqPinnedContext,
): KaqCanonicalBinding {
  const closedPinned = assertVerifiedKaqPinnedContext(pinned);
  if (binding.id !== review.bindingId) {
    throw new Error('KAQ binding review rejected: bindingId mismatch');
  }
  assertBindingMatchesPinnedContext(binding, closedPinned);
  if (!review.reviewIdentity.trim()) {
    throw new Error('KAQ binding review rejected: reviewIdentity required');
  }
  if (!review.reviewRationale.trim()) {
    throw new Error('KAQ binding review rejected: reviewRationale required');
  }
  if (binding.lifecycleState !== 'CURRENT') {
    throw new Error('KAQ binding review rejected: only CURRENT bindings can be reviewed');
  }
  // One-time review: only CANDIDATE may transition to ACCEPTED/REJECTED.
  // Terminal states cannot be rewritten in place.
  if (binding.reviewState !== 'CANDIDATE') {
    throw new Error(
      `KAQ binding review rejected: only CANDIDATE can be reviewed (got ${binding.reviewState})`,
    );
  }
  // Provenance: only generateKaqCanonicalBindings-registered CANDIDATE instances.
  // Hand-built objects with recomputed id/evidenceDigest still fail here.
  if (!GENERATED_KAQ_CANDIDATE_REGISTRY.has(binding as object)) {
    throw new Error(
      'KAQ binding review rejected: candidate is not a generateKaqCanonicalBindings-registered instance',
    );
  }

  if (review.outcome === 'REJECT') {
    return Object.freeze({
      ...binding,
      evidenceRefs: Object.freeze([...binding.evidenceRefs]) as string[],
      reviewState: 'REJECTED' as const,
      reviewIdentity: review.reviewIdentity.trim(),
      reviewRationale: review.reviewRationale.trim(),
      authorityState: 'SHADOW' as const,
      productionAuthoritative: false as const,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false as const,
    });
  }

  // ACCEPT: full identity/digest revalidation + immutable provenance register.
  const identity = {
    kaqRoleId: binding.kaqRoleId,
    canonicalId: binding.canonicalId,
    bindingRole: binding.bindingRole,
    releaseSetId: closedPinned.releaseSetId,
    releaseId: closedPinned.releaseId,
    objectRevision: binding.objectRevision,
  };
  const recomputedId = bindingIdentity(identity);
  if (recomputedId !== binding.id) {
    throw new Error(
      'KAQ binding review rejected: binding identity does not match fields (forged or drifted)',
    );
  }
  const evidenceRefs = Object.freeze(
    [...new Set(binding.evidenceRefs.map((ref) => ref.trim()).filter(Boolean))].sort(),
  ) as readonly string[];
  const recomputedEvidenceDigest = evidenceDigest({
    kaqRoleId: binding.kaqRoleId,
    canonicalId: binding.canonicalId,
    bindingRole: binding.bindingRole,
    evidenceRefs,
    semanticRationale: binding.semanticRationale.trim(),
  });
  if (recomputedEvidenceDigest !== binding.evidenceDigest) {
    throw new Error(
      'KAQ binding review rejected: evidenceDigest does not match fields (forged or drifted)',
    );
  }
  if (binding.pinnedContextDigest !== closedPinned.contextDigest) {
    throw new Error(
      'KAQ binding review rejected: pinnedContextDigest mismatch',
    );
  }
  if (!closedPinned.admittedCanonicalIds.includes(binding.canonicalId)) {
    throw new Error(
      'KAQ binding review rejected: canonicalId outside admitted CourseCoverage',
    );
  }

  const accepted = Object.freeze({
    id: recomputedId,
    schemaVersion: CANONICAL_KAQ_BINDING_SCHEMA_VERSION,
    kaqRoleId: binding.kaqRoleId,
    canonicalId: binding.canonicalId,
    bindingRole: binding.bindingRole,
    releaseSetId: closedPinned.releaseSetId,
    releaseId: closedPinned.releaseId,
    objectRevision: binding.objectRevision,
    evidenceRefs: evidenceRefs as string[],
    evidenceDigest: recomputedEvidenceDigest,
    semanticRationale: binding.semanticRationale.trim(),
    reviewState: 'ACCEPTED' as const,
    reviewIdentity: review.reviewIdentity.trim(),
    reviewRationale: review.reviewRationale.trim(),
    lifecycleState: 'CURRENT' as const,
    authorityState: 'SHADOW' as const,
    productionAuthoritative: false as const,
    pinnedContextDigest: closedPinned.contextDigest,
    inheritedFromLegacyId: null,
    sameNameAutoMatch: false as const,
  });
  ACCEPTED_REVIEWED_KAQ_BINDING_REGISTRY.add(accepted);
  return accepted;
}

/**
 * Mark bindings stale when pinned context or Release identity drifts.
 */
export function markStaleKaqBindings(
  bindings: readonly KaqCanonicalBinding[],
  pinned: VerifiedKaqPinnedContext,
): KaqCanonicalBinding[] {
  const closedPinned = assertVerifiedKaqPinnedContext(pinned);
  return bindings.map((binding) => {
    if (binding.lifecycleState !== 'CURRENT') return binding;
    try {
      assertBindingMatchesPinnedContext(binding, closedPinned);
      return binding;
    } catch (error) {
      if (error instanceof KaqPinnedContextError) {
        return {
          ...binding,
          reviewState: 'STALE',
          lifecycleState: 'SUPERSEDED',
          authorityState: 'SHADOW',
          productionAuthoritative: false,
        };
      }
      throw error;
    }
  });
}

/**
 * True only for mint-registered ACCEPTED + CURRENT + SHADOW bindings inside the
 * verified pinned CourseCoverage / Release identity. Clones, field-forged
 * objects, candidate/rejected/stale/out-of-coverage never qualify.
 */
export function isReviewedShadowBinding(
  binding: KaqCanonicalBinding,
  pinned: VerifiedKaqPinnedContext,
): boolean {
  const closed = assertVerifiedKaqPinnedContext(pinned);
  if (!ACCEPTED_REVIEWED_KAQ_BINDING_REGISTRY.has(binding as object)) {
    return false;
  }
  // Recompute digests against the registered instance fields (defense in depth).
  const recomputedId = bindingIdentity({
    kaqRoleId: binding.kaqRoleId,
    canonicalId: binding.canonicalId,
    bindingRole: binding.bindingRole,
    releaseSetId: binding.releaseSetId,
    releaseId: binding.releaseId,
    objectRevision: binding.objectRevision,
  });
  if (recomputedId !== binding.id) return false;
  const recomputedEvidence = evidenceDigest({
    kaqRoleId: binding.kaqRoleId,
    canonicalId: binding.canonicalId,
    bindingRole: binding.bindingRole,
    evidenceRefs: binding.evidenceRefs,
    semanticRationale: binding.semanticRationale,
  });
  if (recomputedEvidence !== binding.evidenceDigest) return false;
  return (
    binding.lifecycleState === 'CURRENT'
    && binding.reviewState === 'ACCEPTED'
    && binding.authorityState === 'SHADOW'
    && binding.productionAuthoritative === false
    && binding.pinnedContextDigest === closed.contextDigest
    && binding.releaseSetId === closed.releaseSetId
    && binding.releaseId === closed.releaseId
    && closed.admittedCanonicalIds.includes(binding.canonicalId)
    && binding.inheritedFromLegacyId === null
    && binding.sameNameAutoMatch === false
  );
}

/**
 * SAR / consumers: assert the exact instance is a mint-registered reviewed binding.
 */
export function assertGovernedReviewedKaqBinding(
  value: unknown,
  pinned: VerifiedKaqPinnedContext,
): KaqCanonicalBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Governed KAQ binding rejected: object required');
  }
  const binding = value as KaqCanonicalBinding;
  if (!isReviewedShadowBinding(binding, pinned)) {
    throw new Error(
      'Governed KAQ binding rejected: not a mint-registered ACCEPTED reviewed binding',
    );
  }
  return binding;
}

/**
 * Active consumers may resolve only ACCEPTED, CURRENT bindings within the
 * current pinned CourseCoverage + ReleaseSet. Formal consumers still use
 * Legacy identity via the authority selector — this is the shadow resolver.
 */
export function resolveReviewedShadowBindings(input: {
  kaqRoleId: string;
  bindings: readonly KaqCanonicalBinding[];
  pinned: VerifiedKaqPinnedContext;
}): KaqCanonicalBinding[] {
  const closed = assertVerifiedKaqPinnedContext(input.pinned);
  return input.bindings
    .filter((binding) => (
      binding.kaqRoleId === input.kaqRoleId
      && isReviewedShadowBinding(binding, closed)
    ))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Build the only role→canonical map conflict detection and planner gates may
 * consume. Only `resolveReviewedShadowBindings` / `isReviewedShadowBinding`
 * accepted rows enter the map.
 */
export function buildReviewedKaqRoleCanonicalMapping(input: {
  bindings: readonly KaqCanonicalBinding[];
  pinned: VerifiedKaqPinnedContext;
}): ReviewedKaqRoleCanonicalMapping {
  const closed = assertVerifiedKaqPinnedContext(input.pinned);
  const byRole = new Map<string, Set<string>>();
  const bindingIds: string[] = [];

  for (const binding of input.bindings) {
    if (!isReviewedShadowBinding(binding, closed)) continue;
    bindingIds.push(binding.id);
    const set = byRole.get(binding.kaqRoleId) ?? new Set<string>();
    set.add(binding.canonicalId);
    byRole.set(binding.kaqRoleId, set);
  }

  const roleToCanonicalIds: Record<string, readonly string[]> = {};
  for (const [roleId, ids] of [...byRole.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    roleToCanonicalIds[roleId] = [...ids].sort();
  }

  return {
    schemaVersion: REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION,
    pinnedContextDigest: closed.contextDigest,
    releaseSetId: closed.releaseSetId,
    releaseId: closed.releaseId,
    roleToCanonicalIds,
    bindingIds: [...new Set(bindingIds)].sort(),
  };
}

/**
 * Re-verify a mapping object against original reviewed bindings.
 *
 * `bindings` is REQUIRED. The trusted map is always rebuilt from
 * bindings + pinned fingerprint; claimed mapping must match field-for-field.
 * There is no trust path that accepts a self-minted mapping without bindings.
 */
export function assertReviewedKaqRoleCanonicalMapping(
  value: ReviewedKaqRoleCanonicalMapping | null | undefined | Record<string, unknown>,
  pinned: VerifiedKaqPinnedContext,
  bindings: readonly KaqCanonicalBinding[],
): ReviewedKaqRoleCanonicalMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Reviewed KAQ role mapping rejected: mapping is required');
  }
  if (!Array.isArray(bindings)) {
    throw new Error(
      'Reviewed KAQ role mapping rejected: bindings are required (no trust without source reviewed bindings)',
    );
  }
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== REVIEWED_KAQ_ROLE_CANONICAL_MAPPING_VERSION) {
    throw new Error('Reviewed KAQ role mapping rejected: schemaVersion mismatch');
  }
  const closed = assertVerifiedKaqPinnedContext(pinned);
  if (raw.pinnedContextDigest !== closed.contextDigest) {
    throw new Error(
      'Reviewed KAQ role mapping rejected: pinnedContextDigest mismatch (forged or drifted)',
    );
  }
  if (raw.releaseSetId !== closed.releaseSetId || raw.releaseId !== closed.releaseId) {
    throw new Error('Reviewed KAQ role mapping rejected: Release identity mismatch');
  }
  if (!raw.roleToCanonicalIds || typeof raw.roleToCanonicalIds !== 'object') {
    throw new Error('Reviewed KAQ role mapping rejected: roleToCanonicalIds required');
  }

  const rebuilt = buildReviewedKaqRoleCanonicalMapping({ bindings, pinned: closed });
  const claimed = raw.roleToCanonicalIds as Record<string, unknown>;
  const claimedKeys = Object.keys(claimed).sort();
  const rebuiltKeys = Object.keys(rebuilt.roleToCanonicalIds).sort();
  if (claimedKeys.join('\0') !== rebuiltKeys.join('\0')) {
    throw new Error(
      'Reviewed KAQ role mapping rejected: role set does not match reviewed bindings',
    );
  }
  for (const roleId of rebuiltKeys) {
    const claimedIds = Array.isArray(claimed[roleId])
      ? (claimed[roleId] as unknown[]).map(String).sort()
      : [];
    const expectedIds = [...rebuilt.roleToCanonicalIds[roleId]!];
    if (claimedIds.join('\0') !== expectedIds.join('\0')) {
      throw new Error(
        `Reviewed KAQ role mapping rejected: canonical set for ${roleId} does not match reviewed bindings`,
      );
    }
  }
  // bindingIds audit set must also match rebuilt accepted ids when provided.
  if (Array.isArray(raw.bindingIds)) {
    const claimedBindingIds = [...new Set(raw.bindingIds.map(String))].sort().join('\0');
    const expectedBindingIds = rebuilt.bindingIds.join('\0');
    if (claimedBindingIds !== expectedBindingIds) {
      throw new Error(
        'Reviewed KAQ role mapping rejected: bindingIds do not match reviewed bindings',
      );
    }
  }
  return rebuilt;
}

/**
 * Binding migration never rewrites historical LearningFacts and never creates
 * Canonical sidecars on historical rows.
 */
export function preserveHistoricalLearningFacts(
  facts: readonly HistoricalLearningFactIdentity[],
): HistoricalFactRebindingResult {
  return {
    rewritten: false,
    sidecarCreated: false,
    retainedLegacyRevision: true,
    facts: facts.map((fact) => ({
      factId: fact.factId,
      knowledgeRevision: fact.knowledgeRevision,
      knowledgeAuthority: 'LEGACY',
      legacyKnowledgeNodeId: fact.legacyKnowledgeNodeId,
    })),
  };
}
