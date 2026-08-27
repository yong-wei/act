#!/usr/bin/env tsx
/**
 * Materialize the one-time automatic historical baseline closure.
 *
 * This consumes only sealed production observations and revision-bound course
 * inventory. It does not perform a semantic review, mutate selectors, or
 * inspect arbitrary workspace / OSS objects. Future candidates reuse this
 * baseline and process only declared resource deltas.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildActiveBaselineClassification,
  type ActiveCourseInventoryBaselineResource,
  type RuntimeProjectionBaselineSource,
} from '@/lib/latest-authority-oss-cutover/active-baseline-classifier';
import type { ActiveBaselineEntry } from '@/lib/latest-authority-oss-cutover/contracts';
import { buildActiveCourseInventory } from '@/lib/teaching-projection/active-inventory';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const RUNTIME_OBSERVATION = `${CANDIDATE_ROOT}/active-baseline/production-runtime-observation.json`;
const DB_OBSERVATION = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3/active-resource-review/production-db-observation.json';
const DB_REVIEW_PACK = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3/active-resource-review/active-resource-review-pack.json';
const RUNTIME_PROJECTIONS = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/active-baseline-classification.json`;

interface RuntimeObservation {
  readonly contract: 'active-runtime-manifest-observation/v2';
  readonly activeRelease: {
    readonly releaseId: string;
    readonly sourceRevision: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
    readonly activeReceiptHash: string;
    readonly lifecycleGeneration: number;
  };
  readonly manifest: {
    readonly files: readonly { readonly path: string; readonly sha256: string }[];
  };
  readonly sourceHash: string;
}

interface DbObservation {
  readonly contract: 'active-resource-review-production-observation/v1';
  readonly sourceHash: string;
  readonly activeRuntime: {
    readonly ready: boolean;
    readonly identity: {
      readonly releaseId: string;
      readonly manifestSha256: string;
      readonly treeSha256: string;
    };
  };
  readonly teachingResources: readonly { readonly id: string; readonly type: string; readonly registryId: string | null }[];
  readonly lessonItems: readonly { readonly resourceId: string | null; readonly itemType: string }[];
}

interface DbReviewPack {
  readonly contract: 'active-resource-review-pack/v1';
  readonly sourceHash: string;
  readonly entries: readonly ActiveBaselineEntry[];
  readonly items: readonly {
    readonly dbResourceId: string;
    readonly sourceIdentity: string;
    readonly sourceHash: string;
    readonly courseScope: 'in-course' | 'out-of-course';
  }[];
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

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
}

function assertSourceHash(value: { readonly sourceHash: string }, label: string): void {
  assertHash(value.sourceHash, `${label}.sourceHash`);
  const copy = { ...value } as Record<string, unknown>;
  delete copy.sourceHash;
  if (sha256(JSON.stringify(copy)) !== value.sourceHash) {
    throw new Error(`${label}.sourceHash does not match captured content`);
  }
}

function assertRuntimeObservation(value: RuntimeObservation): void {
  if (value.contract !== 'active-runtime-manifest-observation/v2') {
    throw new Error('Runtime observation does not use v2 source-revision capture');
  }
  assertSourceHash(value, 'Runtime observation');
  if (!/^[a-f0-9]{40}$/u.test(value.activeRelease.sourceRevision)) {
    throw new Error('Runtime observation sourceRevision is invalid');
  }
  if (value.manifest.files.length === 0) throw new Error('Runtime observation has no manifest files');
  for (const file of value.manifest.files) assertHash(file.sha256, `Runtime file ${file.path}`);
}

function assertDbObservation(value: DbObservation, runtime: RuntimeObservation): void {
  if (value.contract !== 'active-resource-review-production-observation/v1') {
    throw new Error('DB observation contract is invalid');
  }
  assertSourceHash(value, 'DB observation');
  if (!value.activeRuntime.ready || value.activeRuntime.identity.releaseId !== runtime.activeRelease.releaseId
    || value.activeRuntime.identity.manifestSha256 !== runtime.activeRelease.manifestSha256
    || value.activeRuntime.identity.treeSha256 !== runtime.activeRelease.treeSha256) {
    throw new Error('DB observation is not bound to the currently captured active Runtime');
  }
}

function assertProjectionBytes(runtime: RuntimeObservation): void {
  const manifest = runtime.manifest.files.find((file) => file.path === 'resource-governance/runtime-resource-projections.jsonl');
  if (!manifest) throw new Error('active Runtime omits resource-governance/runtime-resource-projections.jsonl');
  const local = readFileSync(absolute(RUNTIME_PROJECTIONS));
  if (sha256(local) !== manifest.sha256) throw new Error('local Runtime projection bytes differ from active Runtime manifest');
  const dirty = execFileSync('git', ['status', '--porcelain=v1', '--', RUNTIME_PROJECTIONS], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Runtime projection file is dirty');
  const revisionBytes = execFileSync(
    'git',
    ['show', `${runtime.activeRelease.sourceRevision}:${RUNTIME_PROJECTIONS}`],
    { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  if (sha256(revisionBytes) !== manifest.sha256) {
    throw new Error('active Runtime projection bytes do not match the active Runtime source revision');
  }
}

function dbEntries(pack: DbReviewPack, observation: DbObservation): ActiveBaselineEntry[] {
  if (pack.contract !== 'active-resource-review-pack/v1' || pack.sourceHash !== observation.sourceHash) {
    throw new Error('DB review pack does not bind the production DB observation');
  }
  const itemByResource = new Map(pack.items.map((item) => [item.dbResourceId, item]));
  if (itemByResource.size !== pack.items.length) throw new Error('DB review pack repeats TeachingResource ids');
  const entries = pack.entries.map((entry) => {
    if (!entry.dbResourceId) throw new Error(`DB review entry ${entry.entryId} is missing dbResourceId`);
    const item = itemByResource.get(entry.dbResourceId);
    if (!item) throw new Error(`DB review entry ${entry.entryId} has no review item`);
    assertHash(item.sourceHash, `DB review source ${entry.dbResourceId}`);
    return {
      ...entry,
      sourceIdentity: item.sourceIdentity,
      sourceContentSha256: item.sourceHash,
      dispositionReason: item.courseScope === 'in-course'
        ? 'in-course-db-teaching-resource'
        : 'out-of-course-db-teaching-resource',
    } satisfies ActiveBaselineEntry;
  });
  if (entries.length !== observation.teachingResources.length) {
    throw new Error('DB review pack does not classify every observed TeachingResource');
  }
  return entries;
}

function runtimeProjections(): RuntimeProjectionBaselineSource[] {
  return readFileSync(absolute(RUNTIME_PROJECTIONS), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeProjectionBaselineSource)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging baseline artifact ${relativePath}`);
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
  const runtime = readJson<RuntimeObservation>(RUNTIME_OBSERVATION);
  const db = readJson<DbObservation>(DB_OBSERVATION);
  const reviewPack = readJson<DbReviewPack>(DB_REVIEW_PACK);
  assertRuntimeObservation(runtime);
  assertDbObservation(db, runtime);
  assertProjectionBytes(runtime);
  const inventory = buildActiveCourseInventory({
    repoRoot: ROOT,
    authoringRevision: runtime.activeRelease.sourceRevision,
  });
  const activeCourseResources: ActiveCourseInventoryBaselineResource[] = inventory.packages.flatMap((pkg) => pkg.resources.map((resource) => ({
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    lessonKey: resource.lessonKey,
    ...(resource.stepId ? { stepId: resource.stepId } : {}),
    sourcePath: resource.sourcePath,
    sourceDigest: resource.sourceDigest,
  })));
  const classification = buildActiveBaselineClassification({
    activeRelease: {
      releaseId: runtime.activeRelease.releaseId,
      manifestSha256: runtime.activeRelease.manifestSha256,
      treeSha256: runtime.activeRelease.treeSha256,
      activeReceiptHash: runtime.activeRelease.activeReceiptHash,
      lifecycleGeneration: runtime.activeRelease.lifecycleGeneration,
    },
    manifestFiles: runtime.manifest.files,
    teachingResources: db.teachingResources,
    lessonItemResourceIds: db.lessonItems
      .filter((item) => item.itemType === 'RESOURCE' && typeof item.resourceId === 'string')
      .map((item) => item.resourceId as string),
    databaseEntries: dbEntries(reviewPack, db),
    projections: runtimeProjections(),
    activeCourseResources,
  });
  const artifact = {
    ...classification,
    activeCourseInventory: {
      contract: inventory.contract,
      authoringRevision: inventory.authoringRevision,
      packageCount: inventory.packageCount,
      resourceCount: inventory.resourceCount,
      inventoryDigest: inventory.inventoryDigest,
    },
    sourceInputs: [
      sourceFile(RUNTIME_OBSERVATION),
      sourceFile(DB_OBSERVATION),
      sourceFile(DB_REVIEW_PACK),
      sourceFile(RUNTIME_PROJECTIONS),
    ],
  };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    classificationHash: classification.classificationHash,
    baselineHash: classification.baseline.baselineHash,
    summary: classification.summary,
    activeCourseInventory: artifact.activeCourseInventory,
  }, null, 2)}\n`);
}

main();
