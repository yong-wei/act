import type { PrismaClient } from '@prisma/client';

import type { SarAssociationExpansionResult } from '@/lib/data-governance/sar-association-expansion';
import { buildTeacherCourseBasisLessonDesignCandidatesFromReader } from '@/lib/source-pack/teacher-course-basis';
import { retrieveSourcePack, type RetrieveSourcePackInput } from '@/lib/source-pack/hybrid-retriever';

import type { CourseBasisActor } from './domain';
import { CourseBasisError } from './domain';

export async function buildCourseBasisLessonDesignSourcePack(
  db: PrismaClient,
  input: {
    actor: CourseBasisActor;
    selectedVersionIds: readonly string[];
    explicitRetiredVersionIds?: readonly string[];
    sar: SarAssociationExpansionResult;
    retrieval: Omit<RetrieveSourcePackInput, 'profile' | 'role' | 'caller' | 'candidates'>;
  },
) {
  const ownerUserId = await resolveSelectedOwner(db, input.actor, input.selectedVersionIds);
  const candidates = await buildTeacherCourseBasisLessonDesignCandidatesFromReader({
    reader: {
      readCourseBasisProjections: ({ ownerUserId, selectedVersionIds }) => db.courseBasisProjection.findMany({
        where: {
          versionId: { in: [...selectedVersionIds] },
          version: { document: { courseBasis: { ownerId: ownerUserId } } },
        },
        include: {
          segment: true,
          version: { include: { document: { include: { courseBasis: true } } } },
        },
        orderBy: [{ versionId: 'asc' }, { segment: { orderIndex: 'asc' } }],
      }),
    },
    ownerUserId,
    selectedVersionIds: input.selectedVersionIds,
    explicitRetiredVersionIds: input.explicitRetiredVersionIds,
    sar: input.sar,
  });
  return {
    chunks: candidates.chunks,
    retrieval: retrieveSourcePack({
      ...input.retrieval,
      profile: 'lesson-design',
      role: input.actor.role === 'ADMIN' ? 'admin' : 'teacher',
      caller: input.actor.id,
      candidates: candidates.items,
    }),
  };
}

export async function buildCourseBasisLessonDesignSar(
  db: PrismaClient,
  input: {
    actor: CourseBasisActor;
    selectedVersionIds: readonly string[];
    explicitRetiredVersionIds?: readonly string[];
    query: string;
  },
): Promise<SarAssociationExpansionResult> {
  const ownerUserId = await resolveSelectedOwner(db, input.actor, input.selectedVersionIds);
  const projections = await db.courseBasisProjection.findMany({
    where: {
      versionId: { in: [...input.selectedVersionIds] },
      version: {
        reviewState: 'CONFIRMED',
        OR: [
          { retiredAt: null },
          { id: { in: [...(input.explicitRetiredVersionIds ?? [])] } },
        ],
        document: { courseBasis: { ownerId: ownerUserId } },
      },
    },
    select: { corpusSourceId: true },
    orderBy: { corpusSourceId: 'asc' },
  });
  const retrievalChunkIds = projections.map((projection) => projection.corpusSourceId);
  const limitations = ['course-basis-projection-seed', 'source-pack-ranking-required'];
  return {
    id: `sar:association:course-basis:${ownerUserId}`,
    useCase: 'source-pack-seeding',
    query: input.query,
    candidateRefs: {
      eventIds: [], entityIds: [], citationTargetIds: [], retrievalChunkIds,
      resourceNodeIds: [], planningUnitIds: [],
    },
    events: [],
    entities: [],
    trace: {
      id: `sar:trace:association:course-basis:${ownerUserId}`,
      seedEntityIds: [], expansionHops: [], selectedRefs: retrievalChunkIds,
      rejectedRefs: [], limitations, versionRefs: ['course-basis-projection-seed.v1'],
    },
    limitations,
    sourcePackSeedRefs: retrievalChunkIds,
  };
}

async function resolveSelectedOwner(
  db: PrismaClient,
  actor: CourseBasisActor,
  selectedVersionIds: readonly string[],
) {
  const selectedOwners = await db.courseBasisDocumentVersion.findMany({
    where: { id: { in: [...selectedVersionIds] } },
    select: { document: { select: { courseBasis: { select: { ownerId: true } } } } },
  });
  const ownerIds = [...new Set(selectedOwners.map((version) => version.document.courseBasis.ownerId))];
  const ownerUserId = actor.role === 'ADMIN' ? ownerIds[0] : actor.id;
  if (selectedOwners.length !== new Set(selectedVersionIds).size
    || !ownerUserId
    || ownerIds.length !== 1
    || (actor.role === 'TEACHER' && ownerUserId !== ownerIds[0])) {
    throw new CourseBasisError('version-not-found');
  }
  return ownerUserId;
}
