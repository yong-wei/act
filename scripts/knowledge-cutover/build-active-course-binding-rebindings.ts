#!/usr/bin/env tsx
/**
 * Recompute active-course bindings after an approved Authority revision.
 *
 * This is the one-time historical-debt transition: a frozen v0.9 binding is
 * never copied. For every current lesson/step, its exact Runtime atom and the
 * successor Canonical revision are sealed into a new cache identity. Later
 * releases can reuse those identities when neither input changes.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  ACTIVE_COURSE_BINDING_REBINDING_CONTRACT,
  buildActiveCourseBindingRebindings,
  type CourseBindingAuthorityObject,
  type CourseBindingSource,
  type HistoricalCourseBinding,
} from '@/lib/latest-authority-oss-cutover/active-course-binding-rebinding';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const OBLIGATIONS = `${CANDIDATE_ROOT}/active-baseline/baseline-continuity-obligations.json`;
const RUNTIME_OBSERVATION = `${CANDIDATE_ROOT}/active-baseline/production-runtime-observation.json`;
const RUNTIME_SOURCES = `${CANDIDATE_ROOT}/active-baseline/production-active-course-sources.json`;
const LEGACY_PROJECTION = 'course-content/runtime/knowledge/projection/releases/proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d';
const LEGACY_AUTHORITY = 'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7';
const SUCCESSOR_AUTHORITY = 'course-content/authoring/knowledge/authority/releases/snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/active-course-binding-rebindings.json`;

interface ObligationArtifact {
  readonly baselineHash: string;
  readonly entries: readonly {
    readonly resourceId: string;
    readonly obligation: string;
    readonly sourceIdentity: string;
    readonly sourceContentSha256: string | null;
  }[];
}

interface RuntimeObservation {
  readonly manifest: { readonly files: readonly { readonly path: string; readonly sha256: string }[] };
}

interface RuntimeSourceCapture {
  readonly contract: 'production-active-course-source-capture/v1';
  readonly baselineHash: string;
  readonly sourceHash: string;
  readonly files: readonly { readonly path: string; readonly sha256: string; readonly contentBase64: string }[];
}

interface ProjectionManifest {
  readonly projectionId: string;
  readonly projectionHash: string;
  readonly authoritySnapshotHash: string;
  readonly authoringRevision: string;
}

interface ProjectionResource {
  readonly resourceId: string;
  readonly sourcePath: string | null;
  readonly projectionStatus: 'BOUND' | 'EXPLICIT_NONE';
  readonly bindingCount: number;
}

interface ProjectionBinding {
  readonly bindingId: string;
  readonly resourceId: string;
  readonly canonicalId: string;
  readonly role: string;
  readonly scopeId: string;
}

interface AuthorityEngineering {
  readonly objects: readonly {
    readonly canonicalId: string;
    readonly canonicalType: string;
    readonly reviewStatus: string;
    readonly publicationStatus: string;
    readonly payload: unknown;
  }[];
}

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8')) as T;
}

function readJsonl<T>(relativePath: string): T[] {
  return readFileSync(absolute(relativePath), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite divergent active-course binding artifact ${relativePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function runtimePath(value: string | null): string {
  if (!value?.startsWith('course-content/runtime/')) throw new Error(`expected a runtime source path, received ${String(value)}`);
  return value.slice('course-content/runtime/'.length).split('#', 1)[0]!;
}

function authorityObjects(engineering: AuthorityEngineering): CourseBindingAuthorityObject[] {
  return engineering.objects.map((object) => ({
    canonicalId: object.canonicalId,
    canonicalType: object.canonicalType,
    semanticRevision: projectionDigest({
      canonicalId: object.canonicalId,
      canonicalType: object.canonicalType,
      reviewStatus: object.reviewStatus,
      publicationStatus: object.publicationStatus,
      payload: object.payload,
    }),
    reviewStatus: object.reviewStatus,
    publicationStatus: object.publicationStatus,
  }));
}

function parseStepResourceId(resourceId: string): { lessonKey: string; stepId: string } | null {
  const match = /^act:step:([^:]+):([^:]+)$/u.exec(resourceId);
  return match ? { lessonKey: match[1]!, stepId: match[2]! } : null;
}

function parseLessonResourceId(resourceId: string): string | null {
  const match = /^act:lesson:([^:]+)$/u.exec(resourceId);
  return match ? match[1]! : null;
}

function historicalRuntimeJson(revision: string, runtimeRelativePath: string): unknown {
  const sourcePath = `course-content/runtime/${runtimeRelativePath}`;
  const output = execFileSync('git', ['show', `${revision}:${sourcePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(output) as unknown;
}

function currentRuntimeJson(input: {
  readonly entry: ObligationArtifact['entries'][number];
  readonly manifestByPath: ReadonlyMap<string, string>;
  readonly sourceByPath: ReadonlyMap<string, RuntimeSourceCapture['files'][number]>;
}): {
  readonly runtimeRelativePath: string;
  readonly sourceBytes: Buffer;
  readonly sourceJson: unknown;
} {
  const { entry, manifestByPath, sourceByPath } = input;
  const step = parseStepResourceId(entry.resourceId);
  const lessonKey = parseLessonResourceId(entry.resourceId);
  const runtimeRelativePath = step
    ? `lessons/${step.lessonKey}/interactive-manifest.json`
    : lessonKey
      ? `lessons/${lessonKey}/lesson.json`
      : null;
  if (!runtimeRelativePath) throw new Error(`current course resource ${entry.resourceId} has no Runtime path identity`);
  const captured = sourceByPath.get(runtimeRelativePath);
  if (!captured) throw new Error(`production source capture omits ${runtimeRelativePath}`);
  const sourceBytes = Buffer.from(captured.contentBase64, 'base64');
  const actual = sha256(sourceBytes);
  const expectedResourceHash = step
    ? sha256(`${actual}:${step.stepId}`)
    : actual;
  if (captured.sha256 !== actual
    || manifestByPath.get(runtimeRelativePath) !== actual
    || entry.sourceContentSha256 !== expectedResourceHash) {
    throw new Error(`frozen Runtime source drift for ${entry.resourceId}`);
  }
  return { runtimeRelativePath, sourceBytes, sourceJson: JSON.parse(sourceBytes.toString('utf8')) as unknown };
}

function sourceForCourseResource(input: {
  entry: ObligationArtifact['entries'][number];
  manifestByPath: ReadonlyMap<string, string>;
  sourceByPath: ReadonlyMap<string, RuntimeSourceCapture['files'][number]>;
  authoringRevision: string;
}): CourseBindingSource & { readonly historicalAtomContentSha256: string; readonly atomChanged: boolean } {
  const current = currentRuntimeJson(input);
  const step = parseStepResourceId(input.entry.resourceId);
  const lessonKey = parseLessonResourceId(input.entry.resourceId);
  if (step) {
    const currentManifest = current.sourceJson as { readonly steps?: Readonly<Record<string, unknown>> };
    const previousManifest = historicalRuntimeJson(input.authoringRevision, current.runtimeRelativePath) as {
      readonly steps?: Readonly<Record<string, unknown>>;
    };
    const currentAtom = currentManifest.steps?.[step.stepId];
    const historicalAtom = previousManifest.steps?.[step.stepId];
    if (!currentAtom || !historicalAtom) throw new Error(`step atom ${input.entry.resourceId} is absent from the frozen Runtime lineage`);
    const atomContentSha256 = sha256(JSON.stringify(currentAtom));
    const historicalAtomContentSha256 = sha256(JSON.stringify(historicalAtom));
    return {
      resourceId: input.entry.resourceId,
      resourceContentSha256: input.entry.sourceContentSha256!,
      atomId: `atom-${projectionDigest({ resourceId: input.entry.resourceId, atomContentSha256 })}`,
      atomContentSha256,
      sourceIdentity: input.entry.sourceIdentity,
      anchorContract: `runtime-step-anchor/v1:${current.runtimeRelativePath}#steps.${step.stepId}`,
      launcherContract: `runtime-step-launcher/v1:${current.runtimeRelativePath}#${step.stepId}`,
      historicalAtomContentSha256,
      atomChanged: atomContentSha256 !== historicalAtomContentSha256,
    };
  }
  if (lessonKey) {
    const atomContentSha256 = sha256(current.sourceBytes);
    const historical = historicalRuntimeJson(input.authoringRevision, current.runtimeRelativePath);
    const historicalAtomContentSha256 = sha256(JSON.stringify(historical));
    return {
      resourceId: input.entry.resourceId,
      resourceContentSha256: input.entry.sourceContentSha256!,
      atomId: `atom-${projectionDigest({ resourceId: input.entry.resourceId, atomContentSha256 })}`,
      atomContentSha256,
      sourceIdentity: input.entry.sourceIdentity,
      anchorContract: `runtime-lesson-anchor/v1:${current.runtimeRelativePath}`,
      launcherContract: `runtime-lesson-launcher/v1:${current.runtimeRelativePath}`,
      historicalAtomContentSha256,
      atomChanged: atomContentSha256 !== historicalAtomContentSha256,
    };
  }
  throw new Error(`unsupported active-course resource ${input.entry.resourceId}`);
}

function main(): void {
  const outputPath = argValue('--out', DEFAULT_OUTPUT);
  const obligations = readJson<ObligationArtifact>(OBLIGATIONS);
  const observation = readJson<RuntimeObservation>(RUNTIME_OBSERVATION);
  const runtimeSources = readJson<RuntimeSourceCapture>(RUNTIME_SOURCES);
  if (runtimeSources.contract !== 'production-active-course-source-capture/v1' || runtimeSources.baselineHash !== obligations.baselineHash) {
    throw new Error('production source capture does not bind the frozen obligation baseline');
  }
  const predecessorManifest = readJson<ProjectionManifest>(`${LEGACY_PROJECTION}/projection-manifest.json`);
  const predecessorResources = new Map(readJsonl<ProjectionResource>(`${LEGACY_PROJECTION}/resources.jsonl`)
    .map((resource) => [resource.resourceId, resource]));
  const predecessorBindings = readJsonl<ProjectionBinding>(`${LEGACY_PROJECTION}/bindings.jsonl`);
  const predecessorAuthority = authorityObjects(readJson<AuthorityEngineering>(`${LEGACY_AUTHORITY}/engineering.json`));
  const successorAuthority = authorityObjects(readJson<AuthorityEngineering>(`${SUCCESSOR_AUTHORITY}/engineering.json`));
  const manifestByPath = new Map(observation.manifest.files.map((file) => [file.path, file.sha256]));
  const sourceByPath = new Map(runtimeSources.files.map((file) => [file.path, file]));
  const courseEntries = obligations.entries.filter((entry) => (
    entry.obligation === 'FORMAL_TEACHING'
    && (parseStepResourceId(entry.resourceId) !== null || parseLessonResourceId(entry.resourceId) !== null)
  ));
  const sourceRows = courseEntries.map((entry) => sourceForCourseResource({
    entry,
    manifestByPath,
    sourceByPath,
    authoringRevision: predecessorManifest.authoringRevision,
  }));
  const sourceByResourceId = new Map(sourceRows.map((source) => [source.resourceId, source]));
  const resourceIds = new Set(courseEntries.map((entry) => entry.resourceId));
  for (const resourceId of resourceIds) {
    const resource = predecessorResources.get(resourceId);
    if (!resource || resource.projectionStatus !== 'BOUND' || resource.bindingCount < 1) {
      throw new Error(`historical course resource ${resourceId} has no published binding`);
    }
    if (runtimePath(resource.sourcePath) !== currentRuntimeJson({
      entry: courseEntries.find((entry) => entry.resourceId === resourceId)!,
      manifestByPath,
      sourceByPath,
    }).runtimeRelativePath) {
      throw new Error(`historical source path differs for ${resourceId}`);
    }
  }
  const bindings: HistoricalCourseBinding[] = predecessorBindings
    .filter((binding) => resourceIds.has(binding.resourceId))
    .map((binding) => ({
      bindingId: binding.bindingId,
      resourceId: binding.resourceId,
      canonicalId: binding.canonicalId,
      role: binding.role,
      scopeId: binding.scopeId,
    }));
  const pipelineIdentity = projectionDigest({
    contract: ACTIVE_COURSE_BINDING_REBINDING_CONTRACT,
    predecessorProjectionHash: predecessorManifest.projectionHash,
    predecessorAuthoritySnapshotHash: predecessorManifest.authoritySnapshotHash,
    successorAuthoritySnapshot: SUCCESSOR_AUTHORITY,
    runtimeSourceCaptureHash: runtimeSources.sourceHash,
  });
  const result = buildActiveCourseBindingRebindings({
    bindings,
    sources: sourceRows,
    predecessorAuthority,
    successorAuthority,
    qualifiedPipelineIdentity: pipelineIdentity,
  });
  const entries = [...resourceIds].sort().map((resourceId) => {
    const bound = result.entries.filter((entry) => entry.resourceId === resourceId);
    const source = sourceByResourceId.get(resourceId)!;
    return {
      resourceId,
      sourceContentSha256: source.resourceContentSha256,
      atomContentSha256: source.atomContentSha256,
      historicalAtomContentSha256: source.historicalAtomContentSha256,
      atomChanged: source.atomChanged,
      bindingCount: bound.filter((entry) => entry.disposition !== 'BLOCKED').length,
      state: bound.some((entry) => entry.disposition === 'BLOCKED') ? 'BLOCKED' : 'REBOUND',
      evidenceHash: projectionDigest({ resourceId, source, bindings: bound }),
      bindings: bound,
    };
  });
  const artifact = {
    contract: ACTIVE_COURSE_BINDING_REBINDING_CONTRACT,
    baselineHash: obligations.baselineHash,
    predecessor: {
      projectionId: predecessorManifest.projectionId,
      projectionHash: predecessorManifest.projectionHash,
      authoritySnapshotHash: predecessorManifest.authoritySnapshotHash,
      authoringRevision: predecessorManifest.authoringRevision,
    },
    successor: { authoritySnapshotDirectory: SUCCESSOR_AUTHORITY },
    pipelineIdentity,
    summary: {
      ...result.summary,
      resourceCount: entries.length,
      atomChangedCount: entries.filter((entry) => entry.atomChanged).length,
      reboundResourceCount: entries.filter((entry) => entry.state === 'REBOUND').length,
      blockedResourceCount: entries.filter((entry) => entry.state === 'BLOCKED').length,
    },
    entries,
    rebindHash: projectionDigest({ result, entries, pipelineIdentity }),
    sourceInputs: [
      { path: OBLIGATIONS, sha256: sha256(readFileSync(absolute(OBLIGATIONS))) },
      { path: RUNTIME_OBSERVATION, sha256: sha256(readFileSync(absolute(RUNTIME_OBSERVATION))) },
      { path: RUNTIME_SOURCES, sha256: sha256(readFileSync(absolute(RUNTIME_SOURCES))) },
      { path: `${LEGACY_PROJECTION}/projection-manifest.json`, sha256: sha256(readFileSync(absolute(`${LEGACY_PROJECTION}/projection-manifest.json`))) },
      { path: `${LEGACY_PROJECTION}/resources.jsonl`, sha256: sha256(readFileSync(absolute(`${LEGACY_PROJECTION}/resources.jsonl`))) },
      { path: `${LEGACY_PROJECTION}/bindings.jsonl`, sha256: sha256(readFileSync(absolute(`${LEGACY_PROJECTION}/bindings.jsonl`))) },
      { path: `${LEGACY_AUTHORITY}/engineering.json`, sha256: sha256(readFileSync(absolute(`${LEGACY_AUTHORITY}/engineering.json`))) },
      { path: `${SUCCESSOR_AUTHORITY}/engineering.json`, sha256: sha256(readFileSync(absolute(`${SUCCESSOR_AUTHORITY}/engineering.json`))) },
    ],
  };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({ outputPath, state, summary: artifact.summary, rebindHash: artifact.rebindHash }, null, 2)}\n`);
}

main();
