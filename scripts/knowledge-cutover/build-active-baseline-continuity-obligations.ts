#!/usr/bin/env tsx
/**
 * Materialize automatic continuity obligations for the frozen active Runtime.
 *
 * The output is intentionally a machine ledger, not a reviewer queue. It
 * retains every logical resource, reuses only exact formal source evidence,
 * and leaves genuinely incomplete current-path records fail-closed.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildBaselineContinuityObligationLedger,
  type BaselineObligationSource,
  type ReopenedFormalProjectionEvidence,
} from '@/lib/latest-authority-oss-cutover/baseline-continuity-obligation';
import type { ActiveBaseline, ActiveBaselineEntry } from '@/lib/latest-authority-oss-cutover/contracts';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const CLASSIFICATION = `${CANDIDATE_ROOT}/active-baseline/active-baseline-classification.json`;
const ACTIVE_PROJECTIONS = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const ACTIVE_COURSE_REBINDINGS = `${CANDIDATE_ROOT}/active-baseline/active-course-binding-rebindings.json`;
const LEGACY_PROJECTION = 'course-content/runtime/knowledge/projection/releases/proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d';
const R4_PROJECTION = 'course-content/runtime/knowledge/projection/releases/proj-5bc0977b4bb126e243a453530db515c9e5cf74f5e0a24352579ddf5972330342';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-baseline/baseline-continuity-obligations.json`;

interface ClassificationArtifact {
  readonly contract: 'active-runtime-baseline-classification/v1';
  readonly baseline: ActiveBaseline;
  readonly entries: readonly ActiveBaselineEntry[];
  readonly activeRelease: { readonly manifestSha256: string };
  readonly sourceInputs: readonly { readonly path: string; readonly sha256: string }[];
}

interface RuntimeProjection {
  readonly id: string;
  readonly resourceNodeId: string | null;
  readonly sourceHash: string | null;
  readonly lifecycleScope?: 'audit-only';
  readonly pathEligibility?: {
    readonly current?: boolean;
    readonly blockedBy?: readonly string[];
  };
  readonly retrievalChunk?: {
    readonly pathEligible?: boolean;
  };
}

interface FormalProjectionResource {
  readonly resourceId: string;
  readonly sourcePath: string | null;
  readonly bindingCount: number;
  readonly projectionStatus: 'BOUND' | 'EXPLICIT_NONE';
  readonly bindingDigest: string | null;
}

interface FormalProjectionManifest {
  readonly projectionId: string;
  readonly authoritySnapshotId: string;
  readonly authoritySnapshotHash: string;
  readonly gatePassed: boolean;
}

interface RuntimeObservation {
  readonly manifest: { readonly files: readonly { readonly path: string; readonly sha256: string }[] };
}

interface ActiveCourseRebindingArtifact {
  readonly contract: 'active-course-binding-rebinding/v1';
  readonly baselineHash: string;
  readonly entries: readonly {
    readonly resourceId: string;
    readonly sourceContentSha256: string;
    readonly bindingCount: number;
    readonly state: 'REBOUND' | 'BLOCKED';
    readonly evidenceHash: string;
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

function digest(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function normalizeHash(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
  return /^[a-f0-9]{64}$/u.test(normalized) ? normalized : null;
}

function runtimePath(value: string | null): string | null {
  if (!value) return null;
  const filePath = value.split('#', 1)[0];
  return filePath.startsWith('course-content/runtime/')
    ? filePath.slice('course-content/runtime/'.length)
    : null;
}

function formalContentHash(
  row: FormalProjectionResource,
  manifestByPath: ReadonlyMap<string, string>,
): string | null {
  if (row.sourcePath?.startsWith('content:')) return normalizeHash(row.sourcePath.slice('content:'.length));
  const sourcePath = runtimePath(row.sourcePath);
  return sourcePath ? (manifestByPath.get(sourcePath) ?? null) : null;
}

function formalEvidence(
  row: FormalProjectionResource | undefined,
  manifest: FormalProjectionManifest,
  manifestByPath: ReadonlyMap<string, string>,
): ReopenedFormalProjectionEvidence | null {
  if (!row || !manifest.gatePassed || !row.bindingDigest && row.projectionStatus === 'BOUND') return null;
  return {
    resourceId: row.resourceId,
    sourceContentSha256: formalContentHash(row, manifestByPath),
    projectionStatus: row.projectionStatus,
    canonicalBindingCount: row.bindingCount,
    // A published projection proves its historical binding only. It cannot
    // satisfy the successor's atomic gate until a same-Authority semantic
    // cache records the exact reusable atom and launcher evidence.
    atomicDispositionsComplete: false,
    launchContractQualified: true,
    evidenceHash: digest({
      projectionId: manifest.projectionId,
      authoritySnapshotId: manifest.authoritySnapshotId,
      authoritySnapshotHash: manifest.authoritySnapshotHash,
      resource: row,
    }),
  };
}

function rebindEvidence(input: {
  readonly row: ActiveCourseRebindingArtifact['entries'][number] | undefined;
  readonly sourceContentSha256: string | null;
}): ReopenedFormalProjectionEvidence | null {
  const { row, sourceContentSha256 } = input;
  if (!row || row.sourceContentSha256 !== sourceContentSha256) return null;
  return {
    resourceId: row.resourceId,
    sourceContentSha256: row.sourceContentSha256,
    projectionStatus: 'BOUND',
    canonicalBindingCount: row.state === 'REBOUND' ? row.bindingCount : 0,
    atomicDispositionsComplete: row.state === 'REBOUND' && row.bindingCount > 0,
    launchContractQualified: row.state === 'REBOUND' && row.bindingCount > 0,
    evidenceHash: row.evidenceHash,
  };
}

function candidateResourceId(projectionId: string): string | null {
  const separator = projectionId.indexOf(':');
  if (separator < 0) return null;
  const prefix = projectionId.slice(0, separator);
  const suffix = projectionId.slice(separator + 1);
  if (prefix === 'knowledge-card') return `act:card:${suffix}`;
  return null;
}

function sourceForEntry(input: {
  entry: ActiveBaselineEntry;
  projectionById: ReadonlyMap<string, RuntimeProjection>;
  r4ByResourceId: ReadonlyMap<string, FormalProjectionResource>;
  legacyByResourceId: ReadonlyMap<string, FormalProjectionResource>;
  r4Manifest: FormalProjectionManifest;
  legacyManifest: FormalProjectionManifest;
  manifestByPath: ReadonlyMap<string, string>;
  rebindingsByResourceId: ReadonlyMap<string, ActiveCourseRebindingArtifact['entries'][number]>;
}): BaselineObligationSource {
  const { entry } = input;
  if (!entry.resourceId || !entry.sourceIdentity) {
    throw new Error(`Baseline entry ${entry.entryId} is missing resource/source identity`);
  }
  const projectionId = entry.entryId.startsWith('runtime-projection:')
    ? entry.entryId.slice('runtime-projection:'.length)
    : null;
  const runtimeProjection = projectionId ? input.projectionById.get(projectionId) : null;
  const currentPathEligible = runtimeProjection?.pathEligibility?.current === true
    && runtimeProjection.retrievalChunk?.pathEligible === true
    && (runtimeProjection.pathEligibility.blockedBy?.length ?? 0) === 0;
  if (runtimeProjection) {
    const candidateId = candidateResourceId(runtimeProjection.id);
    const r4 = candidateId ? formalEvidence(
      input.r4ByResourceId.get(candidateId),
      input.r4Manifest,
      input.manifestByPath,
    ) : null;
    const legacy = formalEvidence(
      input.legacyByResourceId.get(entry.resourceId),
      input.legacyManifest,
      input.manifestByPath,
    );
    const rebound = rebindEvidence({
      row: input.rebindingsByResourceId.get(entry.resourceId),
      sourceContentSha256: entry.sourceContentSha256 ?? null,
    });
    const formal = rebound ?? r4 ?? legacy;
    const activeCourseResource = entry.resourceId.startsWith('act:step:')
      || entry.resourceId.startsWith('act:lesson:')
      || entry.resourceId.startsWith('act:handout:');
    return {
      resourceId: entry.resourceId,
      sourceKind: currentPathEligible ? 'CURRENT_COURSE_PATH'
        : runtimeProjection.resourceNodeId ? 'RUNTIME_RESOURCE_NODE' : 'RUNTIME_SUPPORT',
      sourceIdentity: entry.sourceIdentity,
      sourceContentSha256: entry.sourceContentSha256 ?? null,
      teachingRequired: activeCourseResource && formal?.projectionStatus !== 'EXPLICIT_NONE',
      currentPathEligible,
      formalProjection: formal,
    };
  }

  const legacy = formalEvidence(
    input.legacyByResourceId.get(entry.resourceId),
    input.legacyManifest,
    input.manifestByPath,
  );
  const rebound = rebindEvidence({
    row: input.rebindingsByResourceId.get(entry.resourceId),
    sourceContentSha256: entry.sourceContentSha256 ?? null,
  });
  const formal = rebound ?? legacy;
  const activeCourse = entry.dispositionReason === 'active-course-identity-registry-resource';
  const legacyExplicitNone = formal?.projectionStatus === 'EXPLICIT_NONE';
  return {
    resourceId: entry.resourceId,
    sourceKind: activeCourse
      ? 'CURRENT_COURSE_PATH'
      : entry.courseScope === 'in-course' ? 'RUNTIME_SUPPORT' : 'CATALOG_ENTRY',
    sourceIdentity: entry.sourceIdentity,
    sourceContentSha256: entry.sourceContentSha256 ?? null,
    // Database-backed LessonItem placement selects a renderer or activity
    // instance. It is not, by itself, a claim that the reusable platform
    // component is a Canonical teaching object. Such semantic content is
    // governed by the runtime course atom or an explicit formal projection.
    teachingRequired: activeCourse && !legacyExplicitNone,
    currentPathEligible: activeCourse && !legacyExplicitNone,
    formalProjection: formal,
  };
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite divergent obligation ledger ${relativePath}`);
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
  const classification = readJson<ClassificationArtifact>(CLASSIFICATION);
  if (classification.contract !== 'active-runtime-baseline-classification/v1') {
    throw new Error('active baseline classification contract is invalid');
  }
  const runtimeInput = classification.sourceInputs.find((item) => item.path.endsWith('production-runtime-observation.json'));
  if (!runtimeInput) throw new Error('classification omits the production Runtime observation');
  const runtimeObservation = readJson<RuntimeObservation>(runtimeInput.path);
  const manifestByPath = new Map(runtimeObservation.manifest.files.map((file) => [file.path, file.sha256]));
  const projectionBytes = readFileSync(absolute(ACTIVE_PROJECTIONS));
  const projectionInput = classification.sourceInputs.find((item) => item.path === ACTIVE_PROJECTIONS);
  if (!projectionInput || sha256(projectionBytes) !== projectionInput.sha256) {
    throw new Error('runtime projection bytes differ from the frozen classification input');
  }
  const projectionById = new Map(readJsonl<RuntimeProjection>(ACTIVE_PROJECTIONS).map((item) => [item.id, item]));
  const r4Manifest = readJson<FormalProjectionManifest>(`${R4_PROJECTION}/projection-manifest.json`);
  const legacyManifest = readJson<FormalProjectionManifest>(`${LEGACY_PROJECTION}/projection-manifest.json`);
  const rebindings = readJson<ActiveCourseRebindingArtifact>(ACTIVE_COURSE_REBINDINGS);
  if (rebindings.contract !== 'active-course-binding-rebinding/v1'
    || rebindings.baselineHash !== classification.baseline.baselineHash) {
    throw new Error('active-course binding rebindings do not bind the frozen baseline');
  }
  const r4ByResourceId = new Map(readJsonl<FormalProjectionResource>(`${R4_PROJECTION}/resources.jsonl`)
    .map((item) => [item.resourceId, item]));
  const legacyByResourceId = new Map(readJsonl<FormalProjectionResource>(`${LEGACY_PROJECTION}/resources.jsonl`)
    .map((item) => [item.resourceId, item]));
  const rebindingsByResourceId = new Map(rebindings.entries.map((entry) => [entry.resourceId, entry]));
  const sources = classification.baseline.entries
    .filter((entry) => entry.classification === 'resource')
    .map((entry) => sourceForEntry({
      entry,
      projectionById,
      r4ByResourceId,
      legacyByResourceId,
      r4Manifest,
      legacyManifest,
      manifestByPath,
      rebindingsByResourceId,
    }));
  const ledger = buildBaselineContinuityObligationLedger({ baseline: classification.baseline, sources });
  const artifact = {
    ...ledger,
    sourceInputs: [
      { path: CLASSIFICATION, sha256: sha256(readFileSync(absolute(CLASSIFICATION))) },
      { path: ACTIVE_PROJECTIONS, sha256: sha256(projectionBytes) },
      { path: `${R4_PROJECTION}/projection-manifest.json`, sha256: sha256(readFileSync(absolute(`${R4_PROJECTION}/projection-manifest.json`))) },
      { path: `${R4_PROJECTION}/resources.jsonl`, sha256: sha256(readFileSync(absolute(`${R4_PROJECTION}/resources.jsonl`))) },
      { path: `${LEGACY_PROJECTION}/projection-manifest.json`, sha256: sha256(readFileSync(absolute(`${LEGACY_PROJECTION}/projection-manifest.json`))) },
      { path: `${LEGACY_PROJECTION}/resources.jsonl`, sha256: sha256(readFileSync(absolute(`${LEGACY_PROJECTION}/resources.jsonl`))) },
      { path: ACTIVE_COURSE_REBINDINGS, sha256: sha256(readFileSync(absolute(ACTIVE_COURSE_REBINDINGS))) },
    ],
  };
  const state = immutableWrite(outputPath, artifact);
  const unresolvedFormalTeaching = ledger.entries
    .filter((entry) => entry.obligation === 'FORMAL_TEACHING' && entry.disposition.canonicalBindingCount === 0)
    .map((entry) => entry.resourceId);
  process.stdout.write(`${JSON.stringify({
    outputPath,
    state,
    baselineHash: ledger.baselineHash,
    obligationHash: ledger.obligationHash,
    summary: ledger.summary,
    unresolvedFormalTeachingCount: unresolvedFormalTeaching.length,
    unresolvedFormalTeachingHash: digest(unresolvedFormalTeaching),
    unresolvedFormalTeachingSample: unresolvedFormalTeaching.slice(0, 12),
  }, null, 2)}\n`);
}

main();
