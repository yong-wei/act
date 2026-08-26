#!/usr/bin/env tsx
/**
 * Stage the v0.37-r4 reviewed domain catalog and teaching scope without
 * touching a runtime selector.  The source catalog is the live v0.22
 * predecessor captured during preflight; only the reviewed v0.37 additions
 * and the execution-time Authority snapshot may change the candidate.
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
const CROSSWALK_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/20260823-asr-batch/crosswalk-v037.json';
const ASSIGNMENTS_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/v037-new-member-domain-assignment/assignments.jsonl';

interface SnapshotManifest {
  readonly releaseId: string;
  readonly releaseSetId: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly captureRevision: string;
  readonly objectCount: number;
}

interface Engineering {
  readonly objects: readonly { readonly canonicalId: string }[];
}

interface Crosswalk {
  readonly memberCount: number;
  readonly entries: Readonly<Record<string, unknown>>;
}

interface Assignment {
  readonly canonicalId: string;
  readonly domainId: string;
}

function fail(message: string): never {
  throw new Error(`build-v037-r4-domain-catalog: ${message}`);
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

function writeImmutable(filePath: string, value: unknown): void {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) {
      fail(`refusing to overwrite immutable artifact ${target}`);
    }
    return;
  }
  writeFileSync(target, bytes);
}

function parseArgs(argv: readonly string[]): {
  snapshotDir: string;
  predecessorCatalog: string;
  predecessorAuthoring: string;
  out: string;
  stagedAt: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || values.has(key)) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    values.set(key, value);
  }
  const required = (key: string): string => values.get(key) ?? fail(`missing ${key}`);
  for (const key of values.keys()) {
    if (!['--snapshot-dir', '--predecessor-catalog', '--predecessor-authoring', '--out', '--staged-at'].includes(key)) {
      fail(`unknown option ${key}`);
    }
  }
  const stagedAt = required('--staged-at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(stagedAt)) {
    fail('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  return {
    snapshotDir: required('--snapshot-dir'),
    predecessorCatalog: required('--predecessor-catalog'),
    predecessorAuthoring: required('--predecessor-authoring'),
    out: required('--out'),
    stagedAt,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson<SnapshotManifest>(path.join(args.snapshotDir, 'manifest.json'));
  const engineering = readJson<Engineering>(path.join(args.snapshotDir, 'engineering.json'));
  const predecessorRuntime = readJson<AuthorityDomainCatalogRuntime>(args.predecessorCatalog);
  const predecessor = readJson<AuthorityDomainCatalogAuthoring>(args.predecessorAuthoring);
  const crosswalk = readJson<Crosswalk>(CROSSWALK_PATH);
  const assignments = readFileSync(absolute(ASSIGNMENTS_PATH), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Assignment);

  if (manifest.releaseId !== 'ctr:release:control-theory-engineering-v0.37'
    || !/^snap-[a-f0-9]{64}$/u.test(manifest.snapshotId)
    || manifest.snapshotId !== `snap-${manifest.snapshotHash}`
    || !/^[a-f0-9]{40}$/u.test(manifest.captureRevision)) {
    fail('snapshot manifest is not a sealed v0.37 Authority capture');
  }
  const rebuiltPredecessor = buildAuthorityDomainCatalog(
    predecessor,
    predecessor.memberships.map((membership) => ({ canonicalId: membership.canonicalId })),
  );
  if (rebuiltPredecessor.catalogId !== predecessorRuntime.catalogId
    || rebuiltPredecessor.catalogHash !== predecessorRuntime.catalogHash
    || rebuiltPredecessor.authorityBinding.releaseId !== predecessorRuntime.authorityBinding.releaseId
    || rebuiltPredecessor.authorityBinding.snapshotHash !== predecessorRuntime.authorityBinding.snapshotHash) {
    fail('captured live predecessor catalog does not reopen from the reviewed authoring catalog');
  }
  const authorityIds = new Set(engineering.objects.map((row) => row.canonicalId));
  if (authorityIds.size !== manifest.objectCount || authorityIds.size !== 7476
    || crosswalk.memberCount !== authorityIds.size
    || Object.keys(crosswalk.entries).length !== authorityIds.size) {
    fail('Authority snapshot and crosswalk do not close over the same 7476 members');
  }
  for (const canonicalId of Object.keys(crosswalk.entries)) {
    if (!authorityIds.has(canonicalId)) fail(`crosswalk canonical id is absent from the capture: ${canonicalId}`);
  }

  const predecessorMembership = new Map(predecessor.memberships.map((row) => [row.canonicalId, row]));
  if (predecessorMembership.size !== 7300) fail('predecessor catalog must contain exactly 7300 unique members');
  const assignmentById = new Map(assignments.map((row) => [row.canonicalId, row]));
  if (assignmentById.size !== assignments.length) fail('new-member assignments repeat a canonical id');
  const added = [...authorityIds].filter((canonicalId) => !predecessorMembership.has(canonicalId));
  if (added.length !== 176 || assignmentById.size !== added.length) {
    fail(`expected exactly 176 reviewed v0.37 additions, found ${added.length}/${assignmentById.size}`);
  }
  const domainIds = new Set(predecessor.domains.map((domain) => domain.domainId));
  for (const canonicalId of added) {
    const assignment = assignmentById.get(canonicalId);
    if (!assignment || !domainIds.has(assignment.domainId)) {
      fail(`new Authority member ${canonicalId} lacks a reviewed registered domain assignment`);
    }
  }
  for (const canonicalId of assignmentById.keys()) {
    if (!authorityIds.has(canonicalId) || predecessorMembership.has(canonicalId)) {
      fail(`assignment ${canonicalId} is not a v0.37-only Authority member`);
    }
  }
  for (const canonicalId of predecessorMembership.keys()) {
    if (!authorityIds.has(canonicalId)) fail(`predecessor member ${canonicalId} disappeared from the captured Authority`);
  }

  const authoring: AuthorityDomainCatalogAuthoring = {
    ...predecessor,
    catalogVersion: 'v0.37-r4-candidate',
    authorityBinding: {
      releaseId: manifest.releaseId,
      releaseSetId: manifest.releaseSetId,
      snapshotId: manifest.snapshotId,
      snapshotHash: manifest.snapshotHash,
    },
    memberships: [...authorityIds]
      .sort((left, right) => left.localeCompare(right))
      .map((canonicalId) => {
        const inherited = predecessorMembership.get(canonicalId);
        if (inherited) return inherited;
        const assignment = assignmentById.get(canonicalId) as Assignment;
        return {
          canonicalId,
          domainIds: [assignment.domainId],
          preferredDomainId: assignment.domainId,
        };
      }),
  };
  const catalog = buildAuthorityDomainCatalog(
    authoring,
    [...authorityIds].sort((left, right) => left.localeCompare(right)).map((canonicalId) => ({ canonicalId })),
  );
  verifyAuthorityDomainCatalogRuntime(catalog);
  const scope = deriveActTeachingScope({
    courseId: 'act-control-theory',
    catalog,
    authority: {
      releaseId: manifest.releaseId,
      releaseSetId: manifest.releaseSetId,
      snapshotId: manifest.snapshotId,
      snapshotHash: manifest.snapshotHash,
    },
  });
  assertScopeIntegrity(scope);
  if (scope.members.length !== authorityIds.size) fail('candidate scope does not include every captured Authority member');
  const current = {
    contract: 'act-authority-domain-display-catalog-current/v1',
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    snapshotId: manifest.snapshotId,
    snapshotHash: manifest.snapshotHash,
    releaseId: manifest.releaseId,
    activatedAt: args.stagedAt,
  } as const;
  const stage = {
    contract: 'act-authority-domain-display-catalog-stage/v1',
    stagedAt: args.stagedAt,
    predecessorCatalogSha256: sha256File(args.predecessorCatalog),
    predecessorAuthoringSha256: sha256File(args.predecessorAuthoring),
    snapshotManifestSha256: sha256File(path.join(args.snapshotDir, 'manifest.json')),
    catalogHash: catalog.catalogHash,
    scopeHash: scope.scopeHash,
    catalogStageHash: projectionDigest({
      predecessorCatalogSha256: sha256File(args.predecessorCatalog),
      predecessorAuthoringSha256: sha256File(args.predecessorAuthoring),
      snapshotManifestSha256: sha256File(path.join(args.snapshotDir, 'manifest.json')),
      catalogHash: catalog.catalogHash,
      scopeHash: scope.scopeHash,
    }),
  };
  writeImmutable(path.join(args.out, 'catalog-authoring.json'), authoring);
  writeImmutable(path.join(args.out, 'catalog.json'), catalog);
  writeImmutable(path.join(args.out, 'current.json'), current);
  writeImmutable(path.join(args.out, 'scope.json'), { ...scope, memberCount: scope.members.length });
  writeImmutable(path.join(args.out, 'stage-receipt.json'), stage);
  process.stdout.write(JSON.stringify({
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    scopeHash: scope.scopeHash,
    memberCount: scope.members.length,
    addedMembers: added.length,
    pointerWritten: false,
  }, null, 2) + '\n');
}

main();
