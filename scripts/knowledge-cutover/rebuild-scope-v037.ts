#!/usr/bin/env tsx
/** Rebuild the v0.37 ACT teaching scope and reseal its shared allocation. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAuthorityDomainCatalog,
  verifyAuthorityDomainCatalogRuntime,
} from '@/lib/authority-domain-catalog/builder';
import type {
  AuthorityDomainCatalogAuthoring,
  AuthorityNodeEndpoint,
} from '@/lib/authority-domain-catalog/contracts';
import {
  assertScopeIntegrity,
  deriveActTeachingScope,
} from '@/lib/act-canonical-teaching-relations/scope';
import type { ActTeachingScope } from '@/lib/act-canonical-teaching-relations/contracts';
import {
  reopenRemediationAllocation,
  sealRemediationAllocation,
  type RemediationAllocation,
} from '@/lib/formal-resource-remediation/allocation';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';

const ROOT = process.cwd();
const RELEASE_DIR = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37';
const OLD_SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.22/scope.json';
const OLD_CATALOG_PATH = 'course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22/catalog.json';
const CROSSWALK_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/20260823-asr-batch/crosswalk-v037.json';
const ASSIGNMENT_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/v037-new-member-domain-assignment/assignments.jsonl';
const OLD_ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/v037-allocation.json';
const OUT_DIR = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37';
const OUT_SCOPE_PATH = `${OUT_DIR}/scope.json`;
const OUT_PENDING_PATH = `${OUT_DIR}/pending.jsonl`;
const OUT_ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';
const OUT_LINEAGE_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-lineage.json';

const OLD_ALLOCATION_HASH = '343025dacc8148a6ae50dd3eb1c156978eaa2b81bd9a93d3decc6fc52ad15f45';
const FAMILIES = ['containment', 'prerequisite', 'association'] as const;
const REASONS = {
  containment: 'no-explicit-parent-or-root-evidence',
  prerequisite: 'awaiting-qualified-item-evidence',
  association: 'awaiting-qualified-item-evidence',
} as const;

interface V037Release {
  readonly id: string;
  readonly release_hash: string;
  readonly release_version: string;
  readonly schema_version: string;
}

interface V037Bundle {
  readonly bundle_digest: string;
  readonly bundle_contract_version: string;
}

interface Crosswalk {
  readonly entries: Record<string, { readonly domain?: string }>;
  readonly memberCount: number;
}

interface Assignment {
  readonly canonicalId: string;
  readonly domainId: string;
}

interface OldAllocation {
  readonly allocationHash: string;
  readonly sealedAt: string;
  readonly captureHash: string;
  readonly compatibilityClassification: 'COMPATIBLE' | 'ADAPTATION_REQUIRED';
  readonly denominatorHash: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly implementationIdentities: Readonly<Record<string, string>>;
  readonly remediation: {
    readonly terminologyRegistryId: string;
    readonly localeIdentity: string;
    readonly sourceRegistryIds: readonly string[];
    readonly processorRegistryHash: string;
    readonly courseOwnerId: string;
  };
}

function absolute(relativePath: string): string {
  return path.join(ROOT, relativePath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8')) as T;
}

function sha256File(relativePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(relativePath))).digest('hex');
}

function writeImmutable(relativePath: string, content: string): 'created' | 'skipped' {
  const filePath = absolute(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing !== content) {
      throw new Error(`refusing to overwrite immutable artifact ${filePath}`);
    }
    return 'skipped';
  }
  writeFileSync(filePath, content);
  return 'created';
}

function sortedDomainIds(domainIds: readonly string[]): string[] {
  return [...domainIds].sort((a, b) => a.localeCompare(b));
}

function buildV037Scope(): {
  readonly scope: ActTeachingScope;
  readonly catalogId: string;
  readonly catalogHash: string;
  readonly releaseSetId: string;
  readonly oldMemberCount: number;
  readonly newMemberCount: number;
} {
  const release = readJson<V037Release>(`${RELEASE_DIR}/release.json`);
  const bundle = readJson<V037Bundle>(`${RELEASE_DIR}/bundle-manifest.json`);
  const oldScope = readJson<ActTeachingScope>(OLD_SCOPE_PATH);
  const oldCatalog = readJson<AuthorityDomainCatalogAuthoring>(OLD_CATALOG_PATH);
  const crosswalk = readJson<Crosswalk>(CROSSWALK_PATH);
  const assignments = readFileSync(absolute(ASSIGNMENT_PATH), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Assignment);

  if (release.id !== 'ctr:release:control-theory-engineering-v0.37') {
    throw new Error(`unexpected v0.37 release id: ${release.id}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(release.release_hash)) {
    throw new Error('v0.37 release_hash is not a SHA-256 digest');
  }
  if (crosswalk.memberCount !== 7476 || Object.keys(crosswalk.entries).length !== 7476) {
    throw new Error('v0.37 crosswalk must contain exactly 7476 entries');
  }
  if (oldScope.members.length !== 7300) {
    throw new Error('v0.22 scope must contain exactly 7300 members');
  }

  const oldMembers = new Map(oldScope.members.map((member) => [member.canonicalId, member]));
  const assignmentMap = new Map(assignments.map((row) => [row.canonicalId, row.domainId]));
  if (assignmentMap.size !== assignments.length) {
    throw new Error('v0.37 new-member assignments contain duplicate canonical ids');
  }
  const newIds = Object.keys(crosswalk.entries).filter((id) => !oldMembers.has(id));
  if (newIds.length !== 176 || assignmentMap.size !== 176) {
    throw new Error(`expected 176 new members and assignments, got ${newIds.length}/${assignmentMap.size}`);
  }
  for (const id of newIds) {
    if (!assignmentMap.has(id)) throw new Error(`missing domain assignment for ${id}`);
  }
  for (const id of assignmentMap.keys()) {
    if (oldMembers.has(id) || !crosswalk.entries[id]) {
      throw new Error(`assignment ${id} is not a v0.37-only crosswalk member`);
    }
  }

  const memberships = Object.keys(crosswalk.entries)
    .sort((a, b) => a.localeCompare(b))
    .map((canonicalId) => {
      const old = oldMembers.get(canonicalId);
      if (old) {
        return {
          canonicalId,
          domainIds: sortedDomainIds(old.domainIds),
          preferredDomainId: old.preferredDomainId,
        };
      }
      const domainId = assignmentMap.get(canonicalId);
      if (!domainId) throw new Error(`no domain for new member ${canonicalId}`);
      return { canonicalId, domainIds: [domainId], preferredDomainId: domainId };
    });

  const snapshotHash = release.release_hash;
  const snapshotId = `snap-${snapshotHash}`;
  const releaseSetId = `actkg-authority-candidate-v037-${bundle.bundle_digest}`;
  const authorityBinding = {
    releaseId: release.id,
    releaseSetId,
    snapshotHash,
    snapshotId,
  };
  const authoring: AuthorityDomainCatalogAuthoring = {
    ...oldCatalog,
    catalogVersion: 'v0.37-candidate',
    authorityBinding,
    memberships,
  };
  const domainProjection = readJson<{ readonly nodes: readonly Record<string, unknown>[] }>(
    `${RELEASE_DIR}/domain-projection.json`,
  );
  const authorityNodes: AuthorityNodeEndpoint[] = domainProjection.nodes.map((node) => {
    const canonicalId = typeof node.id === 'string' ? node.id : node.entity_id;
    if (typeof canonicalId !== 'string') throw new Error('v0.37 domain node has no canonical id');
    return { canonicalId };
  });
  if (authorityNodes.length !== 7476) throw new Error('v0.37 domain projection must contain 7476 nodes');

  const catalog = buildAuthorityDomainCatalog(authoring, authorityNodes);
  verifyAuthorityDomainCatalogRuntime(catalog);
  const scope = deriveActTeachingScope({
    courseId: oldScope.courseId,
    catalog,
    authority: {
      releaseId: release.id,
      snapshotId,
      snapshotHash,
      releaseSetId,
    },
  });
  assertScopeIntegrity(scope);
  return {
    scope,
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    releaseSetId,
    oldMemberCount: oldScope.members.length,
    newMemberCount: newIds.length,
  };
}

function writeScopeAndPending(scope: ActTeachingScope): { scopeState: string; pendingState: string } {
  const scopeArtifact = { ...scope, memberCount: scope.members.length };
  const scopeContent = `${JSON.stringify(scopeArtifact, null, 1)}\n`;
  const pendingContent = scope.members
    .flatMap((member) => FAMILIES.map((family) => JSON.stringify({
      canonicalId: member.canonicalId,
      family,
      kind: 'PENDING_REVIEW',
      reason: REASONS[family],
      scopeHash: scope.scopeHash,
    })))
    .join('\n') + '\n';
  const reopened = reopenScopeArtifact({
    courseId: scope.courseId,
    scope: scopeArtifact,
    expectedAuthorityReleaseId: scope.authority.releaseId,
    expectedAuthoritySnapshotHash: scope.authority.snapshotHash,
  });
  if (reopened.memberCount !== 7476) throw new Error('reopened v0.37 scope member count is not 7476');
  const scopeState = writeImmutable(OUT_SCOPE_PATH, scopeContent);
  const pendingState = writeImmutable(OUT_PENDING_PATH, pendingContent);
  return { scopeState, pendingState };
}

function resealAllocation(scopeHash: string): {
  readonly allocation: RemediationAllocation;
  readonly state: string;
} {
  const oldAllocation = readJson<OldAllocation>(OLD_ALLOCATION_PATH);
  if (oldAllocation.allocationHash !== OLD_ALLOCATION_HASH) {
    throw new Error(`unexpected old allocation hash ${oldAllocation.allocationHash}`);
  }
  const existingPath = absolute(OUT_ALLOCATION_PATH);
  if (existsSync(existingPath)) {
    const existing = JSON.parse(readFileSync(existingPath, 'utf8')) as RemediationAllocation;
    if (existing.scopeHash !== scopeHash || existing.captureHash !== oldAllocation.captureHash) {
      throw new Error('existing v0.37-scope allocation does not bind the rebuilt scope/capture');
    }
    reopenRemediationAllocation(existing);
    return { allocation: existing, state: 'skipped' };
  }
  const release = readJson<V037Release>(`${RELEASE_DIR}/release.json`);
  const schemaSha256 = sha256File(`${RELEASE_DIR}/ctkg.schema.json`);
  const bundle = readJson<V037Bundle>(`${RELEASE_DIR}/bundle-manifest.json`);
  const allocation = sealRemediationAllocation({
    sealedAt: oldAllocation.sealedAt,
    capture: {
      captureHash: oldAllocation.captureHash,
      compatibility: {
        contract: 'authority-adapter-compatibility/v1',
        adapterContractVersion: bundle.bundle_contract_version,
        classification: oldAllocation.compatibilityClassification,
        incompatibleReasons: [],
        captured: {
          schemaVersion: release.schema_version,
          schemaSha256,
          contractVersion: bundle.bundle_contract_version,
          requiredMembers: ['release', 'ctkg_schema'],
          profiles: ['runtime', 'domain'],
          representativeParse: 'COMPLETE',
        },
      },
    },
    scopeHash,
    denominatorHash: oldAllocation.denominatorHash,
    policyVersions: oldAllocation.policyVersions,
    implementationIdentities: {
      shared: oldAllocation.implementationIdentities.shared,
    },
    remediation: oldAllocation.remediation,
  });
  const state = writeImmutable(OUT_ALLOCATION_PATH, `${JSON.stringify(allocation, null, 1)}\n`);
  reopenRemediationAllocation(allocation);
  return { allocation, state };
}

function writeLineage(scopeHash: string, allocation: RemediationAllocation): string {
  const existingPath = absolute(OUT_LINEAGE_PATH);
  if (existsSync(existingPath)) {
    const existing = JSON.parse(readFileSync(existingPath, 'utf8')) as Record<string, unknown>;
    if (existing.oldAllocationHash !== OLD_ALLOCATION_HASH
      || existing.newAllocationHash !== allocation.allocationHash
      || existing.newScopeHash !== scopeHash) {
      throw new Error('allocation lineage does not match the immutable allocation chain');
    }
    return 'skipped';
  }
  const lineage = {
    contract: 'remediation-allocation-lineage/v1',
    recordedAt: new Date().toISOString(),
    oldAllocationHash: OLD_ALLOCATION_HASH,
    newAllocationHash: allocation.allocationHash,
    oldScopeHash: 'de83a516c13a46eb3fb31146247de2a886921bd7f2a82529b370d07f6d6825d1',
    newScopeHash: scopeHash,
    reason: 'resealed because the relation scope now covers the complete v0.37 capture member set',
    captureHash: allocation.captureHash,
  };
  return writeImmutable(OUT_LINEAGE_PATH, `${JSON.stringify(lineage, null, 1)}\n`);
}

function main(): void {
  const built = buildV037Scope();
  const scopeResult = writeScopeAndPending(built.scope);
  const allocationResult = resealAllocation(built.scope.scopeHash);
  const lineageState = writeLineage(built.scope.scopeHash, allocationResult.allocation);
  const pendingRows = built.scope.members.length * FAMILIES.length;
  console.log(JSON.stringify({
    scope: {
      path: OUT_SCOPE_PATH,
      scopeHash: built.scope.scopeHash,
      memberCount: built.scope.members.length,
      pendingPath: OUT_PENDING_PATH,
      pendingRows,
      scopeState: scopeResult.scopeState,
      pendingState: scopeResult.pendingState,
      catalogId: built.catalogId,
      catalogHash: built.catalogHash,
      authority: built.scope.authority,
      reopened: { memberCount: built.scope.members.length, scopeHash: built.scope.scopeHash },
    },
    continuity: {
      oldMemberCount: built.oldMemberCount,
      newMemberCount: built.newMemberCount,
      inheritedOldMembers: built.oldMemberCount,
    },
    allocation: {
      path: OUT_ALLOCATION_PATH,
      oldAllocationHash: OLD_ALLOCATION_HASH,
      newAllocationHash: allocationResult.allocation.allocationHash,
      scopeHash: allocationResult.allocation.scopeHash,
      denominatorHash: allocationResult.allocation.denominatorHash,
      captureHash: allocationResult.allocation.captureHash,
      state: allocationResult.state,
      lineageState,
    },
  }, null, 2));
}

main();
