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
  catalogVersion: string;
  retiredMembers: readonly string[];
} {
  const values = new Map<string, string>();
  const retiredMembers: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--retired-member') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`invalid --retired-member near ${value ?? '<end>'}`);
      retiredMembers.push(value);
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || values.has(key)) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    values.set(key, value);
    index += 1;
  }
  const required = (key: string): string => values.get(key) ?? fail(`missing ${key}`);
  for (const key of values.keys()) {
    if (!['--snapshot-dir', '--predecessor-catalog', '--predecessor-authoring', '--out', '--staged-at', '--catalog-version'].includes(key)) {
      fail(`unknown option ${key}`);
    }
  }
  const stagedAt = required('--staged-at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(stagedAt)) {
    fail('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  if (new Set(retiredMembers).size !== retiredMembers.length) {
    fail('--retired-member repeats a canonical id');
  }
  return {
    snapshotDir: required('--snapshot-dir'),
    predecessorCatalog: required('--predecessor-catalog'),
    predecessorAuthoring: required('--predecessor-authoring'),
    out: required('--out'),
    stagedAt,
    catalogVersion: required('--catalog-version'),
    retiredMembers,
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
  if (authorityIds.size !== manifest.objectCount || crosswalk.memberCount !== authorityIds.size) {
    fail('Authority snapshot and crosswalk do not close over the same member set');
  }
  // Crosswalk repin: the governed ASR crosswalk may still carry retired
  // predecessor members; the candidate closes over the exact snapshot set.
  const retiredSet = new Set(args.retiredMembers);
  for (const canonicalId of retiredSet) {
    if (authorityIds.has(canonicalId)) {
      fail(`declared retired member is still present in the captured Authority: ${canonicalId}`);
    }
  }
  const repinnedCrosswalkEntries = Object.fromEntries(
    Object.entries(crosswalk.entries).filter(([canonicalId]) => !retiredSet.has(canonicalId)),
  );
  if (Object.keys(repinnedCrosswalkEntries).length !== authorityIds.size) {
    fail('repinned crosswalk does not close over the captured Authority member set');
  }
  for (const canonicalId of Object.keys(repinnedCrosswalkEntries)) {
    if (!authorityIds.has(canonicalId)) fail(`crosswalk canonical id is absent from the capture: ${canonicalId}`);
  }

  const predecessorMembership = new Map(predecessor.memberships.map((row) => [row.canonicalId, row]));
  const assignmentById = new Map(assignments.map((row) => [row.canonicalId, row]));
  if (assignmentById.size !== assignments.length) fail('new-member assignments repeat a canonical id');
  const added = [...authorityIds].filter((canonicalId) => !predecessorMembership.has(canonicalId));
  // The declared retirement set is the governance ruling; the observed diff
  // must match it exactly in both directions.
  const retired = [...predecessorMembership.keys()].filter((canonicalId) => !authorityIds.has(canonicalId));
  const declaredRetired = [...retiredSet];
  if (
    retired.length !== declaredRetired.length
    || retired.some((canonicalId) => !retiredSet.has(canonicalId))
    || assignmentById.size !== added.length
  ) {
    fail(
      `observed member diff does not match the declared governance ruling: added ${added.length}/${assignmentById.size}, retired ${retired.length}/${declaredRetired.length}`
      + (retired.length ? ` (observed retired: ${retired.slice(0, 4).join(', ')})` : ''),
    );
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

  const authoring: AuthorityDomainCatalogAuthoring = {
    ...predecessor,
    catalogVersion: args.catalogVersion,
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
  if (declaredRetired.length > 0) {
    // Governance evidence for the explicit retirement ruling: the repinned
    // crosswalk plus the exact retired member list land in the candidate.
    writeImmutable(path.join(args.out, 'crosswalk.json'), {
      memberCount: Object.keys(repinnedCrosswalkEntries).length,
      entries: repinnedCrosswalkEntries,
    });
    writeImmutable(path.join(args.out, 'retirement-ruling.json'), {
      contract: 'act-authority-domain-catalog-retirement-ruling/v1',
      stagedAt: args.stagedAt,
      retiredMembers: declaredRetired,
      sourceCrosswalkSha256: sha256File(absolute(CROSSWALK_PATH)),
      snapshotId: manifest.snapshotId,
    });
  }
  process.stdout.write(JSON.stringify({
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    scopeHash: scope.scopeHash,
    memberCount: scope.members.length,
    addedMembers: added.length,
    retiredMembers: declaredRetired.length,
    pointerWritten: false,
  }, null, 2) + '\n');
}

main();
