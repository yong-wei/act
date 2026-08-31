import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const activeStates = new Set(['QUEUED', 'RUNNING', 'AWAITING_REVIEW', 'APPROVED']);

function anonymous(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, audiences: { select: { classId: true }, take: 1 }, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } } },
  });
  const classId = revision.audiences[0]?.classId;
  const questions = await Promise.all(revision.questions.map(async (question) => {
    const attempts = await prisma.submissionAttempt.findMany({
      where: { answer: { assignmentQuestionId: question.id, submission: { assignmentRevisionId: revision.id, frozenAudienceClassId: classId } } },
      orderBy: [{ answer: { submission: { studentId: 'asc' } } }, { submittedAt: 'desc' }],
      include: {
        answer: { select: { submission: { select: { studentId: true } } } },
        gradingRuns: { orderBy: { createdAt: 'desc' }, select: { state: true, provider: true, rerunReason: true } },
      },
    });
    return {
      questionId: question.stableQuestionId,
      attempts: attempts.map((attempt) => ({
        student: anonymous(attempt.answer.submission.studentId),
        attempt: anonymous(attempt.id),
        attemptNumber: attempt.attemptNumber,
        answerVersion: attempt.answerVersion,
        activeRunStates: attempt.gradingRuns.filter((run) => activeStates.has(run.state)).map((run) => run.state),
        allRunStates: attempt.gradingRuns.map((run) => run.state),
        latestRunReason: attempt.gradingRuns[0]?.rerunReason ?? null,
        eligibleForNormalBatch: !attempt.gradingRuns.some((run) => activeStates.has(run.state)),
      })),
    };
  }));
  console.log(JSON.stringify({ scope: 'stage-a:T2S-20', revision: anonymous(revision.id), classId: anonymous(classId ?? 'missing'), questions }));
}

void main().finally(() => prisma.$disconnect());
