#!/usr/bin/env tsx
/**
 * Recover only the byte-level source identity missing from active Runtime
 * media projections.  It verifies every selected media index against the
 * production-captured manifest and never carries its legacy external URL into
 * the evidence artifact.  This remains evidence for a later formal binding,
 * not a binding decision by itself.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildRuntimeMediaSourceBridge } from '@/lib/latest-authority-oss-cutover/runtime-media-source-bridge';
import { parseRuntimeLessonMediaDocument } from '@/lib/runtime-lesson-media-document';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3';
const RUNTIME_OBSERVATION = `${CANDIDATE_ROOT}/active-resource-review/production-runtime-observation.json`;
const RUNTIME_PROJECTIONS = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-resource-review/active-runtime-media-source-bridge.json`;

interface RuntimeFile {
  readonly path: string;
  readonly sha256: string;
}

interface RuntimeObservation {
  readonly contract: 'active-runtime-manifest-observation/v1';
  readonly activeRelease: {
    readonly releaseId: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
    readonly activeReceiptHash: string;
    readonly lifecycleGeneration: number;
  };
  readonly manifest: { readonly files: readonly RuntimeFile[] };
  readonly sourceHash: string;
}

interface RuntimeProjection {
  readonly id: string;
  readonly family: string;
  readonly sourceHash: string | null;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8')) as T;
}

function sourceFile(relativePath: string): { path: string; sha256: string } {
  return { path: relativePath, sha256: sha256(readFileSync(absolute(relativePath))) };
}

function assertObservation(value: unknown): asserts value is RuntimeObservation {
  if (!value || typeof value !== 'object') throw new Error('runtime observation is not an object');
  const row = value as Record<string, unknown>;
  if (row.contract !== 'active-runtime-manifest-observation/v1' || typeof row.sourceHash !== 'string') {
    throw new Error('runtime observation contract is invalid');
  }
  const source = { ...row };
  delete source.sourceHash;
  if (sha256(JSON.stringify(source)) !== row.sourceHash) throw new Error('runtime observation sourceHash is invalid');
}

function readMissingMediaProjections(): RuntimeProjection[] {
  const rows = readFileSync(absolute(RUNTIME_PROJECTIONS), 'utf8').trim().split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeProjection)
    .filter((row) => row.family === 'runtime-lesson-media' && row.sourceHash === null)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (rows.length === 0) throw new Error('active Runtime projections contain no source-less media rows');
  if (rows.some((row) => !/^runtime-media:[^:]+:[^:]+$/u.test(row.id))) {
    throw new Error('active Runtime projections contain an invalid media resource id');
  }
  return rows;
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging media source bridge ${relativePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function main(): void {
  const outputPath = argValue('--out', DEFAULT_OUTPUT);
  const observation = readJson<unknown>(RUNTIME_OBSERVATION);
  assertObservation(observation);
  const filesByPath = new Map(observation.manifest.files.map((file) => [file.path, file]));
  const projectionManifest = filesByPath.get('resource-governance/runtime-resource-projections.jsonl');
  if (!projectionManifest) throw new Error('active Runtime manifest omits runtime projections');
  const projectionSource = sourceFile(RUNTIME_PROJECTIONS);
  if (projectionSource.sha256 !== projectionManifest.sha256) {
    throw new Error('local runtime projections do not match the production-active Runtime manifest');
  }

  const missingProjections = readMissingMediaProjections();
  const lessonKeys = [...new Set(missingProjections.map((row) => row.id.split(':')[1]!))].sort();
  const mediaIndexes = lessonKeys.map((lessonKey) => {
    const runtimePath = `lessons/${lessonKey}/media/${lessonKey}-media.md`;
    const manifest = filesByPath.get(runtimePath);
    if (!manifest) throw new Error(`active Runtime manifest omits media index ${runtimePath}`);
    const bytes = readFileSync(absolute(`course-content/runtime/${runtimePath}`));
    if (sha256(bytes) !== manifest.sha256) {
      throw new Error(`local media index does not match the production-active Runtime manifest: ${runtimePath}`);
    }
    const document = parseRuntimeLessonMediaDocument(bytes.toString('utf8'));
    return {
      lessonKey,
      runtimePath,
      sha256: manifest.sha256,
      filenames: document.mediaResources.map((resource) => resource.filename),
    };
  });

  const bridge = buildRuntimeMediaSourceBridge({
    activeRelease: observation.activeRelease,
    manifestFiles: observation.manifest.files,
    mediaIndexes,
    missingProjections: missingProjections.map(({ id }) => ({ id, sourceHash: null })),
  });
  const review = {
    ...bridge,
    runtimeObservationHash: observation.sourceHash,
    projectionArtifact: projectionSource,
    formalBindingState: 'NOT_A_FORMAL_BINDING' as const,
    blockers: bridge.items.filter((item) => item.blockerCodes.length > 0)
      .map((item) => ({ resourceId: item.resourceId, blockerCodes: item.blockerCodes })),
  };
  const artifact = {
    ...review,
    reviewHash: projectionDigest(review),
    sourceInputs: [sourceFile(RUNTIME_OBSERVATION), projectionSource, ...mediaIndexes.map((index) => ({
      path: `course-content/runtime/${index.runtimePath}`,
      sha256: index.sha256,
    }))],
  };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    reviewHash: artifact.reviewHash,
    recoveredCount: bridge.recoveredCount,
    missingCount: bridge.missingCount,
  }, null, 2)}\n`);
}

main();
