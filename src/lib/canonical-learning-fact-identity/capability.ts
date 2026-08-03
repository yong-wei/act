/**
 * Opaque capability brands for LearningFact authority (#1116).
 *
 * Selectors, admissions, and Canonical write capabilities are only valid when
 * the exact object instance is registered in a module-private WeakSet. Structural
 * clones and reflected Symbol copies fail closed.
 *
 * Production can mint LEGACY / SHADOW selectors and SHADOW admissions only.
 * Formal Canonical write capability has no production mint in #1116 (test-only).
 */

import type { VerifiedKaqPinnedContext } from '@/lib/canonical-kaq-binding/authority-capability';
import { assertVerifiedKaqPinnedContext } from '@/lib/canonical-kaq-binding/authority-capability';
import { assertGovernedReviewedKaqBinding } from '@/lib/canonical-kaq-binding/bindings';
import type { KaqCanonicalBinding } from '@/lib/canonical-kaq-binding/contracts';
import {
  assertGovernedResourceBindingResult,
  type BindingGovernanceResult,
} from '@/lib/aggregate-governance/resource-bindings';

import type {
  AggregateReleasePublicationState,
  CanonicalWriteAdmissionContext,
  LearningFactAuthorityConsumer,
  LearningFactAuthorityMode,
  LearningFactAuthoritySelector,
} from './contracts';
import {
  PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID,
  PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID,
} from './contracts';

const SELECTOR_BRAND = Symbol('learning-fact.authority-selector');
const ADMISSION_BRAND = Symbol('learning-fact.verified-admission');
const WRITE_CAPABILITY_BRAND = Symbol('learning-fact.canonical-write-capability');

const SELECTOR_REGISTRY = new WeakSet<object>();
const ADMISSION_REGISTRY = new WeakSet<object>();
const WRITE_CAPABILITY_REGISTRY = new WeakSet<object>();

export const VERIFIED_LEARNING_FACT_ADMISSION_VERSION =
  'act-verified-learning-fact-admission/v1' as const;
export const CANONICAL_LEARNING_FACT_WRITE_CAPABILITY_VERSION =
  'act-canonical-learning-fact-write-capability/v1' as const;

export type LearningFactAdmissionMode = 'SHADOW' | 'FORMAL_WRITE';

export type VerifiedLearningFactAdmission = CanonicalWriteAdmissionContext & {
  readonly [ADMISSION_BRAND]?: typeof ADMISSION_BRAND;
  schemaVersion: typeof VERIFIED_LEARNING_FACT_ADMISSION_VERSION;
  mode: LearningFactAdmissionMode;
  productionWriteAuthorized: boolean;
};

export type RegisteredLearningFactAuthoritySelector = LearningFactAuthoritySelector & {
  readonly [SELECTOR_BRAND]?: typeof SELECTOR_BRAND;
};

export type CanonicalLearningFactWriteCapability = {
  readonly [WRITE_CAPABILITY_BRAND]?: typeof WRITE_CAPABILITY_BRAND;
  schemaVersion: typeof CANONICAL_LEARNING_FACT_WRITE_CAPABILITY_VERSION;
  /** Bound formal admission instance (same object must be registered). */
  admission: VerifiedLearningFactAdmission;
  /** Bound CANONICAL selector instance. */
  selector: RegisteredLearningFactAuthoritySelector;
};

export class LearningFactCapabilityError extends Error {
  readonly code:
    | 'selector-unregistered'
    | 'admission-unregistered'
    | 'write-capability-unregistered'
    | 'admission-mode-invalid'
    | 'write-capability-mismatch'
    | 'shadow-only-admission'
    | 'pinned-required'
    | 'support-proof-missing'
    | 'test-only-mint';

  constructor(code: LearningFactCapabilityError['code'], message: string) {
    super(message);
    this.name = 'LearningFactCapabilityError';
    this.code = code;
  }
}

function sealBrand<T extends object>(target: T, brand: symbol): T {
  Object.defineProperty(target, brand, {
    value: brand,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return target;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  const obj = value as object;
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (!desc || !('value' in desc)) continue;
    if (desc.value !== null && typeof desc.value === 'object') {
      deepFreeze(desc.value);
    }
  }
  return Object.freeze(value);
}

function sealRegister<T extends object>(
  target: T,
  brand: symbol,
  registry: WeakSet<object>,
): T {
  sealBrand(target, brand);
  deepFreeze(target);
  registry.add(target);
  return target;
}

function assertTestOnly(fnName: string): void {
  const vitest = typeof process !== 'undefined' && process.env.VITEST;
  const nodeTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  if (!vitest && !nodeTest) {
    throw new LearningFactCapabilityError(
      'test-only-mint',
      `${fnName} is test-only and cannot mint production capabilities`,
    );
  }
}

function mintSelector(
  selector: LearningFactAuthoritySelector,
): RegisteredLearningFactAuthoritySelector {
  const instance = { ...selector } as RegisteredLearningFactAuthoritySelector;
  return sealRegister(instance, SELECTOR_BRAND, SELECTOR_REGISTRY);
}

/** Production-safe: LEGACY formal selector. */
export function mintFormalLegacyLearningFactSelector(): RegisteredLearningFactAuthoritySelector {
  return mintSelector({
    consumer: 'FORMAL_PRODUCTION',
    authority: 'LEGACY',
    productionAuthoritative: true,
    canonicalWriterEnabled: false,
  });
}

/** Production-safe: SHADOW validation selector (never writes). */
export function mintShadowLearningFactSelector(): RegisteredLearningFactAuthoritySelector {
  return mintSelector({
    consumer: 'SHADOW_VALIDATION',
    authority: 'CANONICAL_SHADOW',
    productionAuthoritative: false,
    canonicalWriterEnabled: false,
  });
}

export function assertRegisteredLearningFactSelector(
  value: unknown,
): asserts value is RegisteredLearningFactAuthoritySelector {
  if (!value || typeof value !== 'object') {
    throw new LearningFactCapabilityError(
      'selector-unregistered',
      'LearningFact authority selector must be a registered capability instance',
    );
  }
  if (!SELECTOR_REGISTRY.has(value)) {
    throw new LearningFactCapabilityError(
      'selector-unregistered',
      'LearningFact authority selector is not a registered capability (structural clone rejected)',
    );
  }
}

export function assertVerifiedLearningFactAdmission(
  value: unknown,
): asserts value is VerifiedLearningFactAdmission {
  if (!value || typeof value !== 'object') {
    throw new LearningFactCapabilityError(
      'admission-unregistered',
      'LearningFact admission must be a registered capability instance',
    );
  }
  if (!ADMISSION_REGISTRY.has(value)) {
    throw new LearningFactCapabilityError(
      'admission-unregistered',
      'LearningFact admission is not a registered capability (structural clone rejected)',
    );
  }
}

export function assertCanonicalLearningFactWriteCapability(
  value: unknown,
): asserts value is CanonicalLearningFactWriteCapability {
  if (!value || typeof value !== 'object') {
    throw new LearningFactCapabilityError(
      'write-capability-unregistered',
      'Canonical LearningFact write capability must be a registered instance',
    );
  }
  if (!WRITE_CAPABILITY_REGISTRY.has(value)) {
    throw new LearningFactCapabilityError(
      'write-capability-unregistered',
      'Canonical LearningFact write capability is not registered (structural clone rejected)',
    );
  }
  const cap = value as CanonicalLearningFactWriteCapability;
  assertRegisteredLearningFactSelector(cap.selector);
  assertVerifiedLearningFactAdmission(cap.admission);
  if (cap.selector.authority !== 'CANONICAL' || !cap.selector.canonicalWriterEnabled) {
    throw new LearningFactCapabilityError(
      'write-capability-mismatch',
      'Write capability selector must be CANONICAL with writer enabled',
    );
  }
  if (cap.admission.mode !== 'FORMAL_WRITE' || !cap.admission.productionWriteAuthorized) {
    throw new LearningFactCapabilityError(
      'write-capability-mismatch',
      'Write capability admission must be FORMAL_WRITE',
    );
  }
  if (cap.admission !== (value as CanonicalLearningFactWriteCapability).admission) {
    // exact instance already checked via registry on admission field
  }
}

function collectSupportedCanonicalIds(input: {
  pinned: VerifiedKaqPinnedContext;
  reviewedKaqBindings?: readonly KaqCanonicalBinding[];
  resourceBindingResult?: BindingGovernanceResult | null;
}): string[] {
  const supported = new Set<string>();
  for (const binding of input.reviewedKaqBindings ?? []) {
    const closed = assertGovernedReviewedKaqBinding(binding, input.pinned);
    if (
      closed.reviewState === 'ACCEPTED'
      && closed.lifecycleState === 'CURRENT'
      && typeof closed.canonicalId === 'string'
      && closed.canonicalId.trim()
    ) {
      supported.add(closed.canonicalId.trim());
    }
  }
  if (input.resourceBindingResult) {
    const governed = assertGovernedResourceBindingResult(input.resourceBindingResult);
    for (const decision of governed.decisions) {
      if (
        decision.lifecycleState === 'CURRENT'
        && decision.publicationState === 'SHADOW_PUBLISHED'
        && typeof decision.canonicalId === 'string'
        && decision.canonicalId.trim()
      ) {
        supported.add(decision.canonicalId.trim());
      }
    }
  }
  return [...supported].sort();
}

/**
 * Projected membership from governed CURRENT+SHADOW_PUBLISHED resource binding
 * decisions only (not KAQ-only support). Preserves exact (canonical, resource)
 * pairs so writers cannot cross-apply resources across nodes.
 */
function collectProjectedMembershipFromResourceBindings(
  resourceBindingResult: BindingGovernanceResult | null | undefined,
): {
  projectedCanonicalIds: string[];
  accessibleResourceIds: string[];
  projectedResourceBindings: Array<{ canonicalId: string; resourceId: string }>;
} {
  if (!resourceBindingResult) {
    return {
      projectedCanonicalIds: [],
      accessibleResourceIds: [],
      projectedResourceBindings: [],
    };
  }
  const governed = assertGovernedResourceBindingResult(resourceBindingResult);
  const projected = new Set<string>();
  const resources = new Set<string>();
  const pairs = new Map<string, { canonicalId: string; resourceId: string }>();
  for (const decision of governed.decisions) {
    if (
      decision.lifecycleState !== 'CURRENT'
      || decision.publicationState !== 'SHADOW_PUBLISHED'
    ) {
      continue;
    }
    const canonicalId =
      typeof decision.canonicalId === 'string' ? decision.canonicalId.trim() : '';
    const resourceId =
      typeof decision.resourceId === 'string' ? decision.resourceId.trim() : '';
    if (canonicalId) projected.add(canonicalId);
    if (resourceId) resources.add(resourceId);
    if (canonicalId && resourceId) {
      pairs.set(`${canonicalId}\u001f${resourceId}`, { canonicalId, resourceId });
    }
  }
  return {
    projectedCanonicalIds: [...projected].sort(),
    accessibleResourceIds: [...resources].sort(),
    projectedResourceBindings: [...pairs.values()].sort((a, b) => {
      const byCanonical = a.canonicalId.localeCompare(b.canonicalId);
      return byCanonical !== 0
        ? byCanonical
        : a.resourceId.localeCompare(b.resourceId);
    }),
  };
}

function mintAdmission(input: {
  mode: LearningFactAdmissionMode;
  productionWriteAuthorized: boolean;
  pinned: VerifiedKaqPinnedContext;
  resourceOrKaqSupportedCanonicalIds: readonly string[];
  allowedSourcePrefixes: readonly string[];
  /**
   * Projection ID of the active aggregate Release (ActkgRelease.projectionId
   * or ActkgProjectionIdentity.projectionId). Required — admission always
   * closes projection identity against the verified Release.
   */
  projectionId: string;
  releasePublicationState?: AggregateReleasePublicationState;
  /**
   * Projection-bound resource identity gates (#1275). When any of these are
   * provided (or requireProjectionBoundResourceIdentity is true), managed
   * writers enforce resourceId + projected-node membership via admission —
   * not optional caller-side fields.
   */
  projectedCanonicalIds?: readonly string[];
  accessibleResourceIds?: readonly string[];
  projectedResourceBindings?: readonly {
    canonicalId: string;
    resourceId: string;
  }[];
  requireProjectionBoundResourceIdentity?: boolean;
}): VerifiedLearningFactAdmission {
  assertVerifiedKaqPinnedContext(input.pinned);
  const pinned = input.pinned;
  if (
    pinned.releaseSetId !== PINNED_LEARNING_FACT_AGGREGATE_RELEASE_SET_ID
    || pinned.releaseId !== PINNED_LEARNING_FACT_AGGREGATE_RELEASE_ID
  ) {
    throw new LearningFactCapabilityError(
      'pinned-required',
      'LearningFact admission requires the pinned aggregate ReleaseSet/Release',
    );
  }
  if (input.resourceOrKaqSupportedCanonicalIds.length === 0) {
    throw new LearningFactCapabilityError(
      'support-proof-missing',
      'LearningFact admission requires resource binding or reviewed KAQ support proof',
    );
  }
  const projectionId = input.projectionId.trim();
  if (!projectionId) {
    throw new LearningFactCapabilityError(
      'pinned-required',
      'LearningFact admission requires the active aggregate projectionId',
    );
  }
  // Authoritative knowledge revision = verified aggregate releaseHash from pinned context.
  // This is the smallest existing closed identity already present on the pinned context
  // and mirrored on ActkgRelease.releaseHash for database enforcement.
  const knowledgeRevisionRef = pinned.releaseHash.trim();
  if (!/^[a-f0-9]{64}$/u.test(knowledgeRevisionRef)) {
    throw new LearningFactCapabilityError(
      'pinned-required',
      'LearningFact admission requires pinned releaseHash as knowledgeRevisionRef',
    );
  }

  const admitted = [...pinned.admittedCanonicalIds].sort();
  const supported = [...input.resourceOrKaqSupportedCanonicalIds].sort();
  // Support must be a subset of admitted coverage.
  for (const id of supported) {
    if (!admitted.includes(id)) {
      throw new LearningFactCapabilityError(
        'support-proof-missing',
        `Support proof for ${id} is outside admitted CourseCoverage`,
      );
    }
  }

  const projectedResourceBindings =
    input.projectedResourceBindings && input.projectedResourceBindings.length > 0
      ? Object.freeze(
          input.projectedResourceBindings
            .map((binding) => ({
              canonicalId: binding.canonicalId.trim(),
              resourceId: binding.resourceId.trim(),
            }))
            .filter((binding) => binding.canonicalId && binding.resourceId)
            .sort((a, b) => {
              const byCanonical = a.canonicalId.localeCompare(b.canonicalId);
              return byCanonical !== 0
                ? byCanonical
                : a.resourceId.localeCompare(b.resourceId);
            }),
        ) as readonly { canonicalId: string; resourceId: string }[]
      : undefined;
  const projectedCanonicalIds =
    input.projectedCanonicalIds && input.projectedCanonicalIds.length > 0
      ? Object.freeze(
          [...new Set(input.projectedCanonicalIds.map((id) => id.trim()).filter(Boolean))].sort(),
        ) as readonly string[]
      : projectedResourceBindings
        ? Object.freeze(
            [...new Set(projectedResourceBindings.map((b) => b.canonicalId))].sort(),
          ) as readonly string[]
        : undefined;
  const accessibleResourceIds =
    input.accessibleResourceIds && input.accessibleResourceIds.length > 0
      ? Object.freeze(
          [...new Set(input.accessibleResourceIds.map((id) => id.trim()).filter(Boolean))].sort(),
        ) as readonly string[]
      : projectedResourceBindings
        ? Object.freeze(
            [...new Set(projectedResourceBindings.map((b) => b.resourceId))].sort(),
          ) as readonly string[]
        : undefined;
  const requireProjectionBoundResourceIdentity =
    input.requireProjectionBoundResourceIdentity === true
    || (projectedCanonicalIds != null && projectedCanonicalIds.length > 0)
    || (accessibleResourceIds != null && accessibleResourceIds.length > 0)
    || (projectedResourceBindings != null && projectedResourceBindings.length > 0)
      ? true
      : undefined;

  const admission = {
    schemaVersion: VERIFIED_LEARNING_FACT_ADMISSION_VERSION,
    mode: input.mode,
    productionWriteAuthorized: input.productionWriteAuthorized,
    admittedCanonicalIds: Object.freeze([...admitted]) as readonly string[],
    resourceOrKaqSupportedCanonicalIds: Object.freeze([...supported]) as readonly string[],
    expectedReleaseSetId: pinned.releaseSetId,
    expectedReleaseId: pinned.releaseId,
    expectedProjectionId: projectionId,
    expectedKnowledgeRevisionRef: knowledgeRevisionRef,
    allowedSourcePrefixes: Object.freeze(
      [...input.allowedSourcePrefixes],
    ) as readonly string[],
    releasePublicationStateHint: input.releasePublicationState ?? 'CANDIDATE',
    ...(projectedCanonicalIds ? { projectedCanonicalIds } : {}),
    ...(accessibleResourceIds ? { accessibleResourceIds } : {}),
    ...(projectedResourceBindings ? { projectedResourceBindings } : {}),
    ...(requireProjectionBoundResourceIdentity
      ? { requireProjectionBoundResourceIdentity: true as const }
      : {}),
  } as VerifiedLearningFactAdmission;

  return sealRegister(admission, ADMISSION_BRAND, ADMISSION_REGISTRY);
}

/**
 * Production-safe SHADOW admission. Uses verified pinned context + governed
 * resource/KAQ support proofs. Never authorizes formal Canonical writes.
 */
export function buildShadowLearningFactAdmission(input: {
  pinned: VerifiedKaqPinnedContext;
  allowedSourcePrefixes: readonly string[];
  /** Active aggregate projection id closed against the pinned Release. */
  projectionId: string;
  reviewedKaqBindings?: readonly KaqCanonicalBinding[];
  resourceBindingResult?: BindingGovernanceResult | null;
  /**
   * Teaching Projection-bound membership. When omitted and resource bindings
   * are present, projected IDs default to supported canonicals and resource
   * IDs are derived from CURRENT+SHADOW_PUBLISHED decisions.
   */
  projectedCanonicalIds?: readonly string[];
  accessibleResourceIds?: readonly string[];
  projectedResourceBindings?: readonly {
    canonicalId: string;
    resourceId: string;
  }[];
  requireProjectionBoundResourceIdentity?: boolean;
}): VerifiedLearningFactAdmission {
  const supported = collectSupportedCanonicalIds({
    pinned: input.pinned,
    reviewedKaqBindings: input.reviewedKaqBindings,
    resourceBindingResult: input.resourceBindingResult,
  });
  // Projection membership is derived only from resource binding decisions —
  // never from the full KAQ+resource support union (P2).
  const derived = collectProjectedMembershipFromResourceBindings(
    input.resourceBindingResult,
  );
  const projectedResourceBindings =
    input.projectedResourceBindings
    ?? (derived.projectedResourceBindings.length > 0
      ? derived.projectedResourceBindings
      : undefined);
  const accessibleResourceIds =
    input.accessibleResourceIds
    ?? (derived.accessibleResourceIds.length > 0
      ? derived.accessibleResourceIds
      : undefined);
  const projectedCanonicalIds =
    input.projectedCanonicalIds
    ?? (derived.projectedCanonicalIds.length > 0
      ? derived.projectedCanonicalIds
      : undefined);
  const requireProjectionBoundResourceIdentity =
    input.requireProjectionBoundResourceIdentity
    ?? (Boolean(projectedResourceBindings && projectedResourceBindings.length > 0)
      || Boolean(accessibleResourceIds && accessibleResourceIds.length > 0)
      || Boolean(projectedCanonicalIds && projectedCanonicalIds.length > 0)
      || undefined);
  return mintAdmission({
    mode: 'SHADOW',
    productionWriteAuthorized: false,
    pinned: input.pinned,
    resourceOrKaqSupportedCanonicalIds: supported,
    allowedSourcePrefixes: input.allowedSourcePrefixes,
    projectionId: input.projectionId,
    releasePublicationState: 'CANDIDATE',
    projectedCanonicalIds,
    accessibleResourceIds,
    projectedResourceBindings,
    requireProjectionBoundResourceIdentity,
  });
}

/** View admission fields for validation without exposing mint. */
export function readVerifiedLearningFactAdmission(
  admission: VerifiedLearningFactAdmission,
): CanonicalWriteAdmissionContext {
  assertVerifiedLearningFactAdmission(admission);
  return {
    admittedCanonicalIds: admission.admittedCanonicalIds,
    resourceOrKaqSupportedCanonicalIds: admission.resourceOrKaqSupportedCanonicalIds,
    expectedReleaseSetId: admission.expectedReleaseSetId,
    expectedReleaseId: admission.expectedReleaseId,
    expectedProjectionId: admission.expectedProjectionId,
    expectedKnowledgeRevisionRef: admission.expectedKnowledgeRevisionRef,
    allowedSourcePrefixes: admission.allowedSourcePrefixes,
    ...(admission.projectedCanonicalIds
      ? { projectedCanonicalIds: admission.projectedCanonicalIds }
      : {}),
    ...(admission.accessibleResourceIds
      ? { accessibleResourceIds: admission.accessibleResourceIds }
      : {}),
    ...(admission.projectedResourceBindings
      ? { projectedResourceBindings: admission.projectedResourceBindings }
      : {}),
    ...(admission.requireProjectionBoundResourceIdentity
      ? {
          requireProjectionBoundResourceIdentity:
            admission.requireProjectionBoundResourceIdentity,
        }
      : {}),
  };
}

export function assertAdmissionAllowsFormalWrite(
  admission: VerifiedLearningFactAdmission,
): void {
  assertVerifiedLearningFactAdmission(admission);
  if (admission.mode !== 'FORMAL_WRITE' || !admission.productionWriteAuthorized) {
    throw new LearningFactCapabilityError(
      'shadow-only-admission',
      'SHADOW admission cannot authorize formal Canonical LearningFact writes',
    );
  }
}

// ---------------------------------------------------------------------------
// Test-only mints (VITEST / NODE_ENV=test). Not re-exported from production
// index as a write path — only via ./testing.
// ---------------------------------------------------------------------------

export function mintCanonicalLearningFactSelectorForTests(): RegisteredLearningFactAuthoritySelector {
  assertTestOnly('mintCanonicalLearningFactSelectorForTests');
  return mintSelector({
    consumer: 'CUTOVER_ACTIVATION',
    authority: 'CANONICAL',
    productionAuthoritative: true,
    canonicalWriterEnabled: true,
  });
}

export function mintFormalWriteLearningFactAdmissionForTests(input: {
  pinned: VerifiedKaqPinnedContext;
  allowedSourcePrefixes: readonly string[];
  resourceOrKaqSupportedCanonicalIds: readonly string[];
  projectionId: string;
  releasePublicationState?: AggregateReleasePublicationState;
  projectedCanonicalIds?: readonly string[];
  accessibleResourceIds?: readonly string[];
  projectedResourceBindings?: readonly {
    canonicalId: string;
    resourceId: string;
  }[];
  requireProjectionBoundResourceIdentity?: boolean;
}): VerifiedLearningFactAdmission {
  assertTestOnly('mintFormalWriteLearningFactAdmissionForTests');
  return mintAdmission({
    mode: 'FORMAL_WRITE',
    productionWriteAuthorized: true,
    pinned: input.pinned,
    resourceOrKaqSupportedCanonicalIds: input.resourceOrKaqSupportedCanonicalIds,
    allowedSourcePrefixes: input.allowedSourcePrefixes,
    projectionId: input.projectionId,
    releasePublicationState: input.releasePublicationState ?? 'ACTIVE',
    projectedCanonicalIds: input.projectedCanonicalIds,
    accessibleResourceIds: input.accessibleResourceIds,
    projectedResourceBindings: input.projectedResourceBindings,
    requireProjectionBoundResourceIdentity:
      input.requireProjectionBoundResourceIdentity,
  });
}

export function mintCanonicalLearningFactWriteCapabilityForTests(input: {
  pinned: VerifiedKaqPinnedContext;
  allowedSourcePrefixes: readonly string[];
  resourceOrKaqSupportedCanonicalIds: readonly string[];
  projectionId: string;
  releasePublicationState?: AggregateReleasePublicationState;
  projectedCanonicalIds?: readonly string[];
  accessibleResourceIds?: readonly string[];
  projectedResourceBindings?: readonly {
    canonicalId: string;
    resourceId: string;
  }[];
  requireProjectionBoundResourceIdentity?: boolean;
}): CanonicalLearningFactWriteCapability {
  assertTestOnly('mintCanonicalLearningFactWriteCapabilityForTests');
  const selector = mintCanonicalLearningFactSelectorForTests();
  const admission = mintFormalWriteLearningFactAdmissionForTests(input);
  const capability = {
    schemaVersion: CANONICAL_LEARNING_FACT_WRITE_CAPABILITY_VERSION,
    selector,
    admission,
  } as CanonicalLearningFactWriteCapability;
  return sealRegister(capability, WRITE_CAPABILITY_BRAND, WRITE_CAPABILITY_REGISTRY);
}

export type { LearningFactAuthorityConsumer, LearningFactAuthorityMode };
