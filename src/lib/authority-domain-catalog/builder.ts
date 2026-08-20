/**
 * Deterministic Authority domain display catalog builder (#1369).
 *
 * Authoring → validated runtime catalog. Never mutates ActKG artifacts.
 */

import {
  AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION,
  AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityDomainCatalogRuntime,
  type AuthorityNodeEndpoint,
  type DomainMembershipRuntime,
  type DomainPresentationRuntime,
  type RegisteredPeerDomainId,
} from './contracts';
import { catalogDigest, isSha256Hex } from './hash';
import {
  DomainCatalogValidationError,
  sortDomainIds,
  validateAuthorityDomainCatalogAuthoring,
} from './validate';

export class DomainCatalogBuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainCatalogBuildError';
    this.code = code;
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: readonly T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function catalogIdFromHash(catalogHash: string): string {
  if (!isSha256Hex(catalogHash)) {
    throw new DomainCatalogBuildError(
      'catalog-hash-invalid',
      'catalogHash must be 64 lowercase hexadecimal characters',
    );
  }
  return `adc-${catalogHash}`;
}

/**
 * Build a read-only runtime catalog from reviewed authoring + Authority endpoints.
 * Semantic-equivalent reordering of domains/memberships produces the same hash.
 */
export function buildAuthorityDomainCatalog(
  authoring: AuthorityDomainCatalogAuthoring,
  authorityNodes: readonly AuthorityNodeEndpoint[],
): AuthorityDomainCatalogRuntime {
  try {
    validateAuthorityDomainCatalogAuthoring(authoring, authorityNodes);
  } catch (error) {
    if (error instanceof DomainCatalogValidationError) {
      throw new DomainCatalogBuildError(error.code, error.message);
    }
    throw error;
  }

  const domainsSortedById = sortBy(authoring.domains, (d) => d.domainId);
  const membershipsSorted = sortBy(authoring.memberships, (m) => m.canonicalId).map(
    (membership): DomainMembershipRuntime => ({
      canonicalId: membership.canonicalId,
      domainIds: sortDomainIds(membership.domainIds),
      preferredDomainId: membership.preferredDomainId,
    }),
  );

  const memberCounts = new Map<RegisteredPeerDomainId, number>(
    authoring.domains.map((domain) => [domain.domainId, 0]),
  );
  for (const membership of membershipsSorted) {
    for (const domainId of membership.domainIds) {
      memberCounts.set(domainId, (memberCounts.get(domainId) ?? 0) + 1);
    }
  }

  // Presentation order is the reviewed domain order (not alphabetical).
  const domainsByOrder = [...authoring.domains].sort((a, b) => a.order - b.order);
  const domains: DomainPresentationRuntime[] = domainsByOrder.map((domain) => ({
    domainId: domain.domainId,
    order: domain.order,
    displayName: domain.displayName,
    summary: domain.summary,
    presentationRole: 'domain',
    visualRole: domain.visualRole,
    memberCount: memberCounts.get(domain.domainId) ?? 0,
  }));

  const body = {
    contract: AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT,
    catalogVersion: authoring.catalogVersion,
    builderVersion: AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION,
    authorityBinding: {
      snapshotId: authoring.authorityBinding.snapshotId,
      snapshotHash: authoring.authorityBinding.snapshotHash,
      releaseId: authoring.authorityBinding.releaseId,
      releaseSetId: authoring.authorityBinding.releaseSetId ?? null,
    },
    // Hash uses domain-id order so presentation order reordering of the same
    // domain set does not change identity; memberships are always sorted.
    domains: domainsSortedById.map((domain) => ({
      domainId: domain.domainId,
      order: domain.order,
      displayName: domain.displayName,
      summary: domain.summary,
      presentationRole: 'domain' as const,
      visualRole: domain.visualRole,
      memberCount: memberCounts.get(domain.domainId) ?? 0,
    })),
    aggregate: {
      entryId: authoring.aggregate.entryId,
      order: authoring.aggregate.order,
      displayName: authoring.aggregate.displayName,
      summary: authoring.aggregate.summary,
      presentationRole: 'aggregate' as const,
      visualRole: 'aggregate' as const,
      domainCount: authoring.domains.length,
    },
    memberships: membershipsSorted,
  };

  const catalogHash = catalogDigest(body);
  const catalogId = catalogIdFromHash(catalogHash);

  return {
    contract: AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT,
    catalogId,
    catalogHash,
    catalogVersion: authoring.catalogVersion,
    builderVersion: AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION,
    authorityBinding: body.authorityBinding,
    domains,
    aggregate: body.aggregate,
    memberships: membershipsSorted,
  };
}

/** Recompute catalogHash over the stable body and verify identity fields. */
export function verifyAuthorityDomainCatalogRuntime(
  runtime: AuthorityDomainCatalogRuntime,
): void {
  if (runtime.contract !== AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT) {
    throw new DomainCatalogBuildError(
      'schema-invalid',
      `unsupported runtime contract ${String(runtime.contract)}`,
    );
  }
  if (runtime.builderVersion !== AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION) {
    throw new DomainCatalogBuildError(
      'builder-version-mismatch',
      `unexpected builderVersion ${String(runtime.builderVersion)}`,
    );
  }
  if (!isSha256Hex(runtime.catalogHash)) {
    throw new DomainCatalogBuildError('catalog-hash-invalid', 'catalogHash is not valid sha256');
  }
  if (runtime.catalogId !== catalogIdFromHash(runtime.catalogHash)) {
    throw new DomainCatalogBuildError(
      'catalog-id-mismatch',
      'catalogId does not match catalogHash',
    );
  }

  if (runtime.domains.length === 0) {
    throw new DomainCatalogBuildError(
      'domain-set-size-invalid',
      'runtime must contain at least one peer domain',
    );
  }
  const domainIds = new Set(runtime.domains.map((d) => d.domainId));
  if (domainIds.size !== runtime.domains.length) {
    throw new DomainCatalogBuildError(
      'domain-set-incomplete',
      'runtime peer domain identities must be unique',
    );
  }
  if (domainIds.has(runtime.aggregate.entryId as never)) {
    throw new DomainCatalogBuildError(
      'aggregate-promoted-to-peer',
      'aggregate must not appear among peer domains',
    );
  }
  if (runtime.aggregate.domainCount !== runtime.domains.length) {
    throw new DomainCatalogBuildError(
      'aggregate-domain-count-invalid',
      'aggregate.domainCount must equal the peer domain count',
    );
  }
  if (runtime.aggregate.presentationRole !== 'aggregate') {
    throw new DomainCatalogBuildError(
      'aggregate-role-invalid',
      'aggregate presentationRole must remain aggregate',
    );
  }

  const body = {
    contract: runtime.contract,
    catalogVersion: runtime.catalogVersion,
    builderVersion: runtime.builderVersion,
    authorityBinding: runtime.authorityBinding,
    domains: sortBy(runtime.domains, (d) => d.domainId).map((domain) => ({
      domainId: domain.domainId,
      order: domain.order,
      displayName: domain.displayName,
      summary: domain.summary,
      presentationRole: domain.presentationRole,
      visualRole: domain.visualRole,
      memberCount: domain.memberCount,
    })),
    aggregate: runtime.aggregate,
    memberships: sortBy(runtime.memberships, (m) => m.canonicalId).map((membership) => ({
      canonicalId: membership.canonicalId,
      domainIds: sortDomainIds(membership.domainIds),
      preferredDomainId: membership.preferredDomainId,
    })),
  };
  const expectedHash = catalogDigest(body);
  if (expectedHash !== runtime.catalogHash) {
    throw new DomainCatalogBuildError(
      'catalog-hash-mismatch',
      'runtime catalogHash does not match recomputed digest',
    );
  }
}
