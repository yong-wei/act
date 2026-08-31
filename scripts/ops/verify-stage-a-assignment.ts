import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createHash } from 'node:crypto';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const hash = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
async function main() {
try {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    include: { assignment: { select: { id: true, authorId: true } }, questions: { select: { stableQuestionId: true, points: true } }, audiences: { select: { classId: true, dueAt: true } }, assetReferences: { select: { assetId: true, field: true, stableQuestionId: true, asset: { select: { state: true } } } } },
  });
  const audienceClass = revision.audiences[0];
  if (!audienceClass) throw new Error('audience-missing');
  const roster = await prisma.studentProfile.findMany({ where: { classId: audienceClass.classId }, select: { userId: true } });
  const submissions = await prisma.assignmentSubmission.findMany({ where: { assignmentRevisionId: revision.id }, select: { studentId: true } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { id: revision.assignment.authorId }, select: { role: true, passwordHash: true } });
  const rosterSet = new Set(roster.map((row) => row.userId));
  const inAudience = roster.filter((row) => rosterSet.has(row.userId)).length;
  console.log(JSON.stringify({ assignmentId: hash(revision.assignment.id), revisionId: hash(revision.id), version: revision.version, questionIds: revision.questions.map((q) => q.stableQuestionId), totalPoints: revision.questions.reduce((sum, q) => sum + Number(q.points), 0), audienceClassId: hash(audienceClass.classId), rosterCount: roster.length, audienceRosterCount: inAudience, submissionCount: submissions.length, teacherRole: teacher.role, teacherPasswordHashPresent: Boolean(teacher.passwordHash), assetReferenceCount: revision.assetReferences.length, availableAssetReferenceCount: revision.assetReferences.filter((ref) => ref.asset.state === 'AVAILABLE').length, assetFields: revision.assetReferences.map((ref) => `${ref.stableQuestionId}:${ref.field}`).sort(), dueAt: audienceClass.dueAt.toISOString() }));
} finally { await prisma.$disconnect(); }
}
void main();
