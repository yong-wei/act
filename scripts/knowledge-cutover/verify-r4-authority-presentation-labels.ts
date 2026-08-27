#!/usr/bin/env tsx
/**
 * Qualify the r4 presentation-label closure from its immutable Authority
 * snapshot through the materialized catalog and every node-detail shard.
 *
 * This is an automated baseline gate: it does not create a reviewer queue.
 * Any missing, placeholder, duplicated, or drifted label rejects the whole
 * candidate before a Runtime selector can be built.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  createAuthorityLabelResolverContext,
  resolveAuthorityLabel,
} from '@/lib/authority-domain-shards';
import { verifyMaterializedSnapshot } from '@/lib/authoritative-knowledge/authority-snapshot';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const SHA256 = /^[a-f0-9]{64}$/u;
const PLACEHOLDER = /^(?:名称暂不可用|暂不可用)$/u;

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`verify-r4-authority-presentation-labels: missing ${name}`);
  return value;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readJson<T>(value: string): T {
  return JSON.parse(readFileSync(absolute(value), 'utf8')) as T;
}

function sha256File(value: string): string {
  return createHash('sha256').update(readFileSync(absolute(value))).digest('hex');
}

function immutableWrite(value: string, body: unknown): void {
  const target = absolute(value);
  const wire = Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(wire)) {
    throw new Error(`verify-r4-authority-presentation-labels: refusing to overwrite ${value}`);
  }
  if (!existsSync(target)) writeFileSync(target, wire);
}

type SnapshotManifest = Parameters<typeof verifyMaterializedSnapshot>[0]['manifest'];
type Engineering = Parameters<typeof verifyMaterializedSnapshot>[0]['engineering'];

type Catalog = {
  readonly catalogId: string;
  readonly catalogHash: string;
  readonly authorityBinding: {
    readonly snapshotId: string;
    readonly snapshotHash: string;
    readonly releaseId: string;
    readonly releaseSetId: string;
  };
};

type Stage = {
  readonly authority: {
    readonly snapshotId: string;
    readonly snapshotHash: string;
    readonly releaseId: string;
    readonly releaseSetId: string;
  };
  readonly catalog: { readonly catalogId: string; readonly catalogHash: string };
  readonly shardSetId: string;
  readonly shardSetHash: string;
};

type ShardManifest = {
  readonly shardSetId: string;
  readonly shardSetHash: string;
  readonly envelope: {
    readonly authority: Stage['authority'];
    readonly catalog: Stage['catalog'];
  };
  readonly files: Record<string, string>;
};

type DetailShard = {
  readonly node: { readonly id: string; readonly label: string };
};

function requireEqual(left: unknown, right: unknown, label: string): void {
  if (left !== right) throw new Error(`verify-r4-authority-presentation-labels: ${label} differs`);
}

function validLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
}

function main(): void {
  const snapshotDir = option('--snapshot-dir');
  const catalogPath = option('--catalog');
  const shardStagePath = option('--shard-stage');
  const out = option('--out');
  const manifest = readJson<SnapshotManifest>(path.join(snapshotDir, 'manifest.json'));
  const engineering = readJson<Engineering>(path.join(snapshotDir, 'engineering.json'));
  verifyMaterializedSnapshot({ manifest, engineering });
  if (!engineering.v2Evidence) throw new Error('verify-r4-authority-presentation-labels: snapshot lacks v2 evidence');
  const catalog = readJson<Catalog>(catalogPath);
  const stage = readJson<Stage>(shardStagePath);
  const shardRoot = `course-content/runtime/knowledge/authority-domain-shards/sets/${stage.shardSetId}`;
  const shardManifest = readJson<ShardManifest>(path.join(shardRoot, 'manifest.json'));

  for (const [label, actual, expected] of [
    ['catalog snapshot id', catalog.authorityBinding.snapshotId, manifest.snapshotId],
    ['catalog snapshot hash', catalog.authorityBinding.snapshotHash, manifest.snapshotHash],
    ['catalog release id', catalog.authorityBinding.releaseId, manifest.releaseId],
    ['catalog release set id', catalog.authorityBinding.releaseSetId, manifest.releaseSetId],
    ['stage snapshot id', stage.authority.snapshotId, manifest.snapshotId],
    ['stage snapshot hash', stage.authority.snapshotHash, manifest.snapshotHash],
    ['stage release id', stage.authority.releaseId, manifest.releaseId],
    ['stage release set id', stage.authority.releaseSetId, manifest.releaseSetId],
    ['stage catalog id', stage.catalog.catalogId, catalog.catalogId],
    ['stage catalog hash', stage.catalog.catalogHash, catalog.catalogHash],
    ['shard set id', shardManifest.shardSetId, stage.shardSetId],
    ['shard set hash', shardManifest.shardSetHash, stage.shardSetHash],
    ['shard snapshot id', shardManifest.envelope.authority.snapshotId, manifest.snapshotId],
    ['shard snapshot hash', shardManifest.envelope.authority.snapshotHash, manifest.snapshotHash],
    ['shard catalog id', shardManifest.envelope.catalog.catalogId, catalog.catalogId],
    ['shard catalog hash', shardManifest.envelope.catalog.catalogHash, catalog.catalogHash],
  ] as const) requireEqual(actual, expected, label);

  const resolver = createAuthorityLabelResolverContext({
    snapshot: {
      snapshotId: manifest.snapshotId,
      snapshotHash: manifest.snapshotHash,
      releaseId: manifest.releaseId,
    },
    objects: engineering.objects,
    v2Evidence: engineering.v2Evidence,
  });
  const authorityIds = new Set<string>();
  const labelSourceCounts = new Map<string, number>();
  const unavailable: string[] = [];
  for (const object of engineering.objects) {
    if (authorityIds.has(object.canonicalId)) throw new Error(`verify-r4-authority-presentation-labels: duplicated Authority id ${object.canonicalId}`);
    authorityIds.add(object.canonicalId);
    const resolved = resolveAuthorityLabel(resolver, object.canonicalId);
    if (resolved.status !== 'available' || !validLabel(resolved.label)) unavailable.push(object.canonicalId);
  }
  if (unavailable.length > 0) {
    throw new Error(`verify-r4-authority-presentation-labels: ${unavailable.length} Authority labels are unavailable or placeholders`);
  }

  const preferredRows = engineering.v2Evidence.multilingualLabels.filter((row) => row.labelType === 'canonical_preferred');
  if (preferredRows.length !== authorityIds.size) {
    throw new Error('verify-r4-authority-presentation-labels: canonical preferred label denominator differs from Authority objects');
  }
  for (const row of preferredRows) {
    const source = typeof row.payload?.source === 'string' ? row.payload.source : null;
    if (!source) throw new Error(`verify-r4-authority-presentation-labels: ${row.entityId} has no source-bound label provenance`);
    labelSourceCounts.set(source, (labelSourceCounts.get(source) ?? 0) + 1);
  }

  const details = Object.entries(shardManifest.files)
    .filter(([relative]) => relative.startsWith('details/') && relative.endsWith('.json'))
    .sort(([left], [right]) => left.localeCompare(right));
  if (details.length !== authorityIds.size) {
    throw new Error(`verify-r4-authority-presentation-labels: detail shard denominator ${details.length} differs from Authority ${authorityIds.size}`);
  }
  const seenDetails = new Set<string>();
  for (const [relative, expectedHash] of details) {
    if (!SHA256.test(expectedHash)) throw new Error(`verify-r4-authority-presentation-labels: malformed shard digest ${relative}`);
    const detailPath = path.join(shardRoot, relative);
    if (sha256File(detailPath) !== expectedHash) throw new Error(`verify-r4-authority-presentation-labels: shard drift ${relative}`);
    const detail = readJson<DetailShard>(detailPath);
    if (!authorityIds.has(detail.node.id) || seenDetails.has(detail.node.id) || !validLabel(detail.node.label)) {
      throw new Error(`verify-r4-authority-presentation-labels: invalid materialized detail ${relative}`);
    }
    const resolved = resolveAuthorityLabel(resolver, detail.node.id);
    if (resolved.status !== 'available' || detail.node.label !== resolved.label) {
      throw new Error(`verify-r4-authority-presentation-labels: materialized label drift ${detail.node.id}`);
    }
    seenDetails.add(detail.node.id);
  }
  if (seenDetails.size !== authorityIds.size) throw new Error('verify-r4-authority-presentation-labels: detail shards do not cover Authority');

  const artifact = {
    contract: 'r4-presentation-label-qualification/v1',
    status: 'PASS',
    reviewRequired: 0,
    implementation: {
      sourcePath: 'scripts/knowledge-cutover/verify-r4-authority-presentation-labels.ts',
      sourceSha256: sha256File('scripts/knowledge-cutover/verify-r4-authority-presentation-labels.ts'),
    },
    authority: {
      snapshotId: manifest.snapshotId,
      snapshotHash: manifest.snapshotHash,
      releaseId: manifest.releaseId,
      releaseSetId: manifest.releaseSetId,
      manifestSha256: sha256File(path.join(snapshotDir, 'manifest.json')),
      engineeringSha256: sha256File(path.join(snapshotDir, 'engineering.json')),
    },
    catalog: { catalogId: catalog.catalogId, catalogHash: catalog.catalogHash, sha256: sha256File(catalogPath) },
    shards: {
      shardSetId: stage.shardSetId,
      shardSetHash: stage.shardSetHash,
      stageSha256: sha256File(shardStagePath),
      manifestSha256: sha256File(path.join(shardRoot, 'manifest.json')),
    },
    coverage: {
      authorityObjects: authorityIds.size,
      canonicalPreferredLabels: preferredRows.length,
      materializedDetailLabels: seenDetails.size,
      unavailableOrPlaceholder: unavailable.length,
      sourceCounts: Object.fromEntries([...labelSourceCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    },
    qualificationHash: '',
  };
  const { qualificationHash: ignoredQualificationHash, ...hashInput } = artifact;
  void ignoredQualificationHash;
  immutableWrite(out, { ...artifact, qualificationHash: projectionDigest(hashInput) });
  process.stdout.write(`${path.resolve(ROOT, out)}\n`);
}

main();
