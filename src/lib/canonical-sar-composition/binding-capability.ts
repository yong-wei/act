/**
 * Runtime-authenticated SAR binding capability (#1114 final review).
 *
 * Only module-produced WeakSet-registered instances pass assertVerifiedSarBindingSet.
 * Structural clones, raw arrays, and forged reviewer/evidence objects fail closed.
 * Production projectors register outputs; test-only mint lives in testing.ts
 * and is NOT re-exported from the production public index.
 */

import { createHash } from 'node:crypto';

import type { VerifiedKaqPinnedContext } from '@/lib/canonical-kaq-binding/authority-capability';
import { assertVerifiedKaqPinnedContext } from '@/lib/canonical-kaq-binding/authority-capability';
import {
  assertGovernedReviewedKaqBinding,
  isReviewedShadowBinding,
} from '@/lib/canonical-kaq-binding/bindings';
import type { KaqCanonicalBinding } from '@/lib/canonical-kaq-binding/contracts';
import {
  assertGovernedResourceBindingResult,
  type BindingGovernanceResult,
} from '@/lib/aggregate-governance/resource-bindings';

import type {
  SarCompositionVersionContext,
  SarCrossNamespaceBinding,
  SarCrossNamespaceBindingKind,
  SarKaqBindingPredicate,
  SarResourceBindingPredicate,
  VerifiedSarBindingSet,
} from './contracts';
import {
  PINNED_SAR_AGGREGATE_RELEASE_ID,
  PINNED_SAR_AGGREGATE_RELEASE_SET_ID,
} from './contracts';
import { computeBindingSetDigest } from './cache';
import {
  mapKaqRoleToSarPredicate,
  mapResourceRoleToSarPredicate,
} from './semantics';

const VERIFIED_BINDING_SET_VERSION = 'act-verified-sar-binding-set/v1' as const;
const VERIFIED_BINDING_SET_BRAND = Symbol('sar.verified-binding-set');
const VERIFIED_BINDING_SET_REGISTRY = new WeakSet<object>();

const SHA256 = /^[a-f0-9]{64}$/u;

export type SarBindingShapeFailureCode =
  | 'kind-predicate-mismatch'
  | 'kind-namespace-mismatch'
  | 'reversed-endpoints'
  | 'non-repository-target'
  | 'self-loop'
  | 'missing-evidence'
  | 'missing-scope'
  | 'version-mismatch'
  | 'invalid-aggregate';

export class SarBindingCapabilityError extends Error {
  readonly code:
    | 'binding-set-unbranded'
    | 'binding-set-unregistered'
    | 'binding-set-digest-mismatch'
    | 'binding-set-version-mismatch'
    | SarBindingShapeFailureCode;

  constructor(
    code: SarBindingCapabilityError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'SarBindingCapabilityError';
    this.code = code;
  }
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const KAQ_PREDICATES = new Set<string>([
  'kaq_primary_identity',
  'kaq_composition_part',
  'kaq_supporting_object',
]);
const RESOURCE_PREDICATES = new Set<string>([
  'resource_explains',
  'resource_practices',
  'resource_assesses',
  'resource_references',
]);

/**
 * Runtime validation matrix for discriminated binding kinds.
 * Accepts structural objects (including forgeries) and rejects illegal
 * kind/predicate/endpoint combinations before traversal.
 */
export function assertBindingKindMatrix(
  binding: SarCrossNamespaceBinding | Record<string, unknown>,
): void {
  // Structural (possibly forged) view — do not trust the discriminated union.
  const row = binding as {
    id: string;
    kind: string;
    predicate: string;
    fromNamespace: string;
    toNamespace: string;
    fromIdentity: string;
    toIdentity: string;
    courseId: string | null;
    learningGoalId: string | null;
    studentId: string | null;
    classId: string | null;
  };
  if (row.fromIdentity === row.toIdentity && row.fromNamespace === row.toNamespace) {
    throw new SarBindingCapabilityError(
      'self-loop',
      `Binding ${row.id} is a self-loop`,
    );
  }
  if (row.toNamespace !== 'repository') {
    throw new SarBindingCapabilityError(
      'non-repository-target',
      `Binding ${row.id} target must be repository (got ${row.toNamespace})`,
    );
  }

  switch (row.kind) {
    case 'kaq-canonical': {
      if (row.fromNamespace !== 'kaq') {
        throw new SarBindingCapabilityError(
          'kind-namespace-mismatch',
          `kaq-canonical requires fromNamespace=kaq (got ${row.fromNamespace})`,
        );
      }
      if (!KAQ_PREDICATES.has(row.predicate)) {
        throw new SarBindingCapabilityError(
          'kind-predicate-mismatch',
          `kaq-canonical forbids predicate ${row.predicate}`,
        );
      }
      if (
        row.courseId !== null
        || row.learningGoalId !== null
        || row.studentId !== null
        || row.classId !== null
      ) {
        throw new SarBindingCapabilityError(
          'missing-scope',
          `kaq-canonical must not carry path/learner scope fields`,
        );
      }
      return;
    }
    case 'resource-canonical': {
      if (row.fromNamespace !== 'resource') {
        throw new SarBindingCapabilityError(
          'kind-namespace-mismatch',
          `resource-canonical requires fromNamespace=resource`,
        );
      }
      if (!RESOURCE_PREDICATES.has(row.predicate)) {
        throw new SarBindingCapabilityError(
          'kind-predicate-mismatch',
          `resource-canonical forbids predicate ${row.predicate}`,
        );
      }
      if (
        row.courseId !== null
        || row.learningGoalId !== null
        || row.studentId !== null
        || row.classId !== null
      ) {
        throw new SarBindingCapabilityError(
          'missing-scope',
          `resource-canonical must not carry path/learner scope fields`,
        );
      }
      return;
    }
    case 'path-canonical': {
      if (row.fromNamespace !== 'path') {
        throw new SarBindingCapabilityError(
          'kind-namespace-mismatch',
          `path-canonical requires fromNamespace=path`,
        );
      }
      if (row.predicate !== 'path_covers') {
        throw new SarBindingCapabilityError(
          'kind-predicate-mismatch',
          `path-canonical requires predicate path_covers`,
        );
      }
      if (!nonEmpty(row.courseId) || !nonEmpty(row.learningGoalId)) {
        throw new SarBindingCapabilityError(
          'missing-scope',
          `path-canonical requires courseId and learningGoalId`,
        );
      }
      if (row.studentId !== null || row.classId !== null) {
        throw new SarBindingCapabilityError(
          'missing-scope',
          `path-canonical must not carry student/class scope`,
        );
      }
      return;
    }
    case 'learner-canonical': {
      if (row.fromNamespace !== 'learner-state') {
        throw new SarBindingCapabilityError(
          'kind-namespace-mismatch',
          `learner-canonical requires fromNamespace=learner-state`,
        );
      }
      if (row.predicate !== 'learner_targets') {
        throw new SarBindingCapabilityError(
          'kind-predicate-mismatch',
          `learner-canonical requires predicate learner_targets`,
        );
      }
      if (
        !nonEmpty(row.courseId)
        || !nonEmpty(row.learningGoalId)
        || !nonEmpty(row.studentId)
        || !nonEmpty(row.classId)
      ) {
        throw new SarBindingCapabilityError(
          'missing-scope',
          `learner-canonical requires course/learningGoal/student/class scope`,
        );
      }
      return;
    }
    default: {
      throw new SarBindingCapabilityError(
        'kind-predicate-mismatch',
        `Unknown binding kind: ${String(row.kind)}`,
      );
    }
  }
}

export function assertAcceptedBindingEvidence(
  binding: SarCrossNamespaceBinding,
  version: SarCompositionVersionContext,
): void {
  assertBindingKindMatrix(binding);
  if (binding.reviewState !== 'ACCEPTED') {
    throw new SarBindingCapabilityError(
      'missing-evidence',
      `Binding ${binding.id} is not ACCEPTED`,
    );
  }
  if (binding.authorityState !== 'SHADOW' || binding.productionAuthoritative !== false) {
    throw new SarBindingCapabilityError(
      'missing-evidence',
      `Binding ${binding.id} is not shadow-only`,
    );
  }
  if (binding.inheritedFromLegacyId !== null || binding.sameNameAutoMatch !== false) {
    throw new SarBindingCapabilityError(
      'missing-evidence',
      `Binding ${binding.id} has forbidden auto-match markers`,
    );
  }
  if (
    binding.releaseSetId !== version.releaseSetId
    || binding.releaseId !== version.releaseId
    || binding.releaseSetId !== PINNED_SAR_AGGREGATE_RELEASE_SET_ID
    || binding.releaseId !== PINNED_SAR_AGGREGATE_RELEASE_ID
  ) {
    throw new SarBindingCapabilityError(
      'invalid-aggregate',
      `Binding ${binding.id} is not closed against pinned aggregate`,
    );
  }
  if (!nonEmpty(binding.objectRevision)
    || !nonEmpty(binding.evidenceDigest)
    || !SHA256.test(binding.evidenceDigest)
    || !nonEmpty(binding.reviewIdentity)) {
    throw new SarBindingCapabilityError(
      'missing-evidence',
      `Binding ${binding.id} missing evidence fields`,
    );
  }
  const expectedOverlay = expectedOverlayForKind(binding.kind, version);
  if (binding.overlayVersion !== expectedOverlay) {
    throw new SarBindingCapabilityError(
      'version-mismatch',
      `Binding ${binding.id} overlayVersion not closed`,
    );
  }
}

function expectedOverlayForKind(
  kind: SarCrossNamespaceBindingKind,
  version: SarCompositionVersionContext,
): string {
  switch (kind) {
    case 'kaq-canonical':
      return version.kaqBindingVersion;
    case 'resource-canonical':
      return version.resourceBindingVersion;
    case 'path-canonical':
      return version.pathOverlayVersion;
    case 'learner-canonical':
      return version.learnerStateOverlayVersion;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Module-private seal. Deep-copies every binding, freezes each element and the
 * array, then registers the set. Callers cannot TOCTOU-mutate sealed members.
 * NOT exported — only governed projectors and test-only mint may reach this.
 */
function sealBindingSet(
  bindings: readonly SarCrossNamespaceBinding[],
  version: SarCompositionVersionContext,
): VerifiedSarBindingSet {
  for (const binding of bindings) {
    assertAcceptedBindingEvidence(binding, version);
  }
  const frozenMembers = [...bindings]
    .map((binding) => Object.freeze({ ...binding }) as SarCrossNamespaceBinding)
    .sort((a, b) => a.id.localeCompare(b.id));
  Object.freeze(frozenMembers);
  const digest = computeBindingSetDigest(frozenMembers);
  const obj = {
    schemaVersion: VERIFIED_BINDING_SET_VERSION,
    bindings: frozenMembers,
    bindingSetDigest: digest,
    versionContextDigest: version.contextDigest,
  } as VerifiedSarBindingSet & { readonly [key: symbol]: symbol };

  Object.defineProperty(obj, VERIFIED_BINDING_SET_BRAND, {
    value: VERIFIED_BINDING_SET_BRAND,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.freeze(obj);
  VERIFIED_BINDING_SET_REGISTRY.add(obj);
  return obj;
}

/**
 * Assert a composition input binding set is mint-registered and digest-closed.
 */
export function assertVerifiedSarBindingSet(
  value: unknown,
  version: SarCompositionVersionContext,
): VerifiedSarBindingSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SarBindingCapabilityError(
      'binding-set-unbranded',
      'VerifiedSarBindingSet is required (raw arrays are rejected)',
    );
  }
  const raw = value as Record<PropertyKey, unknown>;
  if (raw[VERIFIED_BINDING_SET_BRAND] !== VERIFIED_BINDING_SET_BRAND) {
    throw new SarBindingCapabilityError(
      'binding-set-unbranded',
      'Binding set is unbranded or forged',
    );
  }
  if (!VERIFIED_BINDING_SET_REGISTRY.has(value as object)) {
    throw new SarBindingCapabilityError(
      'binding-set-unregistered',
      'Binding set is not mint-registered (clone or forged instance)',
    );
  }
  if (raw.schemaVersion !== VERIFIED_BINDING_SET_VERSION) {
    throw new SarBindingCapabilityError(
      'binding-set-version-mismatch',
      'Binding set schemaVersion mismatch',
    );
  }
  if (raw.versionContextDigest !== version.contextDigest) {
    throw new SarBindingCapabilityError(
      'binding-set-version-mismatch',
      'Binding set versionContextDigest does not match composition version',
    );
  }
  if (!Array.isArray(raw.bindings)) {
    throw new SarBindingCapabilityError(
      'binding-set-unbranded',
      'Binding set bindings array missing',
    );
  }
  const bindings = raw.bindings as SarCrossNamespaceBinding[];
  for (const binding of bindings) {
    assertAcceptedBindingEvidence(binding, version);
  }
  const expectedDigest = computeBindingSetDigest(bindings);
  if (raw.bindingSetDigest !== expectedDigest) {
    throw new SarBindingCapabilityError(
      'binding-set-digest-mismatch',
      'Binding set digest does not match bindings',
    );
  }
  return value as VerifiedSarBindingSet;
}

/**
 * Require VerifiedKaqPinnedContext for aggregate authority when projecting
 * KAQ/resource/path/learner bindings into a verified set.
 */
export function assertPinnedMatchesVersion(
  pinned: VerifiedKaqPinnedContext,
  version: SarCompositionVersionContext,
): void {
  const closed = assertVerifiedKaqPinnedContext(pinned);
  if (
    closed.releaseSetId !== version.releaseSetId
    || closed.releaseId !== version.releaseId
    || closed.releaseHash !== version.releaseHash
    || closed.deltaReceiptId !== version.deltaReceiptId
    || closed.coverageOverlayId !== version.coverageOverlayId
    || closed.coverageOverlayVersion !== version.coverageOverlayVersion
  ) {
    throw new SarBindingCapabilityError(
      'version-mismatch',
      'VerifiedKaqPinnedContext does not match composition version context',
    );
  }
}

/**
 * Merge already-verified binding sets closed on the same version.
 * Each input must pass assertVerifiedSarBindingSet (rejects clones/forgeries).
 * Same id with identical content is deduped; content conflict fails closed.
 */
export function mergeVerifiedSarBindingSets(
  sets: readonly unknown[],
  version: SarCompositionVersionContext,
): VerifiedSarBindingSet {
  const byId = new Map<string, SarCrossNamespaceBinding>();
  for (const candidate of sets) {
    const verified = assertVerifiedSarBindingSet(candidate, version);
    for (const binding of verified.bindings) {
      const prior = byId.get(binding.id);
      if (!prior) {
        byId.set(binding.id, binding);
        continue;
      }
      if (bindingContentFingerprint(prior) !== bindingContentFingerprint(binding)) {
        throw new SarBindingCapabilityError(
          'binding-set-digest-mismatch',
          `mergeVerifiedSarBindingSets: conflicting content for binding id ${binding.id}`,
        );
      }
      // identical — keep prior
    }
  }
  // Re-seal from already-verified governed members (no caller-forged path).
  return sealBindingSet([...byId.values()], version);
}

function bindingContentFingerprint(binding: SarCrossNamespaceBinding): string {
  return computeBindingSetDigest([binding]);
}

function assertTestOnly(label: string): void {
  const workerId = process.env.VITEST_WORKER_ID;
  const isTest = process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || (typeof workerId === 'string' && workerId.length > 0);
  if (!isTest) {
    throw new Error(`${label} is test-only and cannot mint in production`);
  }
}

/**
 * Test/fixture-only mint. Fail-closed outside Vitest/test NODE_ENV.
 * NOT re-exported from the production public index.
 */
export function mintVerifiedSarBindingSetForTests(
  bindings: readonly SarCrossNamespaceBinding[],
  version: SarCompositionVersionContext,
): VerifiedSarBindingSet {
  assertTestOnly('mintVerifiedSarBindingSetForTests');
  return sealBindingSet(bindings, version);
}

function nonEmptyStr(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const SHA256_HEX = /^[a-f0-9]{64}$/u;

/**
 * Production projector: only mint-registered reviewed KAQ bindings enter the set.
 * Clones / field-edited ACCEPTED rows fail isReviewedShadowBinding and are skipped;
 * assertGovernedReviewedKaqBinding throws if caller requires hard fail per item.
 */
export function projectReviewedKaqBindingsToSar(input: {
  bindings: readonly KaqCanonicalBinding[];
  pinned: VerifiedKaqPinnedContext;
  version: SarCompositionVersionContext;
}): VerifiedSarBindingSet {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  assertPinnedMatchesVersion(pinned, input.version);
  const out: SarCrossNamespaceBinding[] = [];

  for (const binding of input.bindings) {
    // Hard provenance gate — clone/forged never passes.
    if (!isReviewedShadowBinding(binding, pinned)) continue;
    assertGovernedReviewedKaqBinding(binding, pinned);
    const predicate = mapKaqRoleToSarPredicate(binding.bindingRole);
    if (
      predicate !== 'kaq_primary_identity'
      && predicate !== 'kaq_composition_part'
      && predicate !== 'kaq_supporting_object'
    ) {
      continue;
    }
    if (
      binding.releaseSetId !== input.version.releaseSetId
      || binding.releaseId !== input.version.releaseId
    ) {
      continue;
    }
    if (!nonEmptyStr(binding.reviewIdentity)) continue;
    out.push({
      id: `sar-bind:kaq:${binding.id}`,
      kind: 'kaq-canonical',
      predicate,
      fromNamespace: 'kaq',
      fromIdentity: binding.kaqRoleId,
      toNamespace: 'repository',
      toIdentity: binding.canonicalId,
      releaseSetId: binding.releaseSetId,
      releaseId: binding.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: binding.objectRevision,
      evidenceDigest: binding.evidenceDigest,
      reviewIdentity: binding.reviewIdentity,
      overlayVersion: input.version.kaqBindingVersion,
      courseId: null,
      learningGoalId: null,
      studentId: null,
      classId: null,
    });
  }
  return sealBindingSet(out, input.version);
}

/**
 * Production projector: only decisions from a governResourceBindings-registered
 * BindingGovernanceResult. Hand-built decisions / result clones fail assertion.
 */
export function projectReviewedResourceBindingsToSar(input: {
  governanceResult: BindingGovernanceResult;
  pinned: VerifiedKaqPinnedContext;
  version: SarCompositionVersionContext;
}): VerifiedSarBindingSet {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  assertPinnedMatchesVersion(pinned, input.version);
  const governance = assertGovernedResourceBindingResult(input.governanceResult);
  const out: SarCrossNamespaceBinding[] = [];
  const decisions = [
    ...governance.decisions,
    ...governance.reusable,
  ];
  for (const decision of decisions) {
    if (decision.publicationState !== 'SHADOW_PUBLISHED') continue;
    if (decision.lifecycleState !== 'CURRENT') continue;
    if (
      decision.reviewState !== 'ACCEPTED'
      && decision.reviewState !== 'NOT_REQUIRED'
    ) {
      continue;
    }
    if (
      decision.releaseSetId !== input.version.releaseSetId
      || decision.releaseId !== input.version.releaseId
    ) {
      continue;
    }
    const predicate = mapResourceRoleToSarPredicate(decision.role);
    if (
      predicate !== 'resource_explains'
      && predicate !== 'resource_practices'
      && predicate !== 'resource_assesses'
      && predicate !== 'resource_references'
    ) {
      continue;
    }
    const reviewIdentity =
      decision.reviewIdentity
      ?? (decision.reviewState === 'NOT_REQUIRED'
        ? `resource-deterministic:${decision.id}`
        : null);
    if (!nonEmptyStr(reviewIdentity)) continue;
    if (!nonEmptyStr(decision.evidenceDigest) || !SHA256_HEX.test(decision.evidenceDigest)) {
      continue;
    }
    if (!nonEmptyStr(decision.objectRevision)) continue;
    out.push({
      id: `sar-bind:resource:${decision.id}`,
      kind: 'resource-canonical',
      predicate,
      fromNamespace: 'resource',
      fromIdentity: decision.segmentId,
      toNamespace: 'repository',
      toIdentity: decision.canonicalId,
      releaseSetId: decision.releaseSetId,
      releaseId: decision.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: decision.objectRevision,
      evidenceDigest: decision.evidenceDigest,
      reviewIdentity,
      overlayVersion: input.version.resourceBindingVersion,
      courseId: null,
      learningGoalId: null,
      studentId: null,
      classId: null,
    });
  }
  return sealBindingSet(out, input.version);
}

export type { SarKaqBindingPredicate, SarResourceBindingPredicate };
