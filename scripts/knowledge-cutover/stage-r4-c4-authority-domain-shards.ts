#!/usr/bin/env tsx
/**
 * Stage the Authority-domain shard closure for the r4-c4 candidate.
 *
 * This keeps the staged shard set separate from the runtime selector. The
 * later Runtime release carries the selected pointer; this preparation step
 * never mutates a production-visible current.json.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AuthorityDomainCatalogRuntime } from '@/lib/authority-domain-catalog/contracts';
import {
  buildAuthorityDomainShards,
  resolveAuthorityDomainShardPaths,
  stageAuthorityDomainShards,
} from '@/lib/authority-domain-shards';
import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  type AuthorityShardEnvelope,
} from '@/lib/authority-domain-shards/contracts';
import { createTeachingOverlay, loadOptionalDomainTeachingProjection } from '@/lib/authority-domain-shards/teaching';
import {
  loadStagedAuthoritySnapshot,
  resolveAuthorityStorePaths,
} from '@/lib/authoritative-knowledge/authority-store';
import type { ConsumerActivationManifest } from '@/lib/versioned-knowledge-activation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const LEGACY_CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const LEGACY_SNAPSHOT_ID = 'snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function requireTimestamp(): string {
  const value = option('--staged-at', '');
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new Error('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  return value;
}

function recordSupersededStage(input: {
  readonly previousRoot: string;
  readonly outputRoot: string;
  readonly stagedAt: string;
  readonly replacement: {
    readonly shardSetId: string;
    readonly shardSetHash: string;
    readonly activationHash: string;
    readonly stageHash: string;
  };
}): void {
  const previousPath = `${input.previousRoot}/stage.json`;
  if (!existsSync(absolute(previousPath))) return;
  const previous = readJson<{
    readonly shardSetId?: unknown;
    readonly shardSetHash?: unknown;
    readonly activationHash?: unknown;
  }>(previousPath);
  if (
    typeof previous.shardSetId !== 'string'
    || typeof previous.shardSetHash !== 'string'
    || typeof previous.activationHash !== 'string'
    || !/^[a-f0-9]{64}$/u.test(previous.shardSetHash)
    || !/^[a-f0-9]{64}$/u.test(previous.activationHash)
    || previous.activationHash === input.replacement.activationHash
  ) {
    throw new Error('the requested historical shard stage cannot be safely superseded');
  }
  immutableWrite(`${input.previousRoot}/superseded-by-v022-predecessor.json`, {
    contract: 'r4-c4-superseded-domain-shard-stage/v1',
    supersededAt: input.stagedAt,
    reason: 'missing-captured-production-v022-activation-predecessor',
    previous: {
      directory: input.previousRoot,
      stageSha256: sha256File(previousPath),
      shardSetId: previous.shardSetId,
      shardSetHash: previous.shardSetHash,
      activationHash: previous.activationHash,
    },
    replacement: {
      directory: input.outputRoot,
      ...input.replacement,
    },
  });
}

function immutableWrite(filePath: string, value: unknown): void {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) {
      throw new Error(`refusing to overwrite immutable artifact ${filePath}`);
    }
    return;
  }
  writeFileSync(target, bytes);
}

function requireReadyActivation(
  activation: ConsumerActivationManifest,
  activationId: string,
  activationHash: string,
  authority: { snapshotId: string; snapshotHash: string; releaseId: string },
): void {
  if (activation.activationId !== activationId || activation.activationHash !== activationHash) {
    throw new Error('staged consumer activation id does not match the r4-c4 candidate');
  }
  const ready = activation.consumers.filter((consumer) => consumer.status === 'READY');
  if (ready.length !== activation.consumers.length || ready.length !== 6) {
    throw new Error('r4-c4 consumer activation must contain exactly six READY consumers');
  }
  for (const consumer of ready) {
    const combination = consumer.combination;
    if (
      !combination
      || combination.authoritySnapshotId !== authority.snapshotId
      || combination.authoritySnapshotHash !== authority.snapshotHash
      || combination.authorityReleaseId !== authority.releaseId
    ) {
      throw new Error(`READY consumer ${consumer.consumerId} does not bind the r4-c4 Authority`);
    }
  }
}

function main(): void {
  const stagedAt = requireTimestamp();
  const candidateRoot = option('--candidate-root', LEGACY_CANDIDATE_ROOT);
  const outputRoot = option('--out', `${candidateRoot}/domain-shards-v022-predecessor`);
  const snapshotId = option('--snapshot-id', LEGACY_SNAPSHOT_ID);
  const supersedeRoot = option('--supersede-root', '');
  const authority = loadStagedAuthoritySnapshot(
    resolveAuthorityStorePaths(absolute('course-content/authoring/knowledge/authority')),
    snapshotId,
  );
  const catalog = readJson<AuthorityDomainCatalogRuntime>(`${candidateRoot}/domain-catalog/catalog.json`);
  if (
    catalog.authorityBinding.snapshotId !== authority.snapshotId
    || catalog.authorityBinding.snapshotHash !== authority.snapshotHash
    || catalog.authorityBinding.releaseId !== authority.manifest.releaseId
    || catalog.authorityBinding.releaseSetId !== authority.manifest.releaseSetId
  ) {
    throw new Error('r4-c4 domain catalog does not bind the staged Authority snapshot');
  }
  const activationStage = readJson<{
    readonly successor: { readonly activationId: string; readonly activationHash: string };
  }>(`${candidateRoot}/consumer-activation-stage.json`);
  const activation = readJson<ConsumerActivationManifest>(
    `course-content/runtime/knowledge/consumer-activation/releases/${activationStage.successor.activationId}/activation.json`,
  );
  requireReadyActivation(activation, activationStage.successor.activationId, activationStage.successor.activationHash, {
    snapshotId: authority.snapshotId,
    snapshotHash: authority.snapshotHash,
    releaseId: authority.manifest.releaseId,
  });

  // r4 staged without a domain-fragment Teaching overlay; r6 stages with the
  // live overlay pointer bound to the same successor Authority identity.
  const teachingOverlay = option('--teaching-overlay', '1') === '1'
    ? loadOptionalDomainTeachingProjection({
      repoRoot: ROOT,
      authority: {
        releaseId: authority.manifest.releaseId,
        releaseSetId: authority.manifest.releaseSetId,
        snapshotId: authority.snapshotId,
        snapshotHash: authority.snapshotHash,
      },
    })
    : null;
  if (option('--teaching-overlay', '1') === '1' && (!teachingOverlay?.pointer || !teachingOverlay.artifacts)) {
    throw new Error('live domain Teaching overlay does not verify against the staged Authority identity');
  }
  const teachingIdentity = teachingOverlay?.pointer
    ? {
      status: teachingOverlay.artifacts ? 'available' as const : 'unavailable' as const,
      projectionId: teachingOverlay.pointer.projectionId,
      projectionHash: teachingOverlay.pointer.projectionHash,
      teachingCacheFamily: teachingOverlay.pointer.teachingCacheFamily,
    }
    : {
      status: 'unavailable' as const,
      projectionId: null,
      projectionHash: null,
      teachingCacheFamily: null,
    };
  const envelope: AuthorityShardEnvelope = {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: authority.snapshotId,
      snapshotHash: authority.snapshotHash,
      releaseId: authority.manifest.releaseId,
      releaseSetId: authority.manifest.releaseSetId,
      activationId: activation.activationId,
      activationHash: activation.activationHash,
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      catalogVersion: catalog.catalogVersion,
    },
    teaching: teachingIdentity,
    match: { authority: true, catalog: true, teaching: teachingOverlay?.pointer ? (teachingOverlay.artifacts ? true : false) : null },
  };
  const materialized = buildAuthorityDomainShards({
    envelope,
    catalog,
    engineering: authority.engineering,
    teaching: createTeachingOverlay(teachingOverlay?.pointer ?? null, {
      artifacts: teachingOverlay?.artifacts ?? null,
    }),
    activatedAt: stagedAt,
  });
  const paths = resolveAuthorityDomainShardPaths(
    ROOT,
  );
  stageAuthorityDomainShards(paths, materialized);

  const setArtifact = {
    contract: 'r4-coordinated-authority-domain-shard-stage/v2',
    stagedAt,
    authority: envelope.authority,
    catalog: envelope.catalog,
    teaching: envelope.teaching,
    shardSetId: materialized.manifest.shardSetId,
    shardSetHash: materialized.manifest.shardSetHash,
    manifestSha256: sha256File(
      `course-content/runtime/knowledge/authority-domain-shards/sets/${materialized.manifest.shardSetId}/manifest.json`,
    ),
    activationHash: activation.activationHash,
    artifactHash: '',
  };
  const { artifactHash: ignoredArtifactHash, ...hashInput } = setArtifact;
  void ignoredArtifactHash;
  const staged = { ...setArtifact, artifactHash: projectionDigest(hashInput) };
  immutableWrite(`${outputRoot}/stage.json`, staged);
  immutableWrite(`${outputRoot}/current.json`, materialized.pointer);
  immutableWrite(`${outputRoot}/manifest.json`, materialized.manifest);
  if (supersedeRoot) {
    recordSupersededStage({
      previousRoot: supersedeRoot,
      outputRoot,
      stagedAt,
      replacement: {
        shardSetId: materialized.manifest.shardSetId,
        shardSetHash: materialized.manifest.shardSetHash,
        activationHash: activation.activationHash,
        stageHash: staged.artifactHash,
      },
    });
  }
  process.stdout.write(`${JSON.stringify({
    shardSetId: materialized.manifest.shardSetId,
    shardSetHash: materialized.manifest.shardSetHash,
    catalogHash: catalog.catalogHash,
    activationHash: activation.activationHash,
    teaching: 'unavailable',
  }, null, 2)}\n`);
}

main();
