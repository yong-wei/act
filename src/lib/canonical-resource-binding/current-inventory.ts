/**
 * Live #1124 resource inventory construction from DB + registry + runtime.
 * Safe to import from other modules — no CLI side effects.
 */
import type { PrismaClient } from '@prisma/client';

import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { loadRuntimeResourceProjectionInputs } from '@/lib/teacher-resource-node-data';

import {
  assertCanonicalResourceBindingCaptureRevisionUnchanged,
  resolveCanonicalResourceBindingCaptureRevision,
} from './capture-revision';
import type {
  ResourceBindingInventory,
  ResourceInventoryObservation,
} from './contracts';
import {
  buildAtomicResourceId,
  buildResourceBindingInventory,
  canonicalSha256,
} from './inventory';
import { runtimeProjectionObservation } from './runtime-projection';
import { resolveGeneratedPublicationAggregate } from './teaching-resource';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function booleanValue(...records: Record<string, unknown>[]): (key: string) => boolean {
  return (key) => {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const value = records[index]?.[key];
      if (typeof value === 'boolean') return value;
    }
    return false;
  };
}

function stringValue(...records: Record<string, unknown>[]): (key: string) => string | undefined {
  return (key) => {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const value = records[index]?.[key];
      if (typeof value === 'string') return value;
    }
    return undefined;
  };
}

function dispositionSignals(...values: unknown[]) {
  const records = values.map(asRecord);
  const readBoolean = booleanValue(...records);
  const availability = stringValue(...records)('availability');
  const positiveSignals = {
    recommendable: readBoolean('recommendable'),
    pathEligible: readBoolean('pathEligible'),
    evidenceProducing: readBoolean('evidenceProducing'),
    published: readBoolean('published'),
  };
  const exclusionSignals = {
    draft: availability === 'draft' || readBoolean('draft'),
    disabled: availability === 'disabled' || readBoolean('disabled'),
    archived: availability === 'archived' || readBoolean('archived'),
    auditOnly: availability === 'audit-only' || readBoolean('auditOnly'),
    nonTeaching: availability === 'non-teaching' || readBoolean('nonTeaching'),
  };
  return {
    positiveSignals,
    exclusionSignals,
    dispositionDeclared: (
      Object.values(positiveSignals).some(Boolean)
      || Object.values(exclusionSignals).some(Boolean)
    ),
  };
}

function registeredResourceObservations(input: {
  captureRevision: string;
  capturedAt: string;
  dbWatermark: string;
}): ResourceInventoryObservation[] {
  return getAllRegisteredResourceMetadata().map((resource) => {
    const structuralUnitId = `resource-registry:${resource.id}`;
    const segmentId = `${structuralUnitId}:base`;
    const config = asRecord(resource.defaultConfig);
    const planning = asRecord(resource.planningOverride);
    const signals = dispositionSignals(config, planning);
    return {
      sourceObservationId: `registry:${resource.id}`,
      sourceKind: 'resource_registry',
      sourceAvailable: true,
      ...input,
      atomicResourceId: buildAtomicResourceId({
        sourceKind: 'resource_registry',
        resourceId: resource.id,
        structuralUnitId,
      }),
      resourceId: resource.id,
      structuralUnitId,
      segmentId,
      resourceSegmentHash: canonicalSha256({
        id: resource.id,
        type: resource.type,
        renderTarget: resource.renderTarget ?? null,
        launchTarget: resource.launchTarget ?? null,
        defaultConfig: config,
        planningOverride: planning,
      }),
      ...signals,
      teacherOnly: (
        planning.teacherPolicy === 'teacher-only'
        || planning.availability === 'teacher_only'
      ),
    };
  });
}

function hasSubstantiveOverride(value: unknown): boolean {
  return Object.keys(asRecord(value)).length > 0;
}

export async function buildCurrentInventory(
  db: PrismaClient,
  verificationCapture?: { capturedAt: string; dbWatermark: string },
) {
  const revision = await resolveCanonicalResourceBindingCaptureRevision();
  const capturedAt = verificationCapture?.capturedAt ?? new Date().toISOString();
  const snapshot = await db.$transaction(async (transaction) => {
    const watermarkRows = await transaction.$queryRaw<Array<{ watermark: string }>>`
      SELECT pg_current_wal_lsn()::text AS watermark
    `;
    const resources = await transaction.teachingResource.findMany({
      orderBy: { id: 'asc' },
      include: {
        generatedCoursewarePublication: {
          select: {
            id: true,
            revisionNumber: true,
            manifestHash: true,
            contentHash: true,
          },
        },
        lessonItems: {
          orderBy: { id: 'asc' },
          include: {
            generatedCoursewarePublication: {
              select: {
                id: true,
                revisionNumber: true,
                manifestHash: true,
                contentHash: true,
              },
            },
            plan: {
              select: {
                id: true,
                isPublic: true,
                generatedCoursewarePublication: {
                  select: {
                    id: true,
                    revisionNumber: true,
                    manifestHash: true,
                    contentHash: true,
                  },
                },
                sessions: {
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });
    return {
      dbWatermark: verificationCapture?.dbWatermark
        ?? watermarkRows[0]?.watermark
        ?? 'unknown',
      resources,
    };
  }, { isolationLevel: 'RepeatableRead' });

  const observations: ResourceInventoryObservation[] = [];
  for (const resource of snapshot.resources) {
    const plainPlacements = resource.lessonItems.filter(
      (placement) => !hasSubstantiveOverride(placement.overrideConfig),
    );
    const variants = resource.lessonItems.filter(
      (placement) => hasSubstantiveOverride(placement.overrideConfig),
    );
    const placements = [
      ...(plainPlacements.length > 0 || resource.lessonItems.length === 0
        ? [{
            placement: null,
            placementRefs: plainPlacements.map((row) => row.id),
            aggregatePlacements: plainPlacements,
          }]
        : []),
      ...variants.map((placement) => ({
        placement,
        placementRefs: [placement.id],
        aggregatePlacements: [placement],
      })),
    ];
    for (const placementGroup of placements) {
      const { placement, placementRefs, aggregatePlacements } = placementGroup;
      const resourceConfig = asRecord(resource.config);
      const overrideConfig = asRecord(placement?.overrideConfig);
      const planning = asRecord(resourceConfig.resourceNodePlanning);
      const overridePlanning = asRecord(overrideConfig.resourceNodePlanning);
      const signals = dispositionSignals(
        resourceConfig,
        planning,
        overrideConfig,
        overridePlanning,
      );
      const publicPlacement = aggregatePlacements.some((row) => row.plan.isPublic);
      const currentlyDelivered = aggregatePlacements.some((row) => row.plan.sessions
        .some((session) => session.status === 'ACTIVE' || session.status === 'PAUSED'));
      const publicationAggregate = resolveGeneratedPublicationAggregate([
        resource.generatedCoursewarePublication,
        ...aggregatePlacements.flatMap((row) => [
          row.generatedCoursewarePublication,
          row.plan.generatedCoursewarePublication,
        ]),
      ]);
      const publicationRevision = publicationAggregate.publicationRevision;
      const generatedPublication = publicationAggregate.published;
      const structuralUnitId = placement
        ? `lesson-item:${placement.id}`
        : `teaching-resource:${resource.id}`;
      const segmentId = `${structuralUnitId}:base`;
      const positiveSignals = {
        ...signals.positiveSignals,
        published: signals.positiveSignals.published || publicPlacement || generatedPublication,
        currentlyDelivered,
      };
      observations.push({
        sourceObservationId: placement
          ? `TeachingResource:${resource.id}:LessonItem:${placement.id}`
          : `TeachingResource:${resource.id}:base`,
        sourceKind: 'TeachingResource',
        sourceAvailable: true,
        captureRevision: revision,
        capturedAt,
        dbWatermark: snapshot.dbWatermark,
        atomicResourceId: buildAtomicResourceId({
          sourceKind: 'TeachingResource',
          resourceId: resource.id,
          structuralUnitId,
          placementId: placement?.id,
        }),
        resourceId: resource.id,
        structuralUnitId,
        segmentId,
        resourceSegmentHash: canonicalSha256({
          resourceId: resource.id,
          type: resource.type,
          content: resource.content,
          registryId: resource.registryId,
          config: resourceConfig,
          placementId: placement?.id ?? null,
          placementRefs,
          overrideConfig,
          generatedCoursewarePublication: publicationRevision,
        }),
        positiveSignals,
        exclusionSignals: signals.exclusionSignals,
        teacherOnly: resource.teacherOnly,
        dispositionDeclared: (
          signals.dispositionDeclared
          || publicPlacement
          || currentlyDelivered
          || generatedPublication
        ),
        placementRefs,
        publicationRevision,
        conflictReasonCodes: publicationAggregate.conflictReasonCodes,
      });
    }
  }
  observations.push(...registeredResourceObservations({
    captureRevision: revision,
    capturedAt,
    dbWatermark: snapshot.dbWatermark,
  }));
  const runtimeProjections = await loadRuntimeResourceProjectionInputs({ allowMissing: false });
  for (const projection of runtimeProjections) {
    observations.push(runtimeProjectionObservation({
      projection,
      captureRevision: revision,
      capturedAt,
      dbWatermark: snapshot.dbWatermark,
    }));
  }
  const inventory = buildResourceBindingInventory(observations);
  await assertCanonicalResourceBindingCaptureRevisionUnchanged(revision);
  return inventory;
}

/** Content-only projection (excludes live dbWatermark / capturedAt). */
export function inventoryContentProjection(inventory: ResourceBindingInventory) {
  return {
    runId: inventory.runId,
    sourceHash: inventory.sourceHash,
    captureRevision: inventory.captureRevision,
    summary: {
      itemCount: inventory.summary.itemCount,
      includedCount: inventory.summary.includedCount,
      excludedCount: inventory.summary.excludedCount,
      unresolvedCount: inventory.summary.unresolvedCount,
    },
    items: inventory.items.map((item) => ({
      atomicResourceId: item.atomicResourceId,
      resourceId: item.resourceId,
      structuralUnitId: item.structuralUnitId,
      segmentId: item.segmentId,
      resourceSegmentHash: item.resourceSegmentHash,
      disposition: item.disposition,
      reasonCodes: item.reasonCodes,
      sourceObservations: item.sourceObservations,
      observationDigest: item.observationDigest,
    })).sort((left, right) => left.atomicResourceId.localeCompare(right.atomicResourceId)),
  };
}

export interface PersistedInventorySnapshotRow {
  id: string;
  captureRevision: string;
  capturedAt: Date | string;
  dbWatermark: string;
  sourceHash: string;
  itemCount: number;
  includedCount: number;
  excludedCount: number;
  unresolvedCount: number;
  complete: boolean;
  items: Array<{
    atomicResourceId: string;
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    disposition: string;
    reasonCodes: unknown;
    sourceObservations: unknown;
    observationDigest: string;
  }>;
}

export function inventoryContentProjectionFromPersisted(
  row: PersistedInventorySnapshotRow,
) {
  return {
    runId: row.id,
    sourceHash: row.sourceHash,
    captureRevision: row.captureRevision,
    summary: {
      itemCount: row.itemCount,
      includedCount: row.includedCount,
      excludedCount: row.excludedCount,
      unresolvedCount: row.unresolvedCount,
    },
    items: row.items.map((item) => ({
      atomicResourceId: item.atomicResourceId,
      resourceId: item.resourceId,
      structuralUnitId: item.structuralUnitId,
      segmentId: item.segmentId,
      resourceSegmentHash: item.resourceSegmentHash,
      disposition: item.disposition,
      reasonCodes: item.reasonCodes,
      sourceObservations: item.sourceObservations,
      observationDigest: item.observationDigest,
    })).sort((left, right) => left.atomicResourceId.localeCompare(right.atomicResourceId)),
  };
}

export function assertPersistedInventorySnapshotComplete(
  row: PersistedInventorySnapshotRow,
): void {
  if (!row.complete) {
    throw new Error(
      `resource binding inventory rejected: persisted snapshot ${row.id} is not complete`,
    );
  }
  const dispositionTotal = row.includedCount + row.excludedCount + row.unresolvedCount;
  if (row.items.length !== row.itemCount || row.itemCount !== dispositionTotal) {
    throw new Error(
      `resource binding inventory rejected: persisted snapshot ${row.id} is incomplete `
      + `(items=${row.items.length}, itemCount=${row.itemCount}, dispositionTotal=${dispositionTotal})`,
    );
  }
}

/**
 * Fail closed when recomputed current resource content drifts from a persisted
 * #1124 snapshot. Capture watermark is not part of content identity.
 */
export function assertInventoryMatchesPersistedSnapshot(
  inventory: ResourceBindingInventory,
  persisted: PersistedInventorySnapshotRow,
): void {
  assertPersistedInventorySnapshotComplete(persisted);
  if (inventory.captureRevision !== persisted.captureRevision) {
    throw new Error(
      `resource binding inventory rejected: captureRevision drift `
      + `(recomputed=${inventory.captureRevision}, persisted=${persisted.captureRevision})`,
    );
  }
  if (inventory.runId !== persisted.id || inventory.sourceHash !== persisted.sourceHash) {
    throw new Error(
      `resource binding inventory rejected: current resource content drifts from persisted snapshot `
      + `(runId ${inventory.runId} / sourceHash ${inventory.sourceHash} vs `
      + `persisted ${persisted.id} / ${persisted.sourceHash})`,
    );
  }
  const recomputedDigest = canonicalSha256(inventoryContentProjection(inventory));
  const persistedDigest = canonicalSha256(inventoryContentProjectionFromPersisted(persisted));
  if (recomputedDigest !== persistedDigest) {
    throw new Error(
      `resource binding inventory rejected: item/summary projection drifts from persisted snapshot `
      + `(${recomputedDigest} != ${persistedDigest})`,
    );
  }
}

function capturedAtIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`resource binding inventory rejected: invalid persisted capturedAt ${value}`);
  }
  return parsed.toISOString();
}

/**
 * Pure selection/fencing for an operator-imported #1124 snapshot.
 * Used by loadVerifiedPersistedCurrentInventory and unit tests.
 */
export function resolveVerifiedPersistedInventory(input: {
  captureRevision: string;
  contentProbe: ResourceBindingInventory;
  completeRunsForCapture: ReadonlyArray<{ id: string; sourceHash: string }>;
  persisted: PersistedInventorySnapshotRow | null;
  verifiedWithPinnedCapture: ResourceBindingInventory;
}): ResourceBindingInventory {
  const {
    captureRevision,
    contentProbe,
    completeRunsForCapture,
    persisted,
    verifiedWithPinnedCapture,
  } = input;

  if (contentProbe.captureRevision !== captureRevision) {
    throw new Error(
      `resource binding inventory rejected: content probe captureRevision ${contentProbe.captureRevision} `
      + `drifts from resolved capture ${captureRevision}`,
    );
  }
  if (completeRunsForCapture.length === 0) {
    throw new Error(
      `resource binding inventory rejected: no complete #1124 inventory snapshot for capture `
      + `${captureRevision}; run import-canonical-resource-binding-shadow first`,
    );
  }

  const matchingComplete = completeRunsForCapture.filter((row) => row.id === contentProbe.runId);
  if (matchingComplete.length === 0) {
    throw new Error(
      `resource binding inventory rejected: complete snapshot missing for current content `
      + `runId=${contentProbe.runId} (capture=${captureRevision}); `
      + `run import-canonical-resource-binding-shadow first`,
    );
  }
  if (matchingComplete.length > 1) {
    throw new Error(
      `resource binding inventory rejected: ambiguous complete snapshots for runId=${contentProbe.runId}`,
    );
  }
  if (!persisted) {
    throw new Error(
      `resource binding inventory rejected: complete snapshot row missing for runId=${contentProbe.runId}`,
    );
  }

  assertInventoryMatchesPersistedSnapshot(verifiedWithPinnedCapture, persisted);

  const expectedCapturedAt = capturedAtIso(persisted.capturedAt);
  if (
    verifiedWithPinnedCapture.dbWatermark !== persisted.dbWatermark
    || verifiedWithPinnedCapture.capturedAt !== expectedCapturedAt
  ) {
    throw new Error(
      `resource binding inventory rejected: recomputed capture identity did not pin to persisted snapshot `
      + `(dbWatermark=${verifiedWithPinnedCapture.dbWatermark}, `
      + `capturedAt=${verifiedWithPinnedCapture.capturedAt})`,
    );
  }

  return verifiedWithPinnedCapture;
}

/**
 * Load the operator-imported #1124 inventory snapshot for current resource content
 * and recompute with that row's immutable capturedAt/dbWatermark so governance
 * dry-run/apply/replay share one capture identity.
 *
 * Does not auto-persist. Missing, incomplete, ambiguous, or drifted snapshots fail closed.
 */
export async function loadVerifiedPersistedCurrentInventory(
  db: PrismaClient,
): Promise<ResourceBindingInventory> {
  const captureRevision = await resolveCanonicalResourceBindingCaptureRevision();

  // Content probe resolves the current resource-content runId. Live LSN is discarded.
  const contentProbe = await buildCurrentInventory(db);

  const completeForCapture = await db.resourceBindingInventoryRun.findMany({
    where: { captureRevision, complete: true },
    select: { id: true, sourceHash: true },
    orderBy: { createdAt: 'desc' },
  }) as Array<{ id: string; sourceHash: string }>;

  const persisted = await db.resourceBindingInventoryRun.findUnique({
    where: { id: contentProbe.runId },
    include: { items: { orderBy: { atomicResourceId: 'asc' } } },
  }) as PersistedInventorySnapshotRow | null;

  // Recompute only when a candidate persisted row exists; otherwise pure resolver
  // reports missing without a second full rebuild.
  let verifiedWithPinnedCapture = contentProbe;
  if (persisted) {
    assertPersistedInventorySnapshotComplete(persisted);
    verifiedWithPinnedCapture = await buildCurrentInventory(db, {
      capturedAt: capturedAtIso(persisted.capturedAt),
      dbWatermark: persisted.dbWatermark,
    });
  }

  return resolveVerifiedPersistedInventory({
    captureRevision,
    contentProbe,
    completeRunsForCapture: completeForCapture,
    persisted,
    verifiedWithPinnedCapture,
  });
}
