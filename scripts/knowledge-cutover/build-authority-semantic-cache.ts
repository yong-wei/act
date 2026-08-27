#!/usr/bin/env tsx
/**
 * Freeze a reusable semantic cache between two immutable Authority snapshots.
 *
 * This compares Canonical object and relation semantics, not snapshot envelope
 * metadata. The output is an immutable local candidate artifact and makes no
 * selector, runtime, or remote write.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAuthoritySemanticCache,
  type AuthoritySemanticSurface,
} from '@/lib/latest-authority-oss-cutover/authority-semantic-cache';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const DEFAULT_PREDECESSOR = 'course-content/authoring/knowledge/authority/releases/snap-e877ad9c516b6649e2c6307f7a0fc27f65d5954ab04effabed02624abdb5967f';
const DEFAULT_SUCCESSOR = 'course-content/authoring/knowledge/authority/releases/snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/authority-semantic-cache.json`;

interface SnapshotManifest {
  readonly releaseId: string;
  readonly releaseSetId: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly captureRevision: string;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function value(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function snapshotInput(snapshotDir: string): {
  readonly directory: string;
  readonly manifest: SnapshotManifest;
  readonly manifestSha256: string;
  readonly engineeringSha256: string;
  readonly engineering: AuthoritySemanticSurface;
} {
  const directory = absolute(snapshotDir);
  const manifestBytes = readFileSync(path.join(directory, 'manifest.json'));
  const engineeringBytes = readFileSync(path.join(directory, 'engineering.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as SnapshotManifest;
  if (!manifest.releaseId || !manifest.releaseSetId || !manifest.snapshotId || !manifest.snapshotHash) {
    throw new Error(`incomplete Authority manifest ${snapshotDir}`);
  }
  return {
    directory: snapshotDir,
    manifest,
    manifestSha256: sha256(manifestBytes),
    engineeringSha256: sha256(engineeringBytes),
    engineering: JSON.parse(engineeringBytes.toString('utf8')) as AuthoritySemanticSurface,
  };
}

function immutableWrite(filePath: string, artifact: unknown): 'created' | 'verified' {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite divergent semantic cache ${filePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function main(): void {
  const predecessor = snapshotInput(value('--predecessor', DEFAULT_PREDECESSOR));
  const successor = snapshotInput(value('--successor', DEFAULT_SUCCESSOR));
  const cache = buildAuthoritySemanticCache({
    predecessor: predecessor.engineering,
    successor: successor.engineering,
  });
  const artifact = {
    ...cache,
    predecessor: {
      directory: predecessor.directory,
      manifest: predecessor.manifest,
      manifestSha256: predecessor.manifestSha256,
      engineeringSha256: predecessor.engineeringSha256,
    },
    successor: {
      directory: successor.directory,
      manifest: successor.manifest,
      manifestSha256: successor.manifestSha256,
      engineeringSha256: successor.engineeringSha256,
    },
  };
  const outputPath = value('--out', DEFAULT_OUTPUT);
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    cacheHash: cache.cacheHash,
    summary: cache.summary,
    semanticEquivalent: cache.summary.recomputedCount === 0 && cache.summary.retiredCount === 0,
  }, null, 2)}\n`);
}

main();
