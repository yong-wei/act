import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { objectKeyFor } from './keys';
import { assertPortable } from './privacy';
import {
  COHORT_ID,
  GIT_SHA,
  MANIFEST_SCHEMA,
  MEDIA_TYPE,
  OPTIMIZER_LEVEL,
  OPTIMIZER_NAME,
  SHA256,
  SIMULATION_MODELS,
  TOOL_VERSION,
  type BrowserDeliveryManifest,
  type GitCapture,
  type ManifestEntry,
  type OptimizerIdentity,
  type SimulationModelId,
} from './types';

export interface ManifestInput extends GitCapture {
  readonly capturedAt: string;
  readonly optimizer: OptimizerIdentity;
  readonly sources: Readonly<Record<SimulationModelId, {
    readonly sourceGitBlob: string;
    readonly sourceSha256: string;
    readonly sourceBytes: number;
    readonly outputSha256: string | null;
    readonly outputBytes: number | null;
  }>>;
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashFile(path: string): string {
  return sha256Bytes(readFileSync(path));
}

export function optimizerConfigDigest(optimizerScript: string): string {
  return sha256Text(`${sha256Text(optimizerScript)}\n${OPTIMIZER_LEVEL}\n`);
}

export function buildManifest(input: ManifestInput): BrowserDeliveryManifest {
  if (!GIT_SHA.test(input.sourceCommit) || !GIT_SHA.test(input.sourceTree)) {
    throw new Error('invalid-git-identity');
  }
  if (input.optimizer.name !== OPTIMIZER_NAME || !SHA256.test(input.optimizer.configDigest)) {
    throw new Error('invalid-optimizer-identity');
  }
  const entries: ManifestEntry[] = SIMULATION_MODELS.map((model) => {
    const source = input.sources[model.logicalId];
    if (!source) throw new Error(`missing-source:${model.logicalId}`);
    if (!GIT_SHA.test(source.sourceGitBlob) || !SHA256.test(source.sourceSha256)) {
      throw new Error(`invalid-source-identity:${model.logicalId}`);
    }
    const hasOutput = source.outputSha256 !== null && source.outputBytes !== null;
    if (hasOutput && (!SHA256.test(source.outputSha256!) || source.outputBytes! < 1)) {
      throw new Error(`invalid-output-identity:${model.logicalId}`);
    }
    let exclusionReason: string | null = null;
    if (input.dirty) exclusionReason = 'dirty-worktree';
    else if (input.mixedWorktree) exclusionReason = 'mixed-worktree';
    else if (!hasOutput) exclusionReason = 'optimized-output-missing';
    const included = exclusionReason === null;
    const objectKey = included ? objectKeyFor(source.outputSha256!, model.basename) : null;
    return {
      logicalId: model.logicalId,
      basename: model.basename,
      sourcePath: `public/assets/${model.basename}`,
      sourceGitBlob: source.sourceGitBlob,
      sourceSha256: source.sourceSha256,
      sourceBytes: source.sourceBytes,
      optimizedPath: `public/assets/models-opt/${model.basename}`,
      outputSha256: source.outputSha256,
      outputBytes: source.outputBytes,
      mediaType: MEDIA_TYPE,
      publicEligible: true,
      included,
      exclusionReason,
      objectKey,
      originalUrl: `/assets/${model.basename}`,
      optimizedUrl: `/assets/models-opt/${model.basename}`,
    };
  });
  const includedCount = entries.filter((entry) => entry.included).length;
  const body = {
    schemaVersion: MANIFEST_SCHEMA,
    cohortId: COHORT_ID,
    toolVersion: TOOL_VERSION,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    capturedAt: input.capturedAt,
    optimizer: input.optimizer,
    includedCount,
    excludedCount: entries.length - includedCount,
    entries,
  };
  const manifest: BrowserDeliveryManifest = {
    ...body,
    manifestDigest: sha256Text(serializeDeterministic(body)),
  };
  assertPortable(manifest, 'browser-delivery-manifest');
  return manifest;
}
