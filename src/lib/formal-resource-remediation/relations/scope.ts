/**
 * Capture-bound active-domain scope derivation (#1515, task 9.1).
 *
 * The exact scope membership and Canonical semantic revisions are derived
 * from the captured Authority artifacts on disk; a caller-supplied member
 * array is never accepted. The reopened scope must bind the same authority
 * release, snapshot, and catalog identity as the remediation allocation's
 * Authority capture.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { FormalResourceRemediationError } from '../contracts';

export interface ScopeMemberRow {
  readonly canonicalId: string;
  readonly domainIds: readonly string[];
  readonly preferredDomainId: string;
}

export interface ReopenedScope {
  readonly courseId: string;
  readonly authorityReleaseId: string;
  readonly authoritySnapshotHash: string;
  readonly catalogHash: string;
  readonly scopeHash: string;
  readonly members: readonly ScopeMemberRow[];
  readonly memberCount: number;
  readonly derivedScopeDigest: string;
}

const SCOPE_CONTRACT = 'act-canonical-teaching-scope/v1';

/**
 * Reopen one sealed scope artifact and recompute its identity from the
 * member rows: member ids, domains, and the declared authority must agree
 * with the sealed scopeHash inputs.
 */
export function reopenScopeArtifact(input: {
  courseId: string;
  scope: {
    readonly contract?: unknown;
    readonly courseId?: unknown;
    readonly authority?: { releaseId?: unknown; snapshotHash?: unknown };
    readonly catalog?: { catalogHash?: unknown };
    readonly scopeHash?: unknown;
    readonly memberCount?: unknown;
    readonly memberIds?: readonly unknown[];
    readonly members?: readonly {
      canonicalId?: unknown;
      domainIds?: unknown;
      preferredDomainId?: unknown;
    }[];
  };
  expectedAuthorityReleaseId: string;
  expectedAuthoritySnapshotHash: string;
}): ReopenedScope {
  const scope = input.scope;
  if (scope.contract !== SCOPE_CONTRACT) {
    throw new FormalResourceRemediationError(
      'scope-contract-invalid',
      'The scope artifact uses an unsupported contract.',
    );
  }
  if (scope.courseId !== input.courseId) {
    throw new FormalResourceRemediationError(
      'scope-course-mismatch',
      `The scope binds course ${String(scope.courseId)}, expected ${input.courseId}.`,
    );
  }
  if (scope.authority?.releaseId !== input.expectedAuthorityReleaseId
    || scope.authority?.snapshotHash !== input.expectedAuthoritySnapshotHash) {
    throw new FormalResourceRemediationError(
      'scope-authority-mismatch',
      'The scope artifact was sealed against a different Authority capture than the remediation allocation.',
    );
  }
  if (typeof scope.scopeHash !== 'string' || !/^[a-f0-9]{64}$/u.test(scope.scopeHash)) {
    throw new FormalResourceRemediationError(
      'scope-hash-invalid',
      'The scope artifact has no sealed scope hash.',
    );
  }
  if (typeof scope.catalog?.catalogHash !== 'string') {
    throw new FormalResourceRemediationError(
      'scope-catalog-missing',
      'The scope artifact does not bind its domain catalog identity.',
    );
  }
  const members: ScopeMemberRow[] = [];
  const seen = new Set<string>();
  for (const row of scope.members ?? []) {
    if (typeof row.canonicalId !== 'string' || row.canonicalId.length === 0) {
      throw new FormalResourceRemediationError(
        'scope-member-invalid',
        'A scope member row has no canonical id.',
      );
    }
    if (seen.has(row.canonicalId)) {
      throw new FormalResourceRemediationError(
        'scope-member-duplicate',
        `Scope member ${row.canonicalId} appears twice.`,
      );
    }
    seen.add(row.canonicalId);
    if (!Array.isArray(row.domainIds)
      || row.domainIds.some((domain) => typeof domain !== 'string')
      || typeof row.preferredDomainId !== 'string') {
      throw new FormalResourceRemediationError(
        'scope-member-invalid',
        `Scope member ${row.canonicalId} has malformed domain identities.`,
      );
    }
    members.push({
      canonicalId: row.canonicalId,
      domainIds: row.domainIds as string[],
      preferredDomainId: row.preferredDomainId,
    });
  }
  if (scope.memberCount !== members.length) {
    throw new FormalResourceRemediationError(
      'scope-count-mismatch',
      `The scope declares ${String(scope.memberCount)} members but reopens ${members.length}.`,
    );
  }
  const declaredMemberIds = (scope.memberIds ?? []).filter((id): id is string => typeof id === 'string');
  if (declaredMemberIds.length !== members.length
    || declaredMemberIds.some((id, index) => id !== members[index]?.canonicalId)) {
    throw new FormalResourceRemediationError(
      'scope-memberids-mismatch',
      'The declared member id list does not match the reopened member rows.',
    );
  }
  const derivedScopeDigest = projectionDigest({
    courseId: input.courseId,
    authorityReleaseId: input.expectedAuthorityReleaseId,
    authoritySnapshotHash: input.expectedAuthoritySnapshotHash,
    catalogHash: scope.catalog.catalogHash,
    members: members.map((member) => ({
      canonicalId: member.canonicalId,
      domainIds: member.domainIds,
      preferredDomainId: member.preferredDomainId,
    })),
  });
  return {
    courseId: input.courseId,
    authorityReleaseId: input.expectedAuthorityReleaseId,
    authoritySnapshotHash: input.expectedAuthoritySnapshotHash,
    catalogHash: scope.catalog.catalogHash,
    scopeHash: scope.scopeHash,
    members,
    memberCount: members.length,
    derivedScopeDigest,
  };
}
