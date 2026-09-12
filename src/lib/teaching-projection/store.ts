/**
 * Filesystem Teaching Projection store: staged immutable releases (#1267).
 *
 * Layout (under projectionRoot):
 *   current.json
 *   releases/<projectionId>/
 *     resources.jsonl
 *     bindings.jsonl
 *     prerequisites.jsonl
 *     core-nodes.json
 *     cards-index.json
 *     projection-manifest.json
 *     impact-report.json
 *     gate.json
 */

import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  TEACHING_PROJECTION_RUNTIME_CONTRACT,
  type TeachingProjectionArtifacts,
  type TeachingProjectionAuthoringInput,
  type TeachingProjectionManifest,
} from './contracts';
import {
  TeachingProjectionBuildError,
  buildTeachingProjection,
  verifyTeachingProjectionArtifacts,
} from './builder';
import { projectionCanonicalJson, projectionSha256 } from './hash';

export const teachingProjectionStoreFs = {
  renameSync,
  writeSync,
  openSync,
  closeSync,
  fsyncSync,
};

export interface TeachingProjectionStorePaths {
  root: string;
  currentPointer: string;
  releasesDir: string;
}

export interface TeachingProjectionCurrentPointer {
  contract: 'act-teaching-projection-current/v1';
  projectionId: string;
  projectionHash: string;
  authorityReleaseId: string;
  activatedAt: string;
}

export interface StagedTeachingProjectionFiles {
  projectionId: string;
  projectionHash: string;
  releaseDir: string;
  artifacts: TeachingProjectionArtifacts;
  /** True when an identical projection already existed (idempotent reuse). */
  reused: boolean;
  fileHashes: Record<string, string>;
}

export function resolveTeachingProjectionStorePaths(
  projectionRoot: string,
): TeachingProjectionStorePaths {
  return {
    root: projectionRoot,
    currentPointer: join(projectionRoot, 'current.json'),
    releasesDir: join(projectionRoot, 'releases'),
  };
}

export function ensureTeachingProjectionStore(
  paths: TeachingProjectionStorePaths,
): void {
  mkdirSync(paths.releasesDir, { recursive: true });
}

/**
 * Atomic write: temp + fsync + rename so readers never observe partial files.
 */
export function atomicWriteFile(
  filePath: string,
  content: string,
  options: { fsync?: boolean } = {},
): void {
  const fsync = options.fsync !== false;
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = teachingProjectionStoreFs.openSync(tempPath, 'w');
  try {
    teachingProjectionStoreFs.writeSync(fd, content, undefined, 'utf8');
    if (fsync) teachingProjectionStoreFs.fsyncSync(fd);
  } finally {
    teachingProjectionStoreFs.closeSync(fd);
  }
  teachingProjectionStoreFs.renameSync(tempPath, filePath);
  if (fsync) {
    try {
      const dirFd = teachingProjectionStoreFs.openSync(dirname(filePath), 'r');
      try {
        teachingProjectionStoreFs.fsyncSync(dirFd);
      } finally {
        teachingProjectionStoreFs.closeSync(dirFd);
      }
    } catch {
      // Directory fsync is best-effort.
    }
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonlAtomic(filePath: string, rows: readonly unknown[]): void {
  const body = rows.map((row) => JSON.stringify(row)).join('\n');
  atomicWriteFile(filePath, rows.length > 0 ? `${body}\n` : '');
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function readJsonlFile<T>(filePath: string): T[] {
  const text = readFileSync(filePath, 'utf8');
  if (text.trim().length === 0) return [];
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function fileSha256(filePath: string): string {
  return projectionSha256(readFileSync(filePath));
}

/**
 * Normalized byte representation for determinism tests (JSON with stable keys
 * for objects; JSONL lines already stable via builder sort).
 */
export function stagedProjectionNormalizedBytes(
  releaseDir: string,
): Record<string, string> {
  const names = [
    'resources.jsonl',
    'bindings.jsonl',
    'prerequisites.jsonl',
    'core-nodes.json',
    'cards-index.json',
    'projection-manifest.json',
    'impact-report.json',
    'gate.json',
  ] as const;
  const out: Record<string, string> = {};
  for (const name of names) {
    const full = join(/*turbopackIgnore: true*/ releaseDir, name);
    if (!existsSync(/*turbopackIgnore: true*/ full)) {
      throw new TeachingProjectionBuildError(
        'missing-artifact',
        `missing staged artifact ${name}`,
      );
    }
    if (name.endsWith('.jsonl')) {
      out[name] = readFileSync(/*turbopackIgnore: true*/ full, 'utf8');
    } else {
      // Re-canonicalize object files for hash comparison.
      out[name] = `${projectionCanonicalJson(readJsonFile(full))}\n`;
    }
  }
  return out;
}

export function releaseDirFor(
  paths: TeachingProjectionStorePaths,
  projectionId: string,
): string {
  return join(paths.releasesDir, projectionId);
}

/**
 * Stage an immutable Teaching Projection release directory.
 * Never mutates current.json or engineering selectors.
 * When gate fails (REVIEW_REQUIRED), still stages for review but does not activate.
 */
export function stageTeachingProjection(
  paths: TeachingProjectionStorePaths,
  input: TeachingProjectionAuthoringInput,
): StagedTeachingProjectionFiles {
  ensureTeachingProjectionStore(paths);
  const artifacts = buildTeachingProjection(input);
  return stageTeachingProjectionArtifacts(paths, artifacts);
}

export function stageTeachingProjectionArtifacts(
  paths: TeachingProjectionStorePaths,
  artifacts: TeachingProjectionArtifacts,
): StagedTeachingProjectionFiles {
  ensureTeachingProjectionStore(paths);
  verifyTeachingProjectionArtifacts(artifacts);

  const { projectionId, projectionHash } = artifacts.manifest;
  const dir = releaseDirFor(paths, projectionId);
  const manifestPath = join(dir, 'projection-manifest.json');

  if (existsSync(manifestPath)) {
    const existing = loadStagedTeachingProjection(paths, projectionId);
    verifyTeachingProjectionArtifacts(existing.artifacts);
    if (existing.projectionHash !== projectionHash) {
      throw new TeachingProjectionBuildError(
        'hash-invalid',
        'existing projection identity conflicts with recomputed digest',
      );
    }
    return {
      projectionId,
      projectionHash,
      releaseDir: dir,
      artifacts: existing.artifacts,
      reused: true,
      fileHashes: existing.fileHashes,
    };
  }

  // Stage into a temp directory then rename for atomic publish of the release set.
  const stagingDir = join(
    paths.releasesDir,
    `.staging-${projectionId}.${process.pid}.${randomUUID()}`,
  );
  mkdirSync(stagingDir, { recursive: true });

  try {
    writeJsonlAtomic(join(stagingDir, 'resources.jsonl'), artifacts.resources);
    writeJsonlAtomic(join(stagingDir, 'bindings.jsonl'), artifacts.bindings);
    writeJsonlAtomic(join(stagingDir, 'prerequisites.jsonl'), artifacts.prerequisites);
    writeJsonAtomic(join(stagingDir, 'core-nodes.json'), {
      contract: TEACHING_PROJECTION_RUNTIME_CONTRACT,
      nodes: artifacts.coreNodes,
    });
    writeJsonAtomic(join(stagingDir, 'cards-index.json'), artifacts.cardsIndex);
    writeJsonAtomic(join(stagingDir, 'projection-manifest.json'), artifacts.manifest);
    writeJsonAtomic(join(stagingDir, 'impact-report.json'), artifacts.impactReport);
    writeJsonAtomic(join(stagingDir, 'gate.json'), artifacts.gate);

    mkdirSync(paths.releasesDir, { recursive: true });
    teachingProjectionStoreFs.renameSync(stagingDir, dir);
  } catch (error) {
    try {
      // Best-effort cleanup of incomplete staging dir.
      if (existsSync(stagingDir)) {
        // leave for diagnostics if rename partially failed; only remove if still staging
        writeFileSync(
          join(stagingDir, '.stage-failed'),
          error instanceof Error ? error.message : 'stage failed',
        );
      }
    } catch {
      // ignore cleanup errors
    }
    if (error instanceof TeachingProjectionBuildError) throw error;
    throw new TeachingProjectionBuildError(
      'stage-failed',
      error instanceof Error ? error.message : 'stage failed',
    );
  }

  const fileHashes: Record<string, string> = {};
  for (const name of [
    'resources.jsonl',
    'bindings.jsonl',
    'prerequisites.jsonl',
    'core-nodes.json',
    'cards-index.json',
    'projection-manifest.json',
    'impact-report.json',
    'gate.json',
  ]) {
    fileHashes[name] = fileSha256(join(/*turbopackIgnore: true*/ dir, name));
  }

  return {
    projectionId,
    projectionHash,
    releaseDir: dir,
    artifacts,
    reused: false,
    fileHashes,
  };
}

export type LoadStagedTeachingProjectionOptions = {
  /**
   * Default true. Publish/qualify keep full artifact digest.
   * Request-path readers pass false and trust pointer/sidecar identity.
   */
  verify?: boolean;
};

const requestPathStagedCache = new Map<string, StagedTeachingProjectionFiles>();

export function resetStagedTeachingProjectionRequestCache(): void {
  requestPathStagedCache.clear();
}

export function loadStagedTeachingProjection(
  paths: TeachingProjectionStorePaths,
  projectionId: string,
  options?: LoadStagedTeachingProjectionOptions,
): StagedTeachingProjectionFiles {
  const verify = options?.verify !== false;
  const dir = releaseDirFor(paths, projectionId);
  const manifest = readJsonFile<TeachingProjectionManifest>(
    join(dir, 'projection-manifest.json'),
  );
  const cacheKey = `${dir}:${manifest.projectionId}:${manifest.projectionHash}`;
  if (!verify) {
    const cached = requestPathStagedCache.get(cacheKey);
    if (cached) return cached;
  }

  const resources = readJsonlFile(join(dir, 'resources.jsonl'));
  const bindings = readJsonlFile(join(dir, 'bindings.jsonl'));
  const gate = readJsonFile<TeachingProjectionArtifacts['gate']>(join(dir, 'gate.json'));

  const artifacts: TeachingProjectionArtifacts = verify
    ? {
        resources: resources as TeachingProjectionArtifacts['resources'],
        bindings: bindings as TeachingProjectionArtifacts['bindings'],
        prerequisites: readJsonlFile(join(dir, 'prerequisites.jsonl')) as TeachingProjectionArtifacts['prerequisites'],
        coreNodes: readJsonFile<{ nodes: TeachingProjectionArtifacts['coreNodes'] }>(
          join(dir, 'core-nodes.json'),
        ).nodes,
        cardsIndex: readJsonFile<TeachingProjectionArtifacts['cardsIndex']>(
          join(dir, 'cards-index.json'),
        ),
        manifest,
        impactReport: readJsonFile<TeachingProjectionArtifacts['impactReport']>(
          join(dir, 'impact-report.json'),
        ),
        gate,
      }
    : {
        resources: resources as TeachingProjectionArtifacts['resources'],
        bindings: bindings as TeachingProjectionArtifacts['bindings'],
        prerequisites: [],
        coreNodes: [],
        cardsIndex: { contract: 'act-teaching-projection-cards-index/v1', cards: [] },
        manifest,
        impactReport: {
          contract: 'act-teaching-projection-impact/v1',
          projectionId: manifest.projectionId,
          projectionHash: manifest.projectionHash,
          records: [],
          summary: {
            includedResourceCount: manifest.resourceCount,
            includedBindingCount: manifest.bindingCount,
            notProjectedAuthorityNodeCount: 0,
            gateErrorCount: 0,
          },
        },
        gate,
      };

  if (verify) {
    verifyTeachingProjectionArtifacts(artifacts);
  }

  const fileHashes: Record<string, string> = {};
  if (verify) {
    for (const name of [
      'resources.jsonl',
      'bindings.jsonl',
      'prerequisites.jsonl',
      'core-nodes.json',
      'cards-index.json',
      'projection-manifest.json',
      'impact-report.json',
      'gate.json',
    ]) {
      fileHashes[name] = fileSha256(join(/*turbopackIgnore: true*/ dir, name));
    }
  }

  const loaded = {
    projectionId: manifest.projectionId,
    projectionHash: manifest.projectionHash,
    releaseDir: dir,
    artifacts,
    reused: true,
    fileHashes,
  };
  if (!verify) {
    requestPathStagedCache.set(cacheKey, loaded);
    if (requestPathStagedCache.size > 4) {
      requestPathStagedCache.delete(requestPathStagedCache.keys().next().value!);
    }
  }
  return loaded;
}

/**
 * Activate a staged projection only when the gate passed.
 * Fail closed: REVIEW_REQUIRED projections cannot become current.
 * Does not mutate Engineering Authority selectors or existing activation consumers
 * outside the projection current pointer.
 */
export function activateTeachingProjection(
  paths: TeachingProjectionStorePaths,
  input: {
    projectionId: string;
    activatedAt?: string;
  },
): {
  status: 'activated' | 'failed';
  pointer: TeachingProjectionCurrentPointer | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  let staged: StagedTeachingProjectionFiles;
  try {
    staged = loadStagedTeachingProjection(paths, input.projectionId);
  } catch (error) {
    return {
      status: 'failed',
      pointer: null,
      reasons: [
        error instanceof Error ? error.message : 'failed to load staged projection',
      ],
    };
  }

  if (!staged.artifacts.gate.passed || staged.artifacts.manifest.gatePassed === false) {
    reasons.push('gate-not-passed');
    reasons.push(`gate-status:${staged.artifacts.gate.status}`);
    return { status: 'failed', pointer: null, reasons };
  }

  const pointer: TeachingProjectionCurrentPointer = {
    contract: 'act-teaching-projection-current/v1',
    projectionId: staged.projectionId,
    projectionHash: staged.projectionHash,
    authorityReleaseId: staged.artifacts.manifest.authorityReleaseId,
    activatedAt: input.activatedAt ?? new Date().toISOString(),
  };

  writeJsonAtomic(paths.currentPointer, pointer);
  reasons.push('projection-activated');
  return { status: 'activated', pointer, reasons };
}

export function readCurrentTeachingProjectionPointer(
  paths: TeachingProjectionStorePaths,
): TeachingProjectionCurrentPointer | null {
  if (!existsSync(paths.currentPointer)) return null;
  return readJsonFile<TeachingProjectionCurrentPointer>(paths.currentPointer);
}

export function resolveActiveTeachingProjection(
  paths: TeachingProjectionStorePaths,
): {
  status: 'available' | 'unavailable';
  staged: StagedTeachingProjectionFiles | null;
  detail?: string;
} {
  const pointer = readCurrentTeachingProjectionPointer(paths);
  if (!pointer) {
    return { status: 'unavailable', staged: null, detail: 'current-pointer-missing' };
  }
  try {
    const staged = loadStagedTeachingProjection(paths, pointer.projectionId);
    if (staged.projectionHash !== pointer.projectionHash) {
      return {
        status: 'unavailable',
        staged: null,
        detail: 'pointer-hash-mismatch',
      };
    }
    return { status: 'available', staged };
  } catch (error) {
    return {
      status: 'unavailable',
      staged: null,
      detail: error instanceof Error ? error.message : 'load-failed',
    };
  }
}
