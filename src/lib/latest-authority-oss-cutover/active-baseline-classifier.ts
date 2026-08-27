/**
 * Deterministic historical-debt closure for the production active baseline.
 *
 * This is deliberately a classifier, not a reviewer queue.  It creates one
 * explicit disposition for every active Runtime file and every Runtime
 * projection, while retaining student-visible projections and DB teaching
 * resources as logical resources.  Formal atomization and binding remain a
 * later gate; a missing source or Canonical mapping is preserved as a
 * machine-readable exception rather than silently dropping the resource.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import type {
  ActiveBaseline,
  ActiveBaselineEntry,
  ActiveRuntimeReleaseIdentity,
} from './contracts';
import { captureActiveLogicalInventory, type ProductionTeachingResource, type RuntimeManifestFile } from './inventory-capture';

export const ACTIVE_BASELINE_CLASSIFICATION_CONTRACT =
  'active-runtime-baseline-classification/v1' as const;

export interface RuntimeProjectionBaselineSource {
  readonly id: string;
  readonly family: string;
  /** Present only when Runtime governance registers an independent resource node. */
  readonly resourceNodeId: string | null;
  readonly sourceHash: string | null;
  readonly sourcePathOrUrl: string | null;
  readonly renderTarget: string | null;
  readonly routeTarget: string | null;
  readonly citationTargets: readonly string[];
  readonly lifecycleScope?: 'audit-only';
}

/** Revision-bound active-course inventory record from the identity registry. */
export interface ActiveCourseInventoryBaselineResource {
  readonly resourceId: string;
  readonly resourceType: 'lesson' | 'handout' | 'step';
  readonly lessonKey: string;
  readonly stepId?: string;
  readonly sourcePath: string;
  readonly sourceDigest: string;
}

export interface ManifestDisposition {
  readonly entryId: string;
  readonly runtimePath: string;
  readonly contentSha256: string;
  readonly disposition: 'CARRIES_LOGICAL_RESOURCE' | 'NON_RESOURCE_RUNTIME_FILE';
  readonly carrierResourceIds: readonly string[];
  readonly auditOnlyProjectionIds: readonly string[];
  readonly supportingProjectionIds: readonly string[];
}

export interface ProjectionDisposition {
  readonly entryId: string;
  readonly projectionId: string;
  readonly classification: 'resource' | 'non-resource';
  readonly resourceId: string | null;
  readonly subtype: string;
  readonly runtimePaths: readonly string[];
  readonly sourceIdentity: string;
  readonly sourceContentSha256: string | null;
  readonly dispositionReason: string;
}

export interface ActiveBaselineClassification {
  readonly contract: typeof ACTIVE_BASELINE_CLASSIFICATION_CONTRACT;
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly entries: readonly ActiveBaselineEntry[];
  readonly manifestDispositions: readonly ManifestDisposition[];
  readonly projectionDispositions: readonly ProjectionDisposition[];
  readonly baseline: ActiveBaseline;
  readonly summary: {
    readonly manifestFileCount: number;
    readonly manifestCarrierFileCount: number;
    readonly manifestNonResourceFileCount: number;
    readonly runtimeResourceCount: number;
    readonly auditOnlyProjectionCount: number;
    readonly activeCourseResourceCount: number;
    readonly dbResourceCount: number;
    readonly resourceCount: number;
    readonly nonResourceCount: number;
  };
  readonly classificationHash: string;
}

export interface BuildActiveBaselineClassificationInput {
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly manifestFiles: readonly RuntimeManifestFile[];
  readonly teachingResources: readonly ProductionTeachingResource[];
  readonly lessonItemResourceIds: readonly string[];
  /** Already classified DB resources; their source identity remains in this input. */
  readonly databaseEntries: readonly ActiveBaselineEntry[];
  readonly projections: readonly RuntimeProjectionBaselineSource[];
  readonly activeCourseResources?: readonly ActiveCourseInventoryBaselineResource[];
}

function fail(message: string): never {
  throw new Error(`active baseline classification rejected: ${message}`);
}

function normalizeRuntimePath(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('course-content/runtime/')) {
    return value.slice('course-content/runtime/'.length);
  }
  if (value.startsWith('/course-runtime/')) {
    return value.slice('/course-runtime/'.length);
  }
  return null;
}

function normalizedDigest(value: string | null): string | null {
  if (!value) return null;
  const digest = value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    fail(`projection source hash is not a SHA-256 digest: ${value}`);
  }
  return digest;
}

function projectionRuntimePaths(
  projection: RuntimeProjectionBaselineSource,
  manifestPaths: ReadonlySet<string>,
): string[] {
  const paths = new Set<string>();
  for (const locator of [
    projection.sourcePathOrUrl,
    projection.renderTarget,
    projection.routeTarget,
    ...projection.citationTargets,
  ]) {
    const runtimePath = normalizeRuntimePath(locator);
    if (runtimePath && manifestPaths.has(runtimePath)) paths.add(runtimePath);
  }
  return [...paths].sort();
}

function activeInventoryRuntimePath(resource: ActiveCourseInventoryBaselineResource): string | null {
  const sourcePath = resource.sourcePath.split('#', 1)[0] ?? '';
  return normalizeRuntimePath(sourcePath);
}

function projectionAliasForActiveResource(
  resource: ActiveCourseInventoryBaselineResource,
): string | null {
  if (resource.resourceType === 'step' && resource.stepId) {
    return `runtime-step:${resource.lessonKey}:${resource.stepId}`;
  }
  if (resource.resourceType === 'handout') {
    return `runtime-handout:${resource.lessonKey}`;
  }
  return null;
}

function sourceIdentity(input: {
  activeRelease: ActiveRuntimeReleaseIdentity;
  projection: RuntimeProjectionBaselineSource;
  runtimePaths: readonly string[];
  sourceContentSha256: string | null;
}): string {
  if (input.runtimePaths.length === 1 && input.sourceContentSha256 !== null) {
    return `runtime-release:${input.activeRelease.releaseId}:${input.runtimePaths[0]}:sha256:${input.sourceContentSha256}`;
  }
  return `runtime-projection:${input.activeRelease.releaseId}:${input.projection.id}:sha256:${projectionDigest({
    family: input.projection.family,
    runtimePaths: input.runtimePaths,
    sourceContentSha256: input.sourceContentSha256,
  })}`;
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`duplicate ${label}`);
}

/**
 * Close the active historical inventory automatically.  A Runtime file can
 * carry zero, one, or many logical resources; the file itself is still an
 * explicit non-resource carrier when it is not independently selectable.
 */
export function buildActiveBaselineClassification(
  input: BuildActiveBaselineClassificationInput,
): ActiveBaselineClassification {
  assertUnique(input.manifestFiles.map((file) => file.path), 'Runtime manifest path');
  assertUnique(input.projections.map((projection) => projection.id), 'Runtime projection id');
  assertUnique(input.databaseEntries.map((entry) => entry.entryId), 'database baseline entry');
  const activeCourseResources = input.activeCourseResources ?? [];
  assertUnique(activeCourseResources.map((resource) => resource.resourceId), 'active course resource id');

  const manifestByPath = new Map(input.manifestFiles.map((file) => [file.path, file]));
  const manifestPaths = new Set(manifestByPath.keys());
  const projectionDispositions: ProjectionDisposition[] = [];
  const entries: ActiveBaselineEntry[] = [...input.databaseEntries];
  const carrierResourceIds = new Map<string, string[]>();
  const auditOnlyProjectionIds = new Map<string, string[]>();
  const supportingProjectionIds = new Map<string, string[]>();
  const activeResourceByProjectionId = new Map<string, ActiveCourseInventoryBaselineResource>();
  for (const resource of activeCourseResources) {
    if (!/^[a-f0-9]{64}$/u.test(resource.sourceDigest)) {
      fail(`active course resource ${resource.resourceId} has an invalid source digest`);
    }
    const runtimePath = activeInventoryRuntimePath(resource);
    if (runtimePath && !manifestPaths.has(runtimePath)) {
      fail(`active course resource ${resource.resourceId} references missing Runtime path ${runtimePath}`);
    }
    const projectionId = projectionAliasForActiveResource(resource);
    if (!projectionId) continue;
    if (activeResourceByProjectionId.has(projectionId)) {
      fail(`active course inventory maps more than one resource to ${projectionId}`);
    }
    activeResourceByProjectionId.set(projectionId, resource);
  }

  for (const projection of [...input.projections].sort((left, right) => left.id.localeCompare(right.id))) {
    const runtimePaths = projectionRuntimePaths(projection, manifestPaths);
    const activeResource = activeResourceByProjectionId.get(projection.id);
    const sourceContentSha256 = activeResource?.sourceDigest ?? normalizedDigest(projection.sourceHash);
    const auditOnly = projection.lifecycleScope === 'audit-only';
    const independentResource = !auditOnly
      && (projection.resourceNodeId !== null || activeResource !== undefined);
    const resourceId = independentResource ? (activeResource?.resourceId ?? projection.id) : null;
    const entryId = `runtime-projection:${projection.id}`;
    const reason = auditOnly
      ? 'audit-only-projection'
      : independentResource
        ? 'registered-runtime-resource-node'
        : 'student-visible-supporting-segment-without-resource-node';
    const identity = sourceIdentity({
      activeRelease: input.activeRelease,
      projection,
      runtimePaths,
      sourceContentSha256,
    });
    projectionDispositions.push({
      entryId,
      projectionId: projection.id,
      classification: independentResource ? 'resource' : 'non-resource',
      resourceId,
      subtype: projection.family,
      runtimePaths,
      sourceIdentity: identity,
      sourceContentSha256,
      dispositionReason: reason,
    });
    entries.push({
      entryId,
      resourceId,
      classification: independentResource ? 'resource' : 'non-resource',
      subtype: projection.family,
      sourceKind: 'runtime-manifest',
      runtimePath: runtimePaths[0] ?? null,
      courseScope: independentResource ? 'in-course' : 'non-resource',
      sourceIdentity: identity,
      sourceContentSha256,
      dispositionReason: reason,
    });
    for (const runtimePath of runtimePaths) {
      const target = auditOnly
        ? auditOnlyProjectionIds
        : independentResource
          ? carrierResourceIds
          : supportingProjectionIds;
      const values = target.get(runtimePath) ?? [];
      values.push(projection.id);
      target.set(runtimePath, values);
    }
  }

  for (const resource of activeCourseResources) {
    if (projectionAliasForActiveResource(resource)) continue;
    const runtimePath = activeInventoryRuntimePath(resource);
    const entryId = `active-course-inventory:${resource.resourceId}`;
    entries.push({
      entryId,
      resourceId: resource.resourceId,
      classification: 'resource',
      subtype: `active-course-${resource.resourceType}`,
      sourceKind: 'runtime-manifest',
      runtimePath,
      courseScope: 'in-course',
      sourceIdentity: `active-course-inventory:${resource.resourceId}:sha256:${resource.sourceDigest}`,
      sourceContentSha256: resource.sourceDigest,
      dispositionReason: 'active-course-identity-registry-resource',
    });
    if (runtimePath) {
      const carriers = carrierResourceIds.get(runtimePath) ?? [];
      carriers.push(resource.resourceId);
      carrierResourceIds.set(runtimePath, carriers);
    }
  }

  const manifestDispositions: ManifestDisposition[] = [];
  for (const file of [...input.manifestFiles].sort((left, right) => left.path.localeCompare(right.path))) {
    const carriers = [...new Set(carrierResourceIds.get(file.path) ?? [])].sort();
    const auditOnly = [...new Set(auditOnlyProjectionIds.get(file.path) ?? [])].sort();
    const supporting = [...new Set(supportingProjectionIds.get(file.path) ?? [])].sort();
    const entryId = `runtime-file:${file.path}`;
    const disposition = carriers.length > 0 ? 'CARRIES_LOGICAL_RESOURCE' : 'NON_RESOURCE_RUNTIME_FILE';
    manifestDispositions.push({
      entryId,
      runtimePath: file.path,
      contentSha256: file.sha256,
      disposition,
      carrierResourceIds: carriers,
      auditOnlyProjectionIds: auditOnly,
      supportingProjectionIds: supporting,
    });
    entries.push({
      entryId,
      resourceId: null,
      classification: 'non-resource',
      subtype: disposition === 'CARRIES_LOGICAL_RESOURCE' ? 'runtime-resource-carrier' : 'runtime-file',
      sourceKind: 'runtime-manifest',
      runtimePath: file.path,
      courseScope: 'non-resource',
      sourceIdentity: `runtime-release:${input.activeRelease.releaseId}:${file.path}:sha256:${file.sha256}`,
      sourceContentSha256: file.sha256,
      dispositionReason: disposition === 'CARRIES_LOGICAL_RESOURCE'
        ? 'runtime-file-carries-logical-resource'
        : 'runtime-file-is-not-an-independent-logical-resource',
    });
  }

  assertUnique(entries.map((entry) => entry.entryId), 'active baseline entry');
  const baseline = captureActiveLogicalInventory({
    activeRelease: input.activeRelease,
    manifestFiles: input.manifestFiles,
    teachingResources: input.teachingResources,
    lessonItemResourceIds: input.lessonItemResourceIds,
    classified: entries,
  });
  const summary = {
    manifestFileCount: manifestDispositions.length,
    manifestCarrierFileCount: manifestDispositions.filter((row) => row.disposition === 'CARRIES_LOGICAL_RESOURCE').length,
    manifestNonResourceFileCount: manifestDispositions.filter((row) => row.disposition === 'NON_RESOURCE_RUNTIME_FILE').length,
    runtimeResourceCount: projectionDispositions.filter((row) => row.classification === 'resource').length,
    auditOnlyProjectionCount: input.projections.filter((row) => row.lifecycleScope === 'audit-only').length,
    activeCourseResourceCount: activeCourseResources.length,
    dbResourceCount: input.databaseEntries.filter((entry) => entry.classification === 'resource').length,
    resourceCount: baseline.logicalResourceCount,
    nonResourceCount: baseline.nonResourceCount,
  };
  const classificationHash = projectionDigest({
    contract: ACTIVE_BASELINE_CLASSIFICATION_CONTRACT,
    activeRelease: input.activeRelease,
    baselineHash: baseline.baselineHash,
    manifestDispositions,
    projectionDispositions,
    summary,
  });
  return {
    contract: ACTIVE_BASELINE_CLASSIFICATION_CONTRACT,
    activeRelease: input.activeRelease,
    entries: baseline.entries,
    manifestDispositions,
    projectionDispositions,
    baseline,
    summary,
    classificationHash,
  };
}
