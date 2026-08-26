#!/usr/bin/env tsx
/**
 * Reopen the exact active Runtime v2 file set as a review ledger.  This is a
 * pre-baseline artifact: it makes every Runtime carrier and every existing
 * resource projection visible without treating old remediation output, a
 * projection row, or a name match as a formal Canonical binding.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c3';
const RUNTIME_OBSERVATION = `${CANDIDATE_ROOT}/active-resource-review/production-runtime-observation.json`;
const RESOURCE_REVIEW = `${CANDIDATE_ROOT}/active-resource-review/active-resource-review-pack.json`;
const RUNTIME_PROJECTIONS = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const LEGACY_PREPARE_INPUT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-remediation/prepare-input.json';
const DEFAULT_OUTPUT = `${CANDIDATE_ROOT}/active-resource-review/active-runtime-inventory-review.json`;

type ProjectionScope = 'AUDIT_ONLY' | 'STUDENT_VISIBLE_UNRESOLVED';

interface RuntimeFile {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly contentType: string | null;
}

interface RuntimeObservation {
  readonly contract: 'active-runtime-manifest-observation/v1';
  readonly capturedAt: string;
  readonly activeRelease: {
    readonly releaseId: string;
    readonly manifestSha256: string;
    readonly treeSha256: string;
    readonly activeReceiptHash: string;
    readonly lifecycleGeneration: number;
  };
  readonly manifest: {
    readonly path: string;
    readonly wireSha256: string;
    readonly files: readonly RuntimeFile[];
  };
  readonly sourceHash: string;
}

interface RuntimeProjectionRow {
  readonly id: string;
  readonly family: string;
  readonly resourceType: string;
  readonly sourceKind: string;
  readonly sourcePathOrUrl: string | null;
  readonly sourceHash: string | null;
  readonly resourceNodeId: string | null;
  readonly projectionLevel: string;
  readonly lifecycleScope?: 'audit-only';
  readonly reviewConcluded?: boolean;
  readonly semanticConfirmed?: boolean;
  readonly reviewAudit: { readonly status: string };
  readonly pathEligibility: {
    readonly current: boolean;
    readonly afterCompletion: boolean;
    readonly masteryAffecting: boolean;
    readonly blockedBy: readonly string[];
  };
  readonly renderTarget: string | null;
  readonly routeTarget: string | null;
  readonly citationTargets: readonly string[];
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
  if (sha256(JSON.stringify(source)) !== row.sourceHash) {
    throw new Error('runtime observation sourceHash does not match its captured content');
  }
  const observation = value as RuntimeObservation;
  if (!Array.isArray(observation.manifest?.files) || observation.manifest.files.length === 0) {
    throw new Error('runtime observation has no manifest files');
  }
}

function normalizeRuntimePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('course-content/runtime/')) return value.slice('course-content/runtime/'.length);
  if (value.startsWith('/course-runtime/')) return value.slice('/course-runtime/'.length);
  return null;
}

function sourceLocatorKind(value: string | null): 'local-runtime' | 'local-authoring' | 'external-redacted' | 'other' | 'missing' {
  if (!value) return 'missing';
  if (value.startsWith('course-content/runtime/') || value.startsWith('/course-runtime/')) return 'local-runtime';
  if (value.startsWith('course-content/authoring/')) return 'local-authoring';
  if (/^https?:\/\//iu.test(value)) return 'external-redacted';
  return 'other';
}

function readProjectionRows(): RuntimeProjectionRow[] {
  const rows = readFileSync(absolute(RUNTIME_PROJECTIONS), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeProjectionRow)
    .sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.id || ids.has(row.id)) throw new Error(`runtime projection identity is invalid or repeated: ${row.id}`);
    if (row.sourceHash !== null && !/^(?:sha256:)?[a-f0-9]{64}$/u.test(row.sourceHash)) {
      throw new Error(`runtime projection source hash is invalid: ${row.id}`);
    }
    ids.add(row.id);
  }
  return rows;
}

function immutableWrite(relativePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) {
      throw new Error(`refusing to overwrite diverging active runtime inventory review ${relativePath}`);
    }
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
  const manifestProjection = observation.manifest.files.find((file) => file.path === 'resource-governance/runtime-resource-projections.jsonl');
  if (!manifestProjection) throw new Error('active runtime manifest omits runtime-resource-projections.jsonl');
  const projectionSource = sourceFile(RUNTIME_PROJECTIONS);
  if (projectionSource.sha256 !== manifestProjection.sha256) {
    throw new Error('local runtime-resource-projections.jsonl does not match the active Runtime manifest');
  }

  const resourceReview = readJson<{ readonly sourceHash: string; readonly summary: Record<string, unknown> }>(RESOURCE_REVIEW);
  if (!resourceReview.sourceHash || !resourceReview.summary) throw new Error('active TeachingResource review pack is invalid');
  const legacyPrepare = readJson<{ readonly activeRelease?: { readonly releaseId?: string } }>(LEGACY_PREPARE_INPUT);
  if (legacyPrepare.activeRelease?.releaseId === observation.activeRelease.releaseId) {
    throw new Error('legacy remediation prepare input unexpectedly claims the current active Runtime release');
  }

  const filesByPath = new Map(observation.manifest.files.map((file) => [file.path, file]));
  const projections = readProjectionRows();
  const projectedByRuntimePath = new Map<string, RuntimeProjectionRow[]>();
  const unresolvedReferenceCounts = new Map<string, number>();
  for (const projection of projections) {
    const seenPaths = new Set<string>();
    for (const value of [
      projection.sourcePathOrUrl,
      projection.renderTarget,
      projection.routeTarget,
      ...projection.citationTargets,
    ]) {
      const runtimePath = normalizeRuntimePath(value);
      if (!runtimePath || seenPaths.has(runtimePath)) continue;
      seenPaths.add(runtimePath);
      if (!filesByPath.has(runtimePath)) {
        const key = `${projection.family}:${sourceLocatorKind(value)}`;
        unresolvedReferenceCounts.set(key, (unresolvedReferenceCounts.get(key) ?? 0) + 1);
        continue;
      }
      const rows = projectedByRuntimePath.get(runtimePath) ?? [];
      rows.push(projection);
      projectedByRuntimePath.set(runtimePath, rows);
    }
  }

  const projectionItems = projections.map((projection) => {
    const directRuntimePaths = [...projectedByRuntimePath.entries()]
      .filter(([, rows]) => rows.some((row) => row.id === projection.id))
      .map(([runtimePath]) => runtimePath)
      .sort();
    const scope: ProjectionScope = projection.lifecycleScope === 'audit-only'
      ? 'AUDIT_ONLY'
      : 'STUDENT_VISIBLE_UNRESOLVED';
    return {
      id: projection.id,
      family: projection.family,
      resourceType: projection.resourceType,
      sourceKind: projection.sourceKind,
      sourceHash: projection.sourceHash,
      sourceIdentityState: projection.sourceHash ? 'PRESENT' as const : 'MISSING' as const,
      sourceLocatorKind: sourceLocatorKind(projection.sourcePathOrUrl),
      sourceLocatorHash: projection.sourcePathOrUrl ? sha256(projection.sourcePathOrUrl) : null,
      resourceNodeId: projection.resourceNodeId,
      projectionLevel: projection.projectionLevel,
      reviewStatus: projection.reviewAudit.status,
      reviewConcluded: projection.reviewConcluded === true,
      semanticConfirmed: projection.semanticConfirmed === true,
      pathEligibility: projection.pathEligibility,
      directRuntimePaths,
      scope,
      formalBindingState: 'UNVERIFIED' as const,
      disposition: scope === 'AUDIT_ONLY' ? 'EXPLICIT_NON_TEACHING_REVIEW_REQUIRED' : 'FORMAL_ATOMIC_BINDING_REQUIRED',
    };
  });

  const manifestLedger = observation.manifest.files.map((file) => {
    const projected = (projectedByRuntimePath.get(file.path) ?? []).filter((row) => row.lifecycleScope !== 'audit-only');
    return {
      runtimePath: file.path,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
      carrierState: projected.length > 0 ? 'PROJECTED_RESOURCE_CARRIER' as const : 'EXPLICIT_DISPOSITION_REQUIRED' as const,
      projectedResourceIds: projected.map((row) => row.id).sort(),
    };
  });

  const summary = {
    manifestFileCount: manifestLedger.length,
    projectedResourceCarrierFileCount: manifestLedger.filter((row) => row.carrierState === 'PROJECTED_RESOURCE_CARRIER').length,
    explicitDispositionRequiredFileCount: manifestLedger.filter((row) => row.carrierState === 'EXPLICIT_DISPOSITION_REQUIRED').length,
    runtimeProjectionCount: projectionItems.length,
    auditOnlyProjectionCount: projectionItems.filter((row) => row.scope === 'AUDIT_ONLY').length,
    studentVisibleProjectionCount: projectionItems.filter((row) => row.scope === 'STUDENT_VISIBLE_UNRESOLVED').length,
    projectionRowsWithCurrentPathEligibility: projectionItems.filter((row) => row.pathEligibility.current).length,
    projectionRowsWithConcludedReview: projectionItems.filter((row) => row.reviewConcluded).length,
    projectionRowsMissingSourceIdentity: projectionItems.filter((row) => row.sourceIdentityState === 'MISSING').length,
    projectionRowsWithVerifiedFormalBinding: 0,
    unresolvedReferenceCounts: Object.fromEntries([...unresolvedReferenceCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
  const review = {
    contract: 'active-runtime-inventory-review/v1',
    activeRelease: observation.activeRelease,
    runtimeObservationHash: observation.sourceHash,
    runtimeManifest: {
      path: observation.manifest.path,
      wireSha256: observation.manifest.wireSha256,
      resourceProjectionSha256: manifestProjection.sha256,
    },
    activeTeachingResourceReview: {
      sourceHash: resourceReview.sourceHash,
      summary: resourceReview.summary,
    },
    legacyRemediation: {
      prepareInputPath: LEGACY_PREPARE_INPUT,
      predecessorReleaseId: legacyPrepare.activeRelease?.releaseId ?? null,
      usableForCurrentBaseline: false,
      reason: 'predecessor-runtime-identity-does-not-match-current-active-runtime',
    },
    manifestLedger,
    projectionItems,
    summary,
    blockers: [
      'active-runtime-manifest-artifacts-awaiting-explicit-disposition',
      'student-visible-runtime-projections-awaiting-formal-atomic-binding',
      'active-teaching-resources-awaiting-formal-structural-alignment',
      'legacy-remediation-envelope-not-bound-to-current-active-runtime',
    ],
  };
  const artifact = { ...review, reviewHash: projectionDigest(review), sourceInputs: [
    sourceFile(RUNTIME_OBSERVATION),
    projectionSource,
    sourceFile(RESOURCE_REVIEW),
    sourceFile(LEGACY_PREPARE_INPUT),
  ] };
  const state = immutableWrite(outputPath, artifact);
  process.stdout.write(`${JSON.stringify({ outputPath, state, reviewHash: artifact.reviewHash, summary }, null, 2)}\n`);
}

main();
