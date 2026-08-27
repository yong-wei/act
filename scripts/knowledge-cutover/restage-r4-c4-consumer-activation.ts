#!/usr/bin/env tsx
/**
 * Rebuild the r4-c4 shared consumer activation against the observed v0.22
 * production predecessor. The prior activation is part of the activation
 * hash, so it cannot be inferred from the migrated local v0.9 selector.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  stageConsumerActivation,
  resolveConsumerActivationStorePaths,
} from '@/lib/versioned-knowledge-activation/store';
import type { ConsumerActivationManifest } from '@/lib/versioned-knowledge-activation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const LEGACY_CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const LEGACY_SNAPSHOT_ID = 'snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';
const LEGACY_PROJECTION_ID = 'proj-f090374308ccb75e719afd0b1fb4e439e532db60e7a0096596b6c0684247b556';

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
  const index = process.argv.indexOf('--staged-at');
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new Error('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  return value;
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

function main(): void {
  const stagedAt = requireTimestamp();
  const candidateRoot = option('--candidate-root', LEGACY_CANDIDATE_ROOT);
  const snapshotId = option('--snapshot-id', LEGACY_SNAPSHOT_ID);
  const projectionId = option('--projection-id', LEGACY_PROJECTION_ID);
  const productionPredecessor = option(
    '--production-predecessor',
    `${candidateRoot}/active-baseline/production-v022-consumer-activation.json`,
  );
  const snapshotDir = `course-content/authoring/knowledge/authority/releases/${snapshotId}`;
  const authority = readJson<{
    readonly releaseId: string;
    readonly snapshotId: string;
    readonly snapshotHash: string;
    readonly captureRevision: string;
  }>(`${snapshotDir}/manifest.json`);
  const projectionDir = `course-content/runtime/knowledge/projection/releases/${projectionId}`;
  const projection = readJson<{
    readonly projectionId: string;
    readonly projectionHash: string;
    readonly authorityReleaseId: string;
    readonly gatePassed: boolean;
  }>(`${projectionDir}/projection-manifest.json`);
  const predecessor = readJson<ConsumerActivationManifest>(productionPredecessor);
  if (
    predecessor.activationId !== 'v022-cutover-9c4b2c1c2c97-1ab3029ae058'
    || predecessor.activationHash !== '63acd3f2d9f18a4dd6800ee185b68cc860bf330f3e288747c699fa6834bb4129'
    || predecessor.consumers.length !== 6
  ) {
    throw new Error('captured production v0.22 activation is not the sealed predecessor');
  }
  if (
    authority.snapshotId !== snapshotId
    || projection.projectionId !== projectionId
    || projection.authorityReleaseId !== authority.releaseId
    || !projection.gatePassed
  ) {
    throw new Error('r4-c4 Authority and Teaching Projection inputs are not closed');
  }
  const projectionArtifactNames = [
    'projection-manifest.json',
    'resources.jsonl',
    'bindings.jsonl',
    'cards-index.json',
    'prerequisites.jsonl',
    'core-nodes.json',
    'impact-report.json',
    'gate.json',
  ] as const;
  const consumerRoot = absolute('course-content/runtime/knowledge/consumer-activation');
  const staged = stageConsumerActivation(resolveConsumerActivationStorePaths(consumerRoot), {
    artifacts: {
      captureRevision: authority.captureRevision,
      authority: {
        present: true,
        releaseId: authority.releaseId,
        snapshotId: authority.snapshotId,
        snapshotHash: authority.snapshotHash,
        captureRevision: authority.captureRevision,
        artifactHashes: {
          'manifest.json': sha256File(`${snapshotDir}/manifest.json`),
          'engineering.json': sha256File(`${snapshotDir}/engineering.json`),
        },
        artifactPaths: {
          'manifest.json': absolute(`${snapshotDir}/manifest.json`),
          'engineering.json': absolute(`${snapshotDir}/engineering.json`),
        },
      },
      projection: {
        present: true,
        projectionId: projection.projectionId,
        projectionHash: projection.projectionHash,
        authorityReleaseId: projection.authorityReleaseId,
        captureRevision: null,
        gatePassed: projection.gatePassed,
        artifactHashes: Object.fromEntries(
          projectionArtifactNames.map((name) => [name, sha256File(`${projectionDir}/${name}`)]),
        ),
        artifactPaths: Object.fromEntries(
          projectionArtifactNames.map((name) => [name, absolute(`${projectionDir}/${name}`)]),
        ),
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
    },
    priorActivationId: predecessor.activationId,
    priorActivationHash: predecessor.activationHash,
    stagedAt,
  });
  if (staged.manifest.impact.readyConsumerIds.length !== 6) {
    throw new Error('restaged r4-c4 activation does not make all six consumers READY');
  }
  const receipt = {
    contract: 'r4-coordinated-production-predecessor-activation-restage/v2',
    stagedAt,
    predecessor: {
      activationId: predecessor.activationId,
      activationHash: predecessor.activationHash,
      sourceSha256: sha256File(productionPredecessor),
    },
    successor: {
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      captureRevision: staged.manifest.captureRevision,
      readyConsumerIds: staged.manifest.impact.readyConsumerIds,
      priorActivationId: staged.manifest.priorActivationId,
      priorActivationHash: staged.manifest.priorActivationHash,
    },
    receiptHash: '',
  };
  const { receiptHash: ignoredReceiptHash, ...hashInput } = receipt;
  void ignoredReceiptHash;
  immutableWrite(`${candidateRoot}/consumer-activation-stage.json`, {
    ...receipt,
    receiptHash: projectionDigest(hashInput),
  });
  process.stdout.write(`${JSON.stringify({
    activationId: staged.activationId,
    activationHash: staged.activationHash,
    predecessorActivationId: predecessor.activationId,
  }, null, 2)}\n`);
}

main();
