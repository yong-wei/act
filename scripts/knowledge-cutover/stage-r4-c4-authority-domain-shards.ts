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
import { createTeachingOverlay } from '@/lib/authority-domain-shards/teaching';
import {
  loadStagedAuthoritySnapshot,
  resolveAuthorityStorePaths,
} from '@/lib/authoritative-knowledge/authority-store';
import type { ConsumerActivationManifest } from '@/lib/versioned-knowledge-activation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const OUTPUT_ROOT = `${CANDIDATE_ROOT}/domain-shards-v022-predecessor`;
const SUPERSEDED_OUTPUT_ROOT = `${CANDIDATE_ROOT}/domain-shards`;
const SNAPSHOT_ID = 'snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function requireTimestamp(): string {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--staged-at') {
    throw new Error('usage: --staged-at <millisecond RFC3339 UTC timestamp>');
  }
  const value = args[1];
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new Error('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  return value;
}

function recordSupersededStage(input: {
  readonly stagedAt: string;
  readonly replacement: {
    readonly shardSetId: string;
    readonly shardSetHash: string;
    readonly activationHash: string;
    readonly stageHash: string;
  };
}): void {
  const previousPath = `${SUPERSEDED_OUTPUT_ROOT}/stage.json`;
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
    throw new Error('the historical r4-c4 shard stage cannot be safely superseded');
  }
  immutableWrite(`${SUPERSEDED_OUTPUT_ROOT}/superseded-by-v022-predecessor.json`, {
    contract: 'r4-c4-superseded-domain-shard-stage/v1',
    supersededAt: input.stagedAt,
    reason: 'missing-captured-production-v022-activation-predecessor',
    previous: {
      directory: SUPERSEDED_OUTPUT_ROOT,
      stageSha256: sha256File(previousPath),
      shardSetId: previous.shardSetId,
      shardSetHash: previous.shardSetHash,
      activationHash: previous.activationHash,
    },
    replacement: {
      directory: OUTPUT_ROOT,
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
  const authority = loadStagedAuthoritySnapshot(
    resolveAuthorityStorePaths(absolute('course-content/authoring/knowledge/authority')),
    SNAPSHOT_ID,
  );
  const catalog = readJson<AuthorityDomainCatalogRuntime>(`${CANDIDATE_ROOT}/domain-catalog/catalog.json`);
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
  }>(`${CANDIDATE_ROOT}/consumer-activation-stage.json`);
  const activation = readJson<ConsumerActivationManifest>(
    `course-content/runtime/knowledge/consumer-activation/releases/${activationStage.successor.activationId}/activation.json`,
  );
  requireReadyActivation(activation, activationStage.successor.activationId, activationStage.successor.activationHash, {
    snapshotId: authority.snapshotId,
    snapshotHash: authority.snapshotHash,
    releaseId: authority.manifest.releaseId,
  });

  // No domain-fragment Teaching Projection has been staged for r4.  The core
  // Teaching Projection is independently selected by its own pointer, so the
  // shard surface honestly exposes unavailable optional domain overlay data.
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
    teaching: {
      status: 'unavailable',
      projectionId: null,
      projectionHash: null,
      teachingCacheFamily: null,
    },
    match: { authority: true, catalog: true, teaching: null },
  };
  const materialized = buildAuthorityDomainShards({
    envelope,
    catalog,
    engineering: authority.engineering,
    teaching: createTeachingOverlay(null),
    activatedAt: stagedAt,
  });
  const paths = resolveAuthorityDomainShardPaths(
    ROOT,
  );
  stageAuthorityDomainShards(paths, materialized);

  const setArtifact = {
    contract: 'r4-c4-authority-domain-shard-stage/v1',
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
  immutableWrite(`${OUTPUT_ROOT}/stage.json`, staged);
  immutableWrite(`${OUTPUT_ROOT}/current.json`, materialized.pointer);
  immutableWrite(`${OUTPUT_ROOT}/manifest.json`, materialized.manifest);
  recordSupersededStage({
    stagedAt,
    replacement: {
      shardSetId: materialized.manifest.shardSetId,
      shardSetHash: materialized.manifest.shardSetHash,
      activationHash: activation.activationHash,
      stageHash: staged.artifactHash,
    },
  });
  process.stdout.write(`${JSON.stringify({
    shardSetId: materialized.manifest.shardSetId,
    shardSetHash: materialized.manifest.shardSetHash,
    catalogHash: catalog.catalogHash,
    activationHash: activation.activationHash,
    teaching: 'unavailable',
  }, null, 2)}\n`);
}

main();
