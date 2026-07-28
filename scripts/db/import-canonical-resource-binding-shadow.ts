import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  assertCanonicalResourceBindingCaptureRevisionUnchanged,
  buildAtomicResourceId,
  buildResourceBindingInventory,
  canonicalSha256,
  CanonicalResourceBindingRepository,
  evaluateCanonicalResourceCutoverReadiness,
  runtimeProjectionObservation,
  resolveCanonicalResourceBindingCaptureRevision,
  resolveGeneratedPublicationAggregate,
  selectResourceKnowledgeAuthority,
  type CanonicalResourceBindingDatabase,
  type ResourceInventoryObservation,
} from '../../src/lib/canonical-resource-binding';
import { getAllRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import { loadRuntimeResourceProjectionInputs } from '../../src/lib/teacher-resource-node-data';

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
  db: ReturnType<typeof createPrismaClient>,
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

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const verifyOnly = process.argv.includes('--verify-only');
  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const repository = new CanonicalResourceBindingRepository(
      db as unknown as CanonicalResourceBindingDatabase,
    );
    if (verifyOnly) {
      const recomputed = await buildCurrentInventory(db);
      const [persisted, crosswalkCount, bindingCount] = await Promise.all([
        db.resourceBindingInventoryRun.findUnique({
          where: { id: recomputed.runId },
          include: { items: { orderBy: { atomicResourceId: 'asc' } } },
        }),
        db.actkgEvidenceStructuralUnitCrosswalk.count(),
        db.canonicalResourceBindingDecision.count(),
      ]);
      if (!persisted) {
        throw new Error(`current resource binding inventory ${recomputed.runId} is missing`);
      }
      if (
        !persisted.complete
        || persisted.items.length !== persisted.itemCount
        || persisted.itemCount !== (
          persisted.includedCount + persisted.excludedCount + persisted.unresolvedCount
        )
      ) {
        throw new Error('persisted resource binding inventory is missing or incomplete');
      }
      if (crosswalkCount !== 0 || bindingCount !== 0) {
        throw new Error('unexpected formal crosswalk or shadow binding rows in baseline');
      }
      const persistedProjection = {
        runId: persisted.id,
        sourceHash: persisted.sourceHash,
        summary: {
          itemCount: persisted.itemCount,
          includedCount: persisted.includedCount,
          excludedCount: persisted.excludedCount,
          unresolvedCount: persisted.unresolvedCount,
        },
        items: persisted.items.map((item) => ({
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
      const recomputedProjection = {
        runId: recomputed.runId,
        sourceHash: recomputed.sourceHash,
        summary: recomputed.summary,
        items: recomputed.items,
      };
      const persistedDigest = canonicalSha256(persistedProjection);
      const recomputedDigest = canonicalSha256(recomputedProjection);
      if (persistedDigest !== recomputedDigest) {
        throw new Error(
          `persisted resource binding inventory has drifted from current inputs (${persistedDigest} != ${recomputedDigest})`,
        );
      }
      const readiness = evaluateCanonicalResourceCutoverReadiness({
        inventory: recomputed,
        decisions: [],
      });
      if (readiness.ready) throw new Error('baseline unexpectedly reports cutover ready');
      for (const consumer of [
        'FORMAL_RECOMMENDATION',
        'FORMAL_PATH',
        'FORMAL_EVIDENCE',
      ] as const) {
        if (selectResourceKnowledgeAuthority(consumer).authority !== 'LEGACY') {
          throw new Error(`formal authority drift for ${consumer}`);
        }
      }
      console.log(JSON.stringify({
        mode: 'verify-only',
        runId: persisted.id,
        complete: persisted.complete,
        cutoverReady: readiness.ready,
        authorityState: 'LEGACY',
        summary: {
          itemCount: persisted.itemCount,
          includedCount: persisted.includedCount,
          excludedCount: persisted.excludedCount,
          unresolvedCount: persisted.unresolvedCount,
          crosswalkCount,
          bindingCount,
        },
      }));
      return;
    }

    const inventory = await buildCurrentInventory(db);
    const persisted = await repository.persistInventory(inventory);
    console.log(JSON.stringify({
      mode: 'import',
      ...persisted,
      inventory: {
        runId: inventory.runId,
        captureRevision: inventory.captureRevision,
        capturedAt: inventory.capturedAt,
        dbWatermark: inventory.dbWatermark,
        sourceHash: inventory.sourceHash,
        complete: inventory.complete,
        cutoverReady: false,
        summary: inventory.summary,
      },
      authorityState: 'LEGACY',
    }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'resource binding shadow import failed');
  process.exitCode = 1;
});
