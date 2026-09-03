import 'dotenv/config';
import { createHash } from 'node:crypto';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const targetDeadline = new Date('2026-08-28T05:00:00.000Z');

function pseudonym(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, assignmentId: true },
  });
  const result = await prisma.$transaction(async (tx) => {
    const audience = await tx.assignmentAudience.findFirstOrThrow({
      where: { assignmentRevisionId: revision.id },
      select: { id: true, classId: true, dueAt: true },
    });
    const submissions = await tx.assignmentSubmission.findMany({
      where: { assignmentRevisionId: revision.id },
      select: { id: true, frozenAudienceDueAt: true },
      orderBy: { id: 'asc' },
    });
    const previousDeadline = submissions.reduce((latest, row) => {
      const deadline = new Date(row.frozenAudienceDueAt);
      return deadline > latest ? deadline : latest;
    }, new Date(0));
    const changed = previousDeadline.getTime() !== targetDeadline.getTime();
    if (changed) {
      await tx.assignmentAudience.update({ where: { id: audience.id }, data: { dueAt: targetDeadline } });
      await tx.assignmentSubmission.updateMany({
        where: { assignmentRevisionId: revision.id },
        data: { frozenAudienceDueAt: targetDeadline },
      });
    }
    const eventKey = `stage-a-deadline-adjust:${revision.id}:${targetDeadline.toISOString()}`;
    const audit = await tx.gradingAuditEvent.upsert({
      where: { eventKey },
      create: {
        eventKey,
        actorPseudoId: 'ops:stage-a-deadline-adjustment',
        actorRole: 'SYSTEM',
        action: 'ADJUST_DEADLINE',
        purpose: 'stage-a-teacher-result-release',
        resourceType: 'AssignmentRevision',
        resourceId: pseudonym(revision.id),
        assignmentId: pseudonym(revision.assignmentId),
        classId: pseudonym(audience.classId),
        metadata: {
          changed,
          previousDeadline: previousDeadline.toISOString(),
          audienceDeadlineBefore: audience.dueAt.toISOString(),
          newDeadline: targetDeadline.toISOString(),
          submissionCount: submissions.length,
          authorization: 'user-authorized-continuation',
        },
      },
      update: {},
      select: { id: true },
    });
    return { changed, previousDeadline, submissionCount: submissions.length, auditId: audit.id };
  });
  console.log(JSON.stringify({ revisionId: pseudonym(revision.id), ...result, previousDeadline: result.previousDeadline.toISOString(), targetDeadline: targetDeadline.toISOString() }));
}

void main().finally(() => prisma.$disconnect());
