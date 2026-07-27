import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  buildAtomicResourceId,
  buildResourceBindingInventory,
  canonicalSha256,
  CanonicalResourceBindingRepository,
  evaluateCanonicalResourceCutoverReadiness,
  runtimeProjectionObservation,
  resolveGeneratedPublicationAggregate,
  selectResourceKnowledgeAuthority,
  type CanonicalResourceBindingDatabase,
  type ResourceInventoryObservation,
} from '../../src/lib/canonical-resource-binding';
import { getAllRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import { loadRuntimeResourceProjectionInputs } from '../../src/lib/teacher-resource-node-data';

const GIT_COMMIT = /^[a-f0-9]{40}$/u;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function booleanValue(...records: Record<string, unknown>[]): (key: string) => boolean {
  return (key) => records.some((record) => record[key] === true);
}

function dispositionSignals(...values: unknown[]) {
  const records = values.map(asRecord);
  const readBoolean = booleanValue(...records);
  const availability = records
    .map((record) => record.availability)
    .find((value): value is string => typeof value === 'string');
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

async function captureRevision(): Promise<string> {
  const environmentRevision = process.env.APP_REVISION?.trim();
  const revisionPath = path.resolve(process.env.APP_REVISION_FILE ?? '.app-revision');
  const fileRevision = await readFile(revisionPath, 'utf8')
    .then((value) => value.trim())
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
  if (environmentRevision && fileRevision && environmentRevision !== fileRevision) {
    throw new Error('APP_REVISION does not match the immutable image revision file');
  }
  const revision = fileRevision ?? environmentRevision;
  if (!revision || !GIT_COMMIT.test(revision)) {
    throw new Error('immutable APP_REVISION is required for resource binding inventory');
  }
  return revision;
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
  const revision = await captureRevision();
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
  return buildResourceBindingInventory(observations);
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
      const revision = await captureRevision();
      const [latest, crosswalkCount, bindingCount] = await Promise.all([
        db.resourceBindingInventoryRun.findFirst({
          where: { captureRevision: revision },
          orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
          include: { items: { orderBy: { atomicResourceId: 'asc' } } },
        }),
        db.actkgEvidenceStructuralUnitCrosswalk.count(),
        db.canonicalResourceBindingDecision.count(),
      ]);
      if (!latest) throw new Error('current APP_REVISION inventory is missing');
      if (
        !latest.complete
        || latest.items.length !== latest.itemCount
        || latest.itemCount !== (
          latest.includedCount + latest.excludedCount + latest.unresolvedCount
        )
      ) {
        throw new Error('persisted resource binding inventory is missing or incomplete');
      }
      if (crosswalkCount !== 0 || bindingCount !== 0) {
        throw new Error('unexpected formal crosswalk or shadow binding rows in baseline');
      }
      const recomputed = await buildCurrentInventory(db, {
        capturedAt: latest.capturedAt.toISOString(),
        dbWatermark: latest.dbWatermark,
      });
      const persistedProjection = {
        runId: latest.id,
        sourceHash: latest.sourceHash,
        summary: {
          itemCount: latest.itemCount,
          includedCount: latest.includedCount,
          excludedCount: latest.excludedCount,
          unresolvedCount: latest.unresolvedCount,
        },
        items: latest.items.map((item) => ({
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
        runId: latest.id,
        complete: latest.complete,
        cutoverReady: readiness.ready,
        authorityState: 'LEGACY',
        summary: {
          itemCount: latest.itemCount,
          includedCount: latest.includedCount,
          excludedCount: latest.excludedCount,
          unresolvedCount: latest.unresolvedCount,
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
