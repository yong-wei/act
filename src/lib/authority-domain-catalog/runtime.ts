/**
 * Presentation-only root DTOs for the Authority domain display catalog (#1369).
 *
 * These entries never contribute to Authority object/relation/node/edge counts
 * and must not expose canonical object identifiers.
 */

import type {
  AggregateRootPresentationEntry,
  AuthorityDomainCatalogRuntime,
  AuthorityDomainRootPresentation,
  DomainRootPresentationEntry,
} from './contracts';
import { DomainCatalogBuildError } from './builder';

/**
 * Project the runtime catalog into a product-facing root presentation DTO.
 * Canonical memberships remain server-private and are not returned.
 */
export function buildAuthorityDomainRootPresentation(
  runtime: AuthorityDomainCatalogRuntime,
): AuthorityDomainRootPresentation {
  if (!runtime?.domains || !runtime.aggregate) {
    throw new DomainCatalogBuildError(
      'schema-invalid',
      'runtime catalog is incomplete for root presentation',
    );
  }

  const domains: DomainRootPresentationEntry[] = [...runtime.domains]
    .sort((a, b) => a.order - b.order)
    .map((domain) => ({
      kind: 'presentation-domain' as const,
      order: domain.order,
      displayName: domain.displayName,
      summary: domain.summary,
      presentationRole: 'domain' as const,
      visualRole: domain.visualRole,
      memberCount: domain.memberCount,
    }));

  const aggregate: AggregateRootPresentationEntry = {
    kind: 'presentation-aggregate',
    order: runtime.aggregate.order,
    displayName: runtime.aggregate.displayName,
    summary: runtime.aggregate.summary,
    presentationRole: 'aggregate',
    visualRole: 'aggregate',
    domainCount: runtime.aggregate.domainCount,
  };

  return {
    kind: 'presentation-root-catalog',
    domains,
    aggregate,
  };
}

/**
 * Server-private preferred-domain lookup for deep-link resolution.
 * Returns null when the object is not a reviewed catalog member.
 */
export function resolvePreferredNavigationDomain(
  runtime: AuthorityDomainCatalogRuntime,
  canonicalId: string,
): {
  preferredDomainId: string;
  domainIds: readonly string[];
} | null {
  const membership = runtime.memberships.find((m) => m.canonicalId === canonicalId);
  if (!membership) return null;
  return {
    preferredDomainId: membership.preferredDomainId,
    domainIds: membership.domainIds,
  };
}

/**
 * Assert a presentation DTO never carries Authority identity or topology counts.
 * Used by tests and fail-closed API guards.
 */
export function assertRootPresentationExcludesAuthorityIdentity(
  root: AuthorityDomainRootPresentation,
): void {
  const serialized = JSON.stringify(root);
  if (/"canonicalId"\s*:/u.test(serialized)) {
    throw new DomainCatalogBuildError(
      'presentation-leaks-canonical-id',
      'root presentation DTO must not include canonicalId',
    );
  }
  if (
    /"snapshotId"\s*:|"snapshotHash"\s*:|"releaseId"\s*:|"releaseHash"\s*:|"catalogId"\s*:|"navigationKey"\s*:/u.test(
      serialized,
    )
  ) {
    throw new DomainCatalogBuildError(
      'presentation-leaks-authority-identity',
      'root presentation DTO must not include Authority or catalog identity fields',
    );
  }
  if (
    /"objectCount"\s*:|"relationCount"\s*:|"nodeCount"\s*:|"edgeCount"\s*:/u.test(serialized)
  ) {
    throw new DomainCatalogBuildError(
      'presentation-leaks-authority-counts',
      'root presentation DTO must not contribute Authority topology counts',
    );
  }
  if (root.kind !== 'presentation-root-catalog') {
    throw new DomainCatalogBuildError(
      'presentation-kind-invalid',
      'root presentation kind must be presentation-root-catalog',
    );
  }
  for (const domain of root.domains) {
    if (domain.kind !== 'presentation-domain' || domain.presentationRole !== 'domain') {
      throw new DomainCatalogBuildError(
        'presentation-domain-kind-invalid',
        'domain entries must be presentation-only',
      );
    }
  }
  if (
    root.aggregate.kind !== 'presentation-aggregate'
    || root.aggregate.presentationRole !== 'aggregate'
  ) {
    throw new DomainCatalogBuildError(
      'presentation-aggregate-kind-invalid',
      'aggregate entry must remain presentation-only',
    );
  }
}
