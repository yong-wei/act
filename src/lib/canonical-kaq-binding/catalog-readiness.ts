/**
 * KAQ catalog Canonical binding readiness (#1113).
 *
 * Exposes readiness for migration review without changing the formal consumer
 * authority selector (always LEGACY before cutover).
 */

import {
  assertVerifiedKaqPinnedContext,
  type VerifiedKaqPinnedContext,
} from './authority-capability';
import {
  CANONICAL_KAQ_BINDING_SCHEMA_VERSION,
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  type KaqCanonicalBinding,
  type KaqCatalogBindingReadiness,
  type KaqCatalogBindingReadinessRole,
} from './contracts';
import { markStaleKaqBindings } from './bindings';

export function evaluateKaqCatalogCanonicalReadiness(input: {
  /** Knowledge roles intended for post-cutover formal consumption. */
  intendedRoleIds: readonly string[];
  bindings: readonly KaqCanonicalBinding[];
  pinned: VerifiedKaqPinnedContext;
}): KaqCatalogBindingReadiness {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  const refreshed = markStaleKaqBindings(input.bindings, pinned);
  const roles: KaqCatalogBindingReadinessRole[] = input.intendedRoleIds.map((roleId) => {
    const roleBindings = refreshed.filter((binding) => binding.kaqRoleId === roleId);
    const reasonCodes: KaqCatalogBindingReadinessRole['reasonCodes'] = [];
    const accepted = roleBindings.filter((binding) => (
      binding.lifecycleState === 'CURRENT'
      && binding.reviewState === 'ACCEPTED'
      && binding.authorityState === 'SHADOW'
      && binding.pinnedContextDigest === pinned.contextDigest
      && binding.releaseSetId === pinned.releaseSetId
      && binding.releaseId === pinned.releaseId
      && pinned.admittedCanonicalIds.includes(binding.canonicalId)
    ));

    if (roleBindings.length === 0) {
      reasonCodes.push('binding-missing');
    } else if (accepted.length === 0) {
      const stale = roleBindings.some((binding) => binding.reviewState === 'STALE');
      const contextMismatch = roleBindings.some(
        (binding) => binding.pinnedContextDigest !== pinned.contextDigest,
      );
      const releaseMismatch = roleBindings.some(
        (binding) => (
          binding.releaseSetId !== PINNED_KAQ_AGGREGATE_RELEASE_SET_ID
          || binding.releaseId !== PINNED_KAQ_AGGREGATE_RELEASE_ID
        ),
      );
      const outside = roleBindings.some(
        (binding) => !pinned.admittedCanonicalIds.includes(binding.canonicalId),
      );
      if (stale) reasonCodes.push('binding-stale');
      if (contextMismatch) reasonCodes.push('pinned-context-mismatch');
      if (releaseMismatch) reasonCodes.push('release-not-pinned-aggregate');
      if (outside) reasonCodes.push('canonical-outside-coverage');
      if (reasonCodes.length === 0) reasonCodes.push('binding-not-accepted');
    }

    return {
      kaqRoleId: roleId,
      ready: accepted.length > 0 && reasonCodes.length === 0,
      reasonCodes,
      acceptedBindingIds: accepted.map((binding) => binding.id).sort(),
    };
  });

  return {
    schemaVersion: CANONICAL_KAQ_BINDING_SCHEMA_VERSION,
    ready: roles.length > 0 && roles.every((role) => role.ready),
    roles: roles.sort((a, b) => a.kaqRoleId.localeCompare(b.kaqRoleId)),
    formalConsumerAuthority: 'LEGACY',
    migrationReviewVisible: true,
    productionAuthoritative: false,
    authorityState: 'SHADOW',
  };
}

/**
 * Consumer projection for migration review / catalog validation.
 * Formal consumers must ignore this and keep Legacy identity.
 */
export interface KaqCanonicalConsumerProjection {
  catalogVersion: string;
  readiness: KaqCatalogBindingReadiness;
  formalAuthority: 'LEGACY';
  shadowBindingCount: number;
  acceptedBindingCount: number;
  productionAuthoritative: false;
}

export function projectKaqCatalogCanonicalBindingStatus(input: {
  catalogVersion: string;
  intendedRoleIds: readonly string[];
  bindings: readonly KaqCanonicalBinding[];
  pinned: VerifiedKaqPinnedContext;
}): KaqCanonicalConsumerProjection {
  const readiness = evaluateKaqCatalogCanonicalReadiness(input);
  const current = input.bindings.filter((binding) => binding.lifecycleState === 'CURRENT');
  return {
    catalogVersion: input.catalogVersion,
    readiness,
    formalAuthority: 'LEGACY',
    shadowBindingCount: current.length,
    acceptedBindingCount: current.filter((binding) => binding.reviewState === 'ACCEPTED').length,
    productionAuthoritative: false,
  };
}
