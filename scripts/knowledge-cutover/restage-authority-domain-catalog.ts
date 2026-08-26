#!/usr/bin/env tsx
/**
 * Re-stage a reviewed Authority domain catalog for a semantically identical
 * immutable snapshot. This is a bounded incremental operation: it reuses the
 * membership decisions only after the semantic cache proves that no Canonical
 * object or relation changed. It never writes the runtime current selector.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAuthorityDomainCatalog,
  verifyAuthorityDomainCatalogRuntime,
} from '@/lib/authority-domain-catalog/builder';
import type {
  AuthorityDomainCatalogAuthoring,
  AuthorityDomainCatalogRuntime,
} from '@/lib/authority-domain-catalog/contracts';
import {
  assertScopeIntegrity,
  deriveActTeachingScope,
} from '@/lib/act-canonical-teaching-relations/scope';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const DEFAULT_PREDECESSOR = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3/domain-catalog';
const DEFAULT_SUCCESSOR_SNAPSHOT = 'course-content/authoring/knowledge/authority/releases/snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';
const DEFAULT_SEMANTIC_CACHE = `${CANDIDATE_ROOT}/authority-semantic-cache.json`;
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/domain-catalog`;

interface SnapshotManifest {
  readonly releaseId: string;
  readonly releaseSetId: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
}

interface SemanticCache {
  readonly contract: 'authority-semantic-cache/v1';
  readonly predecessor: { readonly manifest: SnapshotManifest };
  readonly successor: { readonly manifest: SnapshotManifest };
  readonly summary: {
    readonly recomputedCount: number;
    readonly retiredCount: number;
  };
  readonly cacheHash: string;
}

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function value(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function requireRfc3339(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new Error('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
}

function immutableWrite(filePath: string, value: unknown): void {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite immutable artifact ${filePath}`);
    return;
  }
  writeFileSync(target, bytes);
}

function sameAuthority(left: SnapshotManifest, right: SnapshotManifest): boolean {
  return left.releaseId === right.releaseId
    && left.releaseSetId === right.releaseSetId
    && left.snapshotId === right.snapshotId
    && left.snapshotHash === right.snapshotHash;
}

function main(): void {
  const predecessorRoot = value('--predecessor', DEFAULT_PREDECESSOR);
  const successorSnapshotRoot = value('--successor-snapshot', DEFAULT_SUCCESSOR_SNAPSHOT);
  const semanticCachePath = value('--semantic-cache', DEFAULT_SEMANTIC_CACHE);
  const outputRoot = value('--out', DEFAULT_OUTPUT);
  const stagedAt = value('--staged-at', '');
  requireRfc3339(stagedAt);

  const predecessorAuthoring = readJson<AuthorityDomainCatalogAuthoring>(path.join(predecessorRoot, 'catalog-authoring.json'));
  const predecessorCatalog = readJson<AuthorityDomainCatalogRuntime>(path.join(predecessorRoot, 'catalog.json'));
  const predecessorScope = readJson<{ readonly scopeHash: string }>(path.join(predecessorRoot, 'scope.json'));
  const successorManifest = readJson<SnapshotManifest>(path.join(successorSnapshotRoot, 'manifest.json'));
  const semanticCache = readJson<SemanticCache>(semanticCachePath);
  if (semanticCache.contract !== 'authority-semantic-cache/v1'
    || semanticCache.summary.recomputedCount !== 0
    || semanticCache.summary.retiredCount !== 0
    || !sameAuthority(semanticCache.predecessor.manifest, predecessorAuthoring.authorityBinding)
    || !sameAuthority(semanticCache.successor.manifest, successorManifest)) {
    throw new Error('semantic cache does not prove a complete unchanged Authority re-stage');
  }

  const rebuiltPredecessor = buildAuthorityDomainCatalog(
    predecessorAuthoring,
    predecessorAuthoring.memberships.map((membership) => ({ canonicalId: membership.canonicalId })),
  );
  if (rebuiltPredecessor.catalogId !== predecessorCatalog.catalogId
    || rebuiltPredecessor.catalogHash !== predecessorCatalog.catalogHash) {
    throw new Error('predecessor catalog does not reopen from its reviewed authoring decisions');
  }
  const successorEngineering = readJson<{ readonly objects: readonly { readonly canonicalId: string }[] }>(
    path.join(successorSnapshotRoot, 'engineering.json'),
  );
  const authorityIds = successorEngineering.objects.map((row) => row.canonicalId).sort((left, right) => left.localeCompare(right));
  const membershipIds = predecessorAuthoring.memberships.map((row) => row.canonicalId).sort((left, right) => left.localeCompare(right));
  if (new Set(authorityIds).size !== authorityIds.length
    || new Set(membershipIds).size !== membershipIds.length
    || authorityIds.length !== membershipIds.length
    || authorityIds.some((canonicalId, index) => canonicalId !== membershipIds[index])) {
    throw new Error('reused membership decisions do not close over the successor Authority members');
  }

  const authoring: AuthorityDomainCatalogAuthoring = {
    ...predecessorAuthoring,
    catalogVersion: 'v0.37-r4-c4-candidate',
    authorityBinding: {
      releaseId: successorManifest.releaseId,
      releaseSetId: successorManifest.releaseSetId,
      snapshotId: successorManifest.snapshotId,
      snapshotHash: successorManifest.snapshotHash,
    },
  };
  const catalog = buildAuthorityDomainCatalog(
    authoring,
    authorityIds.map((canonicalId) => ({ canonicalId })),
  );
  verifyAuthorityDomainCatalogRuntime(catalog);
  const scope = deriveActTeachingScope({
    courseId: 'act-control-theory',
    catalog,
    authority: authoring.authorityBinding,
  });
  assertScopeIntegrity(scope);
  const current = {
    contract: 'act-authority-domain-display-catalog-current/v1',
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    snapshotId: successorManifest.snapshotId,
    snapshotHash: successorManifest.snapshotHash,
    releaseId: successorManifest.releaseId,
    activatedAt: stagedAt,
  } as const;
  const receipt = {
    contract: 'authority-domain-catalog-semantic-restage/v1',
    stagedAt,
    predecessorCatalogHash: predecessorCatalog.catalogHash,
    predecessorScopeHash: predecessorScope.scopeHash,
    successorCatalogHash: catalog.catalogHash,
    successorScopeHash: scope.scopeHash,
    semanticCacheHash: semanticCache.cacheHash,
    sourceInputs: [
      { path: `${predecessorRoot}/catalog-authoring.json`, sha256: sha256File(path.join(predecessorRoot, 'catalog-authoring.json')) },
      { path: `${predecessorRoot}/catalog.json`, sha256: sha256File(path.join(predecessorRoot, 'catalog.json')) },
      { path: `${predecessorRoot}/scope.json`, sha256: sha256File(path.join(predecessorRoot, 'scope.json')) },
      { path: semanticCachePath, sha256: sha256File(semanticCachePath) },
      { path: `${successorSnapshotRoot}/manifest.json`, sha256: sha256File(path.join(successorSnapshotRoot, 'manifest.json')) },
      { path: `${successorSnapshotRoot}/engineering.json`, sha256: sha256File(path.join(successorSnapshotRoot, 'engineering.json')) },
    ],
    receiptHash: projectionDigest({
      predecessorCatalogHash: predecessorCatalog.catalogHash,
      predecessorScopeHash: predecessorScope.scopeHash,
      successorCatalogHash: catalog.catalogHash,
      successorScopeHash: scope.scopeHash,
      semanticCacheHash: semanticCache.cacheHash,
      authority: authoring.authorityBinding,
    }),
  } as const;
  immutableWrite(path.join(outputRoot, 'catalog-authoring.json'), authoring);
  immutableWrite(path.join(outputRoot, 'catalog.json'), catalog);
  immutableWrite(path.join(outputRoot, 'current.json'), current);
  immutableWrite(path.join(outputRoot, 'scope.json'), { ...scope, memberCount: scope.members.length });
  immutableWrite(path.join(outputRoot, 'semantic-restage-receipt.json'), receipt);
  process.stdout.write(`${JSON.stringify({
    catalogHash: catalog.catalogHash,
    scopeHash: scope.scopeHash,
    memberCount: scope.members.length,
    semanticCacheHash: semanticCache.cacheHash,
    pointerWritten: false,
  }, null, 2)}\n`);
}

main();
