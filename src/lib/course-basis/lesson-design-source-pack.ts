import type { PrismaClient } from '@prisma/client';

import type { SarAssociationExpansionResult } from '@/lib/data-governance/sar-association-expansion';
import { buildTeacherCourseBasisLessonDesignCandidatesFromReader } from '@/lib/source-pack/teacher-course-basis';
import { retrieveSourcePack, type RetrieveSourcePackInput } from '@/lib/source-pack/hybrid-retriever';

import type { CourseBasisActor } from './domain';

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
    ownerUserId: input.actor.id,
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
