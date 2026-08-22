import type { AuthorityDomainCatalogRuntime } from '@/lib/authority-domain-catalog/contracts';
import { AGGREGATE_ENTRY_ID } from '@/lib/authority-domain-catalog/contracts';

import {
  ACT_TEACHING_COURSE_ID,
  ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT,
  ACT_TEACHING_SCOPE_CONTRACT,
  type ActTeachingAuthorityIdentity,
  type ActTeachingMember,
  type ActTeachingScope,
} from './contracts';
import { ActTeachingRelationError, projectionDigest, sortedUnique } from './hash';

export interface DeriveActTeachingScopeInput {
  readonly courseId?: string;
  readonly catalog: AuthorityDomainCatalogRuntime;
  readonly authority: ActTeachingAuthorityIdentity;
  /** Optional extra ids that must never enter the denominator (navigation, resources). */
  readonly excludedIds?: readonly string[];
}

function assertAuthorityMatchesCatalog(
  catalog: AuthorityDomainCatalogRuntime,
  authority: ActTeachingAuthorityIdentity,
): void {
  const binding = catalog.authorityBinding;
  if (
    binding.releaseId !== authority.releaseId
    || binding.snapshotId !== authority.snapshotId
    || binding.snapshotHash !== authority.snapshotHash
  ) {
    throw new ActTeachingRelationError(
      'mixed-authority-identity',
      'catalog Authority identity does not match the governance envelope',
    );
  }
  if (binding.releaseSetId && binding.releaseSetId !== authority.releaseSetId) {
    throw new ActTeachingRelationError(
      'mixed-authority-identity',
      'catalog releaseSetId does not match the governance envelope',
    );
  }
}

export function deriveActTeachingScope(input: DeriveActTeachingScopeInput): ActTeachingScope {
  assertAuthorityMatchesCatalog(input.catalog, input.authority);
  const excluded = new Set(input.excludedIds ?? []);
  excluded.add(AGGREGATE_ENTRY_ID);
  for (const domain of input.catalog.domains) {
    excluded.add(domain.domainId);
  }

  const membersById = new Map<string, ActTeachingMember>();
  for (const row of input.catalog.memberships) {
    if (!row.canonicalId || excluded.has(row.canonicalId)) {
      continue;
    }
    if (row.canonicalId === AGGREGATE_ENTRY_ID) {
      throw new ActTeachingRelationError(
        'navigation-in-denominator',
        'aggregate navigation entry cannot enter the teaching-relation denominator',
      );
    }
    const existing = membersById.get(row.canonicalId);
    const domainIds = sortedUnique([
      ...(existing?.domainIds ?? []),
      ...row.domainIds,
    ]);
    membersById.set(row.canonicalId, {
      canonicalId: row.canonicalId,
      domainIds,
      preferredDomainId: existing?.preferredDomainId ?? row.preferredDomainId,
    });
  }

  const members = [...membersById.values()].sort((a, b) => (
    a.canonicalId.localeCompare(b.canonicalId)
  ));
  const memberIds = members.map((member) => member.canonicalId);
  const courseId = input.courseId ?? ACT_TEACHING_COURSE_ID;
  const catalogSelection = {
    catalogId: input.catalog.catalogId,
    catalogHash: input.catalog.catalogHash,
    catalogVersion: input.catalog.catalogVersion,
  };
  const scopeHash = hashActTeachingScope({
    courseId,
    authority: input.authority,
    catalog: catalogSelection,
    contractVersion: ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT,
    members,
  });

  return {
    contract: ACT_TEACHING_SCOPE_CONTRACT,
    courseId,
    authority: input.authority,
    catalog: catalogSelection,
    contractVersion: ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT,
    members,
    memberIds,
    scopeHash,
  };
}

export function hashActTeachingScope(input: {
  courseId: string;
  authority: ActTeachingAuthorityIdentity;
  catalog: ActTeachingScope['catalog'];
  contractVersion: typeof ACT_TEACHING_RELATION_GOVERNANCE_CONTRACT;
  members: readonly ActTeachingMember[];
}): string {
  return projectionDigest({
    contract: ACT_TEACHING_SCOPE_CONTRACT,
    courseId: input.courseId,
    authority: input.authority,
    catalog: input.catalog,
    contractVersion: input.contractVersion,
    members: [...input.members]
      .map((member) => ({
        canonicalId: member.canonicalId,
        domainIds: sortedUnique(member.domainIds),
        preferredDomainId: member.preferredDomainId,
      }))
      .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
  });
}

export function assertScopeIntegrity(scope: ActTeachingScope): void {
  const expectedHash = hashActTeachingScope({
    courseId: scope.courseId,
    authority: scope.authority,
    catalog: scope.catalog,
    contractVersion: scope.contractVersion,
    members: scope.members,
  });
  if (scope.scopeHash !== expectedHash) {
    throw new ActTeachingRelationError(
      'scope-drift',
      'scope hash does not match normalized member/domain content',
    );
  }
  const expectedIds = [...scope.members]
    .map((member) => member.canonicalId)
    .sort((a, b) => a.localeCompare(b));
  const actualIds = [...scope.memberIds].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
    throw new ActTeachingRelationError(
      'scope-drift',
      'memberIds drifted from scope members',
    );
  }
}

export function assertSameScope(expected: ActTeachingScope, actual: ActTeachingScope): void {
  assertScopeIntegrity(expected);
  assertScopeIntegrity(actual);
  if (expected.scopeHash !== actual.scopeHash) {
    throw new ActTeachingRelationError(
      'scope-drift',
      'teaching-relation scope hash drifted; prior decisions cannot be reused',
    );
  }
}
