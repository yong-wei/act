/**
 * Per-course package migration + readiness gate (#1268).
 *
 * Unresolved REVIEW_REQUIRED items block only the corresponding package.
 * Engineering Authority and unrelated packages remain independently usable.
 */

import {
  buildTeachingProjection,
  type TeachingProjectionBuildError,
} from './builder';
import type {
  AuthorityNodeIndexEntry,
  TeachingBindingAuthoring,
  TeachingProjectionAuthoringInput,
  TeachingProjectionArtifacts,
  TeachingResourceAuthoring,
} from './contracts';
import { projectionDigest } from './hash';
import { assertNoLegacyGraphIdsInAuthoring } from './legacy-id-policy';
import {
  mapActiveCourseResources,
  migrationStatusDigest,
  summarizeMigrationStatuses,
} from './mapping';
import {
  ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT,
  ACTIVE_COURSE_PACKAGE_REPORT_CONTRACT,
  type ActiveCourseInventory,
  type ActiveCourseMigrationReport,
  type ActiveCourseMigrationRunResult,
  type ActiveCoursePackageReport,
  type MappingContext,
  type MigrationStatusRecord,
  type PackageReadinessFinding,
} from './migration-contracts';

export interface PackageMigrationOptions {
  inventory: ActiveCourseInventory;
  mappingContext: MappingContext;
  /** Pinned Authority release identity for projection builds. */
  authorityReleaseId: string;
  authorityReleaseSetId?: string | null;
  authoritySnapshotId?: string | null;
  authoritySnapshotHash?: string | null;
  authorityNodes: readonly AuthorityNodeIndexEntry[];
  /** When false, REQUIRED REVIEW_REQUIRED still blocks (default true). */
  blockOnReviewRequired?: boolean;
}

export interface PackageMigrationBuild {
  packageId: string;
  scopeId: string;
  records: MigrationStatusRecord[];
  authoring: TeachingProjectionAuthoringInput;
  artifacts: TeachingProjectionArtifacts | null;
  report: ActiveCoursePackageReport;
  buildError: string | null;
}

function resourceAuthoringFromRecord(
  record: MigrationStatusRecord,
  lessonKey: string,
  stepId?: string,
): TeachingResourceAuthoring {
  const projectionMode =
    record.status === 'EXPLICIT_NONE' && record.projectionMode === 'REQUIRED'
      // REQUIRED cannot be EXPLICIT_NONE; keep REQUIRED so gate fails if wrongly classified.
      ? 'REQUIRED'
      : record.status === 'EXPLICIT_NONE' && record.mappingMethod === 'NONE'
        ? 'NONE'
        : record.status === 'EXPLICIT_NONE'
          ? 'OPTIONAL'
          : record.projectionMode;

  const base: TeachingResourceAuthoring = {
    resourceId: record.resourceId,
    resourceType: record.resourceType,
    lessonKey,
    projectionMode,
    scopeId: record.scopeId,
    sourcePath: record.sourcePath,
    legacyCrosswalkRef:
      record.candidates.find((c) => c.legacyId)?.legacyId ?? null,
  };
  if (stepId) {
    base.stepId = stepId;
  }

  // Attach knowledgeRefs for BOUND records (authoring decision source).
  if (record.status === 'BOUND' && record.bindings.length > 0) {
    base.knowledgeRefs = record.bindings.map((ref) => ({
      canonicalId: ref.canonicalId,
      role: ref.role,
      ...(ref.primary === true ? { primary: true } : {}),
      ...(ref.rationale ? { rationale: ref.rationale } : {}),
      ...(ref.sourcePath ? { sourcePath: ref.sourcePath } : {}),
    }));
  }
  return base;
}

/**
 * Convert migration records for one package into Teaching Projection authoring.
 * REJECTS legacy graph IDs in binding endpoints.
 */
export function buildPackageAuthoringFromMigration(input: {
  packageId: string;
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  authorityReleaseSetId?: string | null;
  authoritySnapshotId?: string | null;
  authoritySnapshotHash?: string | null;
  authorityNodes: readonly AuthorityNodeIndexEntry[];
  records: readonly MigrationStatusRecord[];
  lessonKeyByResourceId: ReadonlyMap<string, { lessonKey: string; stepId?: string }>;
}): TeachingProjectionAuthoringInput {
  const resources: TeachingResourceAuthoring[] = [];
  const bindings: TeachingBindingAuthoring[] = [];

  for (const record of input.records) {
    const keys = input.lessonKeyByResourceId.get(record.resourceId) ?? {
      lessonKey: record.resourceId.replace(/^act:(?:lesson|handout|step):/u, '').split(':')[0] ?? 'unknown',
    };
    resources.push(resourceAuthoringFromRecord(record, keys.lessonKey, keys.stepId));

    if (record.status === 'BOUND') {
      for (const ref of record.bindings) {
        const binding: TeachingBindingAuthoring = {
          resourceId: record.resourceId,
          canonicalId: ref.canonicalId,
          role: ref.role,
          scopeId: record.scopeId,
          sourcePath: ref.sourcePath ?? record.sourcePath,
          rationale: ref.rationale ?? record.rationale,
        };
        if (ref.primary === true) {
          binding.primary = true;
        }
        bindings.push(binding);
      }
    }
  }

  const authoring: TeachingProjectionAuthoringInput = {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: input.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.authorityReleaseId,
    authorityReleaseSetId: input.authorityReleaseSetId ?? null,
    authoritySnapshotId: input.authoritySnapshotId ?? null,
    authoritySnapshotHash: input.authoritySnapshotHash ?? null,
    resources,
    bindings,
    prerequisites: [],
    coreNodes: [],
    cards: [],
    authorityNodes: input.authorityNodes,
  };

  assertNoLegacyGraphIdsInAuthoring(authoring);
  return authoring;
}

function packageFindings(
  records: readonly MigrationStatusRecord[],
  projectionGatePassed: boolean,
  buildError: string | null,
): PackageReadinessFinding[] {
  const findings: PackageReadinessFinding[] = [];

  for (const record of records) {
    if (record.status === 'REVIEW_REQUIRED') {
      findings.push({
        code: 'review-required',
        severity: record.projectionMode === 'REQUIRED' ? 'error' : 'warning',
        message: `${record.resourceId}: ${record.rationale}`,
        resourceId: record.resourceId,
      });
    }
    if (
      record.projectionMode === 'REQUIRED'
      && record.status === 'EXPLICIT_NONE'
    ) {
      findings.push({
        code: 'required-explicit-none-forbidden',
        severity: 'error',
        message: `REQUIRED resource ${record.resourceId} cannot be EXPLICIT_NONE`,
        resourceId: record.resourceId,
      });
    }
  }

  if (buildError) {
    findings.push({
      code: 'projection-build-error',
      severity: 'error',
      message: buildError,
    });
  } else if (!projectionGatePassed) {
    findings.push({
      code: 'projection-gate-failed',
      severity: 'error',
      message: 'Teaching Projection gate failed for this package',
    });
  }

  return findings;
}

/**
 * Evaluate readiness for one course package from its migration records + projection gate.
 */
export function evaluatePackageReadiness(input: {
  packageId: string;
  scopeId: string;
  records: readonly MigrationStatusRecord[];
  projectionGatePassed: boolean;
  gateStatus: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED';
  buildError?: string | null;
  blockOnReviewRequired?: boolean;
}): ActiveCoursePackageReport {
  const blockOnReviewRequired = input.blockOnReviewRequired !== false;
  const summary = summarizeMigrationStatuses(input.records);
  const unresolvedResourceIds = input.records
    .filter((r) => {
      if (r.status !== 'REVIEW_REQUIRED') return false;
      if (r.projectionMode === 'REQUIRED') return true;
      return blockOnReviewRequired && r.projectionMode !== 'NONE';
    })
    .map((r) => r.resourceId)
    .sort();

  const findings = packageFindings(
    input.records,
    input.projectionGatePassed,
    input.buildError ?? null,
  );

  const hasErrors = findings.some((f) => f.severity === 'error');
  const ready =
    !hasErrors
    && unresolvedResourceIds.length === 0
    && input.projectionGatePassed
    && !input.buildError;

  const report: Omit<ActiveCoursePackageReport, 'reportDigest'> = {
    contract: ACTIVE_COURSE_PACKAGE_REPORT_CONTRACT,
    packageId: input.packageId,
    scopeId: input.scopeId,
    ready,
    gateStatus: ready ? 'PUBLISHED' : input.gateStatus,
    unresolvedResourceIds,
    findings,
    migrationSummary: {
      ...summary,
      resourceCount: input.records.length,
    },
    projectionGatePassed: input.projectionGatePassed,
  };

  return {
    ...report,
    reportDigest: projectionDigest(report),
  };
}

/**
 * Run inventory mapping for all packages and evaluate per-package gates.
 * Failures are isolated — one package cannot block another.
 */
export function runActiveCourseMigration(
  options: PackageMigrationOptions,
): ActiveCourseMigrationRunResult {
  const allRecords: MigrationStatusRecord[] = [];
  const packageReports: ActiveCoursePackageReport[] = [];
  const blockOnReviewRequired = options.blockOnReviewRequired !== false;

  for (const pkg of options.inventory.packages) {
    const records = mapActiveCourseResources(pkg.resources, options.mappingContext);
    allRecords.push(...records);

    const lessonKeyByResourceId = new Map(
      pkg.resources.map((r) => [
        r.resourceId,
        { lessonKey: r.lessonKey, stepId: r.stepId },
      ] as const),
    );

    let artifacts: TeachingProjectionArtifacts | null = null;
    let buildError: string | null = null;
    let projectionGatePassed = false;
    let gateStatus: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED' = 'REVIEW_REQUIRED';

    try {
      const authoring = buildPackageAuthoringFromMigration({
        packageId: pkg.packageId,
        scopeId: pkg.scopeId,
        authoringRevision: options.inventory.authoringRevision,
        authorityReleaseId: options.authorityReleaseId,
        authorityReleaseSetId: options.authorityReleaseSetId,
        authoritySnapshotId: options.authoritySnapshotId,
        authoritySnapshotHash: options.authoritySnapshotHash,
        authorityNodes: options.authorityNodes,
        records,
        lessonKeyByResourceId,
      });
      artifacts = buildTeachingProjection(authoring);
      projectionGatePassed = artifacts.gate.passed;
      gateStatus = artifacts.gate.status;
    } catch (error) {
      buildError =
        error instanceof Error
          ? `${(error as TeachingProjectionBuildError).code ?? 'error'}: ${error.message}`
          : String(error);
      projectionGatePassed = false;
      gateStatus = 'REVIEW_REQUIRED';
    }

    // REQUIRED review-required must fail even if builder somehow passed.
    const requiredUnresolved = records.some(
      (r) => r.status === 'REVIEW_REQUIRED' && r.projectionMode === 'REQUIRED',
    );
    if (requiredUnresolved) {
      projectionGatePassed = false;
      gateStatus = 'REVIEW_REQUIRED';
    }

    packageReports.push(
      evaluatePackageReadiness({
        packageId: pkg.packageId,
        scopeId: pkg.scopeId,
        records,
        projectionGatePassed,
        gateStatus,
        buildError,
        blockOnReviewRequired,
      }),
    );

    // Silence unused var lint when artifacts only used for gate.
    void artifacts;
  }

  allRecords.sort((a, b) =>
    a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0,
  );
  packageReports.sort((a, b) =>
    a.packageId < b.packageId ? -1 : a.packageId > b.packageId ? 1 : 0,
  );

  const summary = summarizeMigrationStatuses(allRecords);
  const migrationBody = {
    contract: ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT,
    authoringRevision: options.inventory.authoringRevision,
    inventoryDigest: options.inventory.inventoryDigest,
    records: allRecords,
    summary: {
      ...summary,
      packageCount: options.inventory.packageCount,
    },
  };

  const migration: ActiveCourseMigrationReport = {
    ...migrationBody,
    reportDigest: migrationStatusDigest(allRecords),
  };

  return {
    inventory: options.inventory,
    migration,
    packageReports,
    allPackagesReady: packageReports.every((p) => p.ready),
  };
}

/**
 * True when a package with unresolved REQUIRED items is blocked while others pass.
 */
export function assertPackageIsolation(
  reports: readonly ActiveCoursePackageReport[],
  blockedPackageId: string,
): { blocked: ActiveCoursePackageReport; othersReady: boolean } {
  const blocked = reports.find((r) => r.packageId === blockedPackageId);
  if (!blocked) {
    throw new Error(`package not found in reports: ${blockedPackageId}`);
  }
  if (blocked.ready) {
    throw new Error(`expected package ${blockedPackageId} to be blocked`);
  }
  const othersReady = reports
    .filter((r) => r.packageId !== blockedPackageId)
    .every((r) => r.ready);
  return { blocked, othersReady };
}
