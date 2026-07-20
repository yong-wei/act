import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { contentHash } from '@/lib/smart-lesson-plan/domain';

export type GeneratedCoursewareSessionIdentity = {
  publicationRevisionId: string;
  manifestHash: string;
  displayName: string;
  revisionNumber: number;
  planRevisionNumber: number;
  projectedLessonPlanId: string;
};

export type GeneratedCoursewareRecovery = {
  kind: 'generated-courseware-integrity-recovery';
  code:
    | 'generated-courseware-revision-missing'
    | 'generated-courseware-manifest-hash-mismatch'
    | 'generated-courseware-plan-projection-mismatch'
    | 'generated-courseware-session-identity-incomplete';
  message: string;
  sessionId: string;
};

type BoundSession = {
  id: string;
  planId: string;
  coursewarePublicationRevisionId: string | null;
  coursewareDisplayName: string | null;
  coursewareRevisionNumber: number | null;
  coursewarePlanRevisionNumber: number | null;
  manifestHash: string | null;
};

type RuntimeDb = Pick<PrismaClient, 'smartCoursewarePublicationRevision' | 'classSessionIntegrityIncident'>;

export async function resolveGeneratedCoursewareSessionBinding(
  db: RuntimeDb,
  session: BoundSession,
): Promise<
  | { ok: true; generated: false; identity: null }
  | { ok: true; generated: true; identity: GeneratedCoursewareSessionIdentity }
  | { ok: false; recovery: GeneratedCoursewareRecovery }
> {
  if (!session.coursewarePublicationRevisionId) {
    return { ok: true, generated: false, identity: null };
  }

  const publication = await db.smartCoursewarePublicationRevision.findUnique({
    where: { id: session.coursewarePublicationRevisionId },
    select: {
      id: true,
      displayName: true,
      revisionNumber: true,
      planRevisionNumber: true,
      manifestHash: true,
      projectedLessonPlans: {
        select: { id: true, generatedCoursewareManifestHash: true },
      },
    },
  });

  if (!publication) {
    return recovery(db, session, 'generated-courseware-revision-missing', {}, {
      publicationRevisionId: session.coursewarePublicationRevisionId,
    });
  }

  const projection = publication.projectedLessonPlans[0] ?? null;
  const expectedIdentity = {
    publicationRevisionId: publication.id,
    manifestHash: publication.manifestHash,
    displayName: publication.displayName,
    revisionNumber: publication.revisionNumber,
    planRevisionNumber: publication.planRevisionNumber,
    projectedLessonPlanId: projection?.id ?? '',
  };
  const observedIdentity = {
    publicationRevisionId: session.coursewarePublicationRevisionId,
    manifestHash: session.manifestHash,
    displayName: session.coursewareDisplayName,
    revisionNumber: session.coursewareRevisionNumber,
    planRevisionNumber: session.coursewarePlanRevisionNumber,
    projectedLessonPlanId: session.planId,
    projectedManifestHash: projection?.generatedCoursewareManifestHash ?? null,
  };

  if (
    !session.manifestHash
    || !session.coursewareDisplayName
    || session.coursewareRevisionNumber === null
    || session.coursewarePlanRevisionNumber === null
  ) {
    return recovery(
      db,
      session,
      'generated-courseware-session-identity-incomplete',
      expectedIdentity,
      observedIdentity,
    );
  }
  if (
    session.manifestHash !== publication.manifestHash
    || session.coursewareDisplayName !== publication.displayName
    || session.coursewareRevisionNumber !== publication.revisionNumber
    || session.coursewarePlanRevisionNumber !== publication.planRevisionNumber
  ) {
    return recovery(
      db,
      session,
      'generated-courseware-manifest-hash-mismatch',
      expectedIdentity,
      observedIdentity,
    );
  }
  if (
    publication.projectedLessonPlans.length !== 1
    || projection?.id !== session.planId
    || projection.generatedCoursewareManifestHash !== publication.manifestHash
  ) {
    return recovery(
      db,
      session,
      'generated-courseware-plan-projection-mismatch',
      expectedIdentity,
      observedIdentity,
    );
  }

  return { ok: true, generated: true, identity: expectedIdentity };
}

export function generatedCoursewareRedisIdentityMatches(
  cached: Record<string, unknown>,
  identity: GeneratedCoursewareSessionIdentity,
) {
  return cached.coursewarePublicationRevisionId === identity.publicationRevisionId
    && cached.manifestHash === identity.manifestHash
    && cached.coursewareDisplayName === identity.displayName
    && Number(cached.coursewareRevisionNumber) === identity.revisionNumber
    && Number(cached.coursewarePlanRevisionNumber) === identity.planRevisionNumber
    && cached.planId === identity.projectedLessonPlanId;
}

export function generatedCoursewareRedisFields(identity: GeneratedCoursewareSessionIdentity | null) {
  return identity ? {
    coursewarePublicationRevisionId: identity.publicationRevisionId,
    manifestHash: identity.manifestHash,
    coursewareDisplayName: identity.displayName,
    coursewareRevisionNumber: identity.revisionNumber,
    coursewarePlanRevisionNumber: identity.planRevisionNumber,
    planId: identity.projectedLessonPlanId,
  } : {};
}

async function recovery(
  db: RuntimeDb,
  session: BoundSession,
  code: GeneratedCoursewareRecovery['code'],
  expected: Record<string, unknown>,
  observed: Record<string, unknown>,
): Promise<{ ok: false; recovery: GeneratedCoursewareRecovery }> {
  const fingerprint = contentHash({ code, expected, observed });
  try {
    await db.classSessionIntegrityIncident.upsert({
      where: { sessionId_fingerprint: { sessionId: session.id, fingerprint } },
      create: {
        id: randomUUID(),
        sessionId: session.id,
        code,
        fingerprint,
        expected: expected as Prisma.InputJsonValue,
        observed: observed as Prisma.InputJsonValue,
      },
      update: { occurrenceCount: { increment: 1 } },
    });
  } catch (error) {
    console.error('[GeneratedCoursewareIntegrity] Failed to persist incident:', error);
  }
  return {
    ok: false,
    recovery: {
      kind: 'generated-courseware-integrity-recovery',
      code,
      message: '该课堂绑定的互动课件版本无法通过完整性校验，请教师重新选择已发布版本创建课堂。',
      sessionId: session.id,
    },
  };
}
