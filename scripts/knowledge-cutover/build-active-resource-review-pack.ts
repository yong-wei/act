#!/usr/bin/env tsx
/**
 * Materialize the first per-resource review pack for a coordinated cutover.
 *
 * The only production input is a previously captured read-only observation.
 * This builder never opens a database, discovers OSS objects, writes a
 * selector, or promotes a name match into a Canonical binding.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  buildActiveResourceReviewPack,
  type ActiveResourceLessonPlacement,
  type ActiveResourceReviewSource,
  type AuthorityReviewObject,
  type LegacyKnowledgeNodeReviewSource,
} from '@/lib/latest-authority-oss-cutover/resource-review';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3';
const DEFAULT_OBSERVATION = `${CANDIDATE_ROOT}/active-resource-review/production-db-observation.json`;
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-resource-review/active-resource-review-pack.json`;
const AUTHORITY_ENGINEERING = 'course-content/authoring/knowledge/authority/releases/snap-e877ad9c516b6649e2c6307f7a0fc27f65d5954ab04effabed02624abdb5967f/engineering.json';
const AUTHORITY_MANIFEST = 'course-content/authoring/knowledge/authority/releases/snap-e877ad9c516b6649e2c6307f7a0fc27f65d5954ab04effabed02624abdb5967f/manifest.json';
const LEGACY_GRAPH = 'course-content/authoring/knowledge/base/knowledge_graph.json';
const NAME_CROSSWALK = 'course-content/authoring/knowledge/formal-resource-remediation/20260823-asr-batch/course-to-authority-map.json';

const REGISTRY_REPAIR_CANDIDATES: Readonly<Record<string, string>> = {
  cmjrywg2v0001wi2jadnsjvz9: 'lesson02-modeling-handout-v1',
  cmjrywg380007wi2jy3k6ptx3: 'lesson02-nyquist-stability-quiz-v1',
  cmjrz8gq50001eg164l86jn57: 'lesson02-legacy-bridge-media-v1',
  cmjrz8gqf0003eg16o5q4uqzr: 'lesson02-legacy-objectives-handout-v1',
  cmjrz8gqg0005eg16dkorzjv5: 'lesson02-legacy-pretest-laws-v1',
  cmjrz8gqn000deg16ybf8kft0: 'lesson02-legacy-launcher-modeling-challenge-v1',
  cmjrz8gqo000feg16q6osuw5h: 'lesson02-legacy-summary-notes-v1',
};

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8')) as T;
}

function sourceFile(relativePath: string): { path: string; sha256: string } {
  const bytes = readFileSync(absolute(relativePath));
  return { path: relativePath, sha256: sha256(bytes) };
}

function writeImmutable(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) {
      throw new Error(`refusing to overwrite diverging review artifact ${relativePath}`);
    }
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function verifyProductionObservation(value: unknown): asserts value is {
  readonly contract: 'active-resource-review-production-observation/v1';
  readonly sourceHash: string;
  readonly teachingResources: readonly ActiveResourceReviewSource[];
  readonly lessonItems: readonly ActiveResourceLessonPlacement[];
} {
  if (!value || typeof value !== 'object') throw new Error('production observation is not an object');
  const row = value as Record<string, unknown>;
  if (row.contract !== 'active-resource-review-production-observation/v1') {
    throw new Error('production observation contract is invalid');
  }
  if (typeof row.sourceHash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.sourceHash)) {
    throw new Error('production observation sourceHash is invalid');
  }
  const source = { ...row };
  delete source.sourceHash;
  if (sha256(JSON.stringify(source)) !== row.sourceHash) {
    throw new Error('production observation sourceHash does not match its captured content');
  }
  if (!Array.isArray(row.teachingResources) || !Array.isArray(row.lessonItems)) {
    throw new Error('production observation omits TeachingResource or LessonItem rows');
  }
}

function authorityObjects(value: {
  readonly objects: readonly {
    readonly canonicalId: string;
    readonly canonicalType: string;
    readonly semanticName: string;
    readonly reviewStatus: string;
    readonly publicationStatus: string;
    readonly payload: unknown;
  }[];
}): AuthorityReviewObject[] {
  return value.objects.map((object) => {
    const outer = object.payload as Record<string, unknown>;
    const nested = outer.payload as Record<string, unknown> | undefined;
    const displayName = String(
      outer.displayName
      ?? nested?.display_name
      ?? object.semanticName,
    );
    return {
      canonicalId: object.canonicalId,
      semanticRevision: projectionDigest({
        canonicalId: object.canonicalId,
        canonicalType: object.canonicalType,
        reviewStatus: object.reviewStatus,
        publicationStatus: object.publicationStatus,
        payload: object.payload,
      }),
      displayName,
    };
  });
}

function legacyNodes(value: { readonly nodes: Record<string, { readonly id: string; readonly name: string }> }): LegacyKnowledgeNodeReviewSource[] {
  return Object.values(value.nodes).map((node) => ({ id: node.id, name: node.name }));
}

function main(): void {
  const observationPath = argValue('--observation', DEFAULT_OBSERVATION);
  const outputPath = argValue('--out', DEFAULT_OUTPUT);
  const observation = readJson<unknown>(observationPath);
  verifyProductionObservation(observation);
  const manifest = readJson<{ readonly releaseId: string; readonly snapshotHash: string }>(AUTHORITY_MANIFEST);
  const engineering = readJson<Parameters<typeof authorityObjects>[0]>(AUTHORITY_ENGINEERING);
  const graph = readJson<Parameters<typeof legacyNodes>[0]>(LEGACY_GRAPH);
  const nameCandidateCrosswalk = readJson<Record<string, string>>(NAME_CROSSWALK);
  const pack = buildActiveResourceReviewPack({
    sourceHash: observation.sourceHash,
    authority: { releaseId: manifest.releaseId, snapshotHash: manifest.snapshotHash },
    resources: observation.teachingResources,
    lessonItems: observation.lessonItems,
    registryMetadata: getAllRegisteredResourceMetadata(),
    legacyNodes: legacyNodes(graph),
    nameCandidateCrosswalk,
    authorityObjects: authorityObjects(engineering),
    registryRepairCandidates: REGISTRY_REPAIR_CANDIDATES,
  });
  const artifact = {
    ...pack,
    sourceInputs: [
      sourceFile(observationPath),
      sourceFile(AUTHORITY_MANIFEST),
      sourceFile(AUTHORITY_ENGINEERING),
      sourceFile(LEGACY_GRAPH),
      sourceFile(NAME_CROSSWALK),
      { path: 'src/lib/resource-registry-metadata.ts', sha256: sha256(readFileSync(absolute('src/lib/resource-registry-metadata.ts'))) },
    ],
  };
  const state = writeImmutable(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    reviewHash: pack.reviewHash,
    summary: pack.summary,
  }, null, 2)}\n`);
}

main();
