/**
 * Filesystem store for ACT teaching prerequisite publications (#1270).
 *
 * Fail closed: invalid builds do not replace current.json or prior releases.
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

import { projectionCanonicalJson, projectionSha256 } from '../hash';
import {
  assertEngineeringAdoptedReceipts,
  EngineeringLearningOrderReceiptError,
} from './adopt-engineering-learning-order';
import { projectionDigest } from './hash-compat';
import {
  type PrerequisitePublicationArtifacts,
  type PrerequisitePublicationBuildInput,
} from './contracts';
import {
  buildPrerequisitePublication,
  buildPrerequisitePublicationFailClosed,
  PrerequisiteBuildError,
} from './builder';

export const prerequisiteStoreFs = {
  renameSync,
  writeSync,
  openSync,
  closeSync,
  fsyncSync,
};

export interface PrerequisiteStorePaths {
  root: string;
  currentPointer: string;
  releasesDir: string;
}

export interface PrerequisiteCurrentPointer {
  contract: 'act-teaching-prerequisite-current/v1';
  publicationId: string;
  publicationHash: string;
  authorityReleaseId: string;
  activatedAt: string;
}

export interface StagedPrerequisitePublication {
  publicationId: string;
  publicationHash: string;
  releaseDir: string;
  artifacts: PrerequisitePublicationArtifacts;
  reused: boolean;
  /** True when a failed build preserved the prior current release. */
  priorPreserved: boolean;
  findings: PrerequisitePublicationArtifacts['gate']['findings'];
}

export function resolvePrerequisiteStorePaths(root: string): PrerequisiteStorePaths {
  return {
    root,
    currentPointer: join(root, 'current.json'),
    releasesDir: join(root, 'releases'),
  };
}

export function ensurePrerequisiteStore(paths: PrerequisiteStorePaths): void {
  mkdirSync(paths.releasesDir, { recursive: true });
}

function atomicWriteFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = prerequisiteStoreFs.openSync(tempPath, 'w');
  try {
    prerequisiteStoreFs.writeSync(fd, content, undefined, 'utf8');
    prerequisiteStoreFs.fsyncSync(fd);
  } finally {
    prerequisiteStoreFs.closeSync(fd);
  }
  prerequisiteStoreFs.renameSync(tempPath, filePath);
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function readCurrentPrerequisitePointer(
  paths: PrerequisiteStorePaths,
): PrerequisiteCurrentPointer | null {
  if (!existsSync(paths.currentPointer)) return null;
  return readJsonFile<PrerequisiteCurrentPointer>(paths.currentPointer);
}

export function loadPrerequisitePublication(
  paths: PrerequisiteStorePaths,
  publicationId: string,
): PrerequisitePublicationArtifacts {
  const dir = join(paths.releasesDir, publicationId);
  const manifestPath = join(dir, 'publication-manifest.json');
  if (!existsSync(manifestPath)) {
    throw new PrerequisiteBuildError(
      'missing-artifact',
      `missing publication ${publicationId}`,
    );
  }
  const artifacts: PrerequisitePublicationArtifacts = {
    coreNodes: readJsonFile(join(dir, 'core-nodes.json')),
    edges: readJsonFile(join(dir, 'edges.json')),
    candidates: readJsonFile(join(dir, 'candidates.json')),
    derived: readJsonFile(join(dir, 'derived.json')),
    gate: readJsonFile(join(dir, 'gate.json')),
    manifest: readJsonFile(join(dir, 'publication-manifest.json')),
    projectionCoreNodes: readJsonFile(join(dir, 'projection-core-nodes.json')),
    projectionPrerequisites: readJsonFile(
      join(dir, 'projection-prerequisites.json'),
    ),
  };
  const receiptsPath = join(dir, 'engineering-learning-order-receipts.json');
  const receiptsHash = artifacts.manifest.sourceHashes.receipts;
  const adoptedEngineering = artifacts.edges.some((edge) => (
    edge.status === 'PUBLISHED' && edge.candidateOrigin === 'ENGINEERING_RELATION'
  ));
  if (adoptedEngineering && !receiptsHash) {
    throw new PrerequisiteBuildError(
      'hash-invalid',
      `publication ${publicationId} adopted engineering order without hashed receipts`,
    );
  }
  if (receiptsHash) {
    if (!existsSync(receiptsPath)) {
      throw new PrerequisiteBuildError(
        'hash-invalid',
        `publication ${publicationId} is missing hashed engineering-learning-order receipts`,
      );
    }
    const receipts = readJsonFile<NonNullable<PrerequisitePublicationArtifacts['receipts']>>(
      receiptsPath,
    );
    if (projectionDigest(receipts) !== receiptsHash) {
      throw new PrerequisiteBuildError(
        'hash-invalid',
        `publication ${publicationId} engineering-learning-order receipts drifted`,
      );
    }
    artifacts.receipts = receipts;
  } else if (existsSync(receiptsPath)) {
    throw new PrerequisiteBuildError(
      'hash-invalid',
      `publication ${publicationId} has unbound engineering-learning-order receipts`,
    );
  }
  try {
    assertEngineeringAdoptedReceipts({
      edges: artifacts.edges,
      receipts: artifacts.receipts,
    });
  } catch (error) {
    if (error instanceof EngineeringLearningOrderReceiptError) {
      throw new PrerequisiteBuildError('hash-invalid', error.message);
    }
    throw error;
  }
  return artifacts;
}

function stageArtifacts(
  paths: PrerequisiteStorePaths,
  artifacts: PrerequisitePublicationArtifacts,
): StagedPrerequisitePublication {
  ensurePrerequisiteStore(paths);
  const { publicationId, publicationHash } = artifacts.manifest;
  const dir = join(paths.releasesDir, publicationId);
  const manifestPath = join(dir, 'publication-manifest.json');

  if (existsSync(manifestPath)) {
    const existing = loadPrerequisitePublication(paths, publicationId);
    if (existing.manifest.publicationHash !== publicationHash) {
      throw new PrerequisiteBuildError(
        'hash-invalid',
        'existing publication identity conflicts with recomputed digest',
      );
    }
    return {
      publicationId,
      publicationHash,
      releaseDir: dir,
      artifacts: existing,
      reused: true,
      priorPreserved: false,
      findings: existing.gate.findings,
    };
  }

  const stagingDir = join(
    paths.releasesDir,
    `.staging-${publicationId}.${process.pid}.${randomUUID()}`,
  );
  mkdirSync(stagingDir, { recursive: true });
  try {
    writeJsonAtomic(join(stagingDir, 'core-nodes.json'), artifacts.coreNodes);
    writeJsonAtomic(join(stagingDir, 'edges.json'), artifacts.edges);
    writeJsonAtomic(join(stagingDir, 'candidates.json'), artifacts.candidates);
    writeJsonAtomic(join(stagingDir, 'derived.json'), artifacts.derived);
    writeJsonAtomic(join(stagingDir, 'gate.json'), artifacts.gate);
    writeJsonAtomic(join(stagingDir, 'publication-manifest.json'), artifacts.manifest);
    writeJsonAtomic(
      join(stagingDir, 'projection-core-nodes.json'),
      artifacts.projectionCoreNodes,
    );
    writeJsonAtomic(
      join(stagingDir, 'projection-prerequisites.json'),
      artifacts.projectionPrerequisites,
    );
    if (artifacts.receipts && artifacts.receipts.length > 0) {
      writeJsonAtomic(
        join(stagingDir, 'engineering-learning-order-receipts.json'),
        artifacts.receipts,
      );
    }
    prerequisiteStoreFs.renameSync(stagingDir, dir);
  } catch (error) {
    try {
      if (existsSync(stagingDir)) {
        writeFileSync(
          join(stagingDir, '.stage-failed'),
          error instanceof Error ? error.message : 'stage failed',
        );
      }
    } catch {
      // ignore
    }
    if (error instanceof PrerequisiteBuildError) throw error;
    throw new PrerequisiteBuildError(
      'stage-failed',
      error instanceof Error ? error.message : 'stage failed',
    );
  }

  return {
    publicationId,
    publicationHash,
    releaseDir: dir,
    artifacts,
    reused: false,
    priorPreserved: false,
    findings: artifacts.gate.findings,
  };
}

/**
 * Build and stage a publication. On failure, preserve prior current artifact.
 */
export function stagePrerequisitePublication(
  paths: PrerequisiteStorePaths,
  input: PrerequisitePublicationBuildInput & { useCurrentAsPrior?: boolean },
): StagedPrerequisitePublication {
  ensurePrerequisiteStore(paths);

  let prior: PrerequisitePublicationArtifacts | null = input.priorArtifacts ?? null;
  if (!prior && input.useCurrentAsPrior !== false) {
    const current = readCurrentPrerequisitePointer(paths);
    if (current) {
      try {
        prior = loadPrerequisitePublication(paths, current.publicationId);
      } catch {
        prior = null;
      }
    }
  }

  const result = buildPrerequisitePublicationFailClosed({
    ...input,
    priorArtifacts: prior,
  });

  if (!result.ok || !result.artifacts) {
    if (!prior) {
      throw new PrerequisiteBuildError(
        result.errorCode ?? 'publication-rejected',
        result.errorMessage
          ?? 'prerequisite publication rejected and no prior artifact to preserve',
        { findings: result.findings, priorArtifacts: null },
      );
    }
    return {
      publicationId: prior.manifest.publicationId,
      publicationHash: prior.manifest.publicationHash,
      releaseDir: join(paths.releasesDir, prior.manifest.publicationId),
      artifacts: prior,
      reused: true,
      priorPreserved: true,
      findings: result.findings,
    };
  }

  return stageArtifacts(paths, result.artifacts);
}

/**
 * Activate a staged publication only when its gate passed.
 * Does not replace current on failure.
 */
export function activatePrerequisitePublication(
  paths: PrerequisiteStorePaths,
  publicationId: string,
  options: { activatedAt?: string } = {},
): PrerequisiteCurrentPointer {
  const artifacts = loadPrerequisitePublication(paths, publicationId);
  if (!artifacts.gate.passed || artifacts.gate.status !== 'PUBLISHED') {
    throw new PrerequisiteBuildError(
      'activation-blocked',
      `publication ${publicationId} gate did not pass`,
    );
  }

  const pointer: PrerequisiteCurrentPointer = {
    contract: 'act-teaching-prerequisite-current/v1',
    publicationId: artifacts.manifest.publicationId,
    publicationHash: artifacts.manifest.publicationHash,
    authorityReleaseId: artifacts.manifest.authorityReleaseId,
    activatedAt: options.activatedAt ?? new Date(0).toISOString(),
  };
  writeJsonAtomic(paths.currentPointer, pointer);
  return pointer;
}

/** Convenience: build (must pass), stage, and optionally activate. */
export function publishPrerequisitePublication(
  paths: PrerequisiteStorePaths,
  input: PrerequisitePublicationBuildInput,
  options: { activate?: boolean; activatedAt?: string } = {},
): StagedPrerequisitePublication {
  const artifacts = buildPrerequisitePublication({
    ...input,
    priorArtifacts: input.priorArtifacts ?? null,
  });
  const staged = stageArtifacts(paths, artifacts);
  if (options.activate !== false) {
    activatePrerequisitePublication(paths, staged.publicationId, {
      activatedAt: options.activatedAt,
    });
  }
  return staged;
}

export function stagedPrerequisiteNormalizedBytes(
  releaseDir: string,
): Record<string, string> {
  const names = [
    'core-nodes.json',
    'edges.json',
    'candidates.json',
    'derived.json',
    'gate.json',
    'publication-manifest.json',
    'projection-core-nodes.json',
    'projection-prerequisites.json',
  ] as const;
  const out: Record<string, string> = {};
  for (const name of names) {
    const full = join(/*turbopackIgnore: true*/ releaseDir, name);
    out[name] = `${projectionCanonicalJson(JSON.parse(readFileSync(/*turbopackIgnore: true*/ full, 'utf8')))}\n`;
  }
  return out;
}

export function fileSha256Of(path: string): string {
  return projectionSha256(readFileSync(path));
}
