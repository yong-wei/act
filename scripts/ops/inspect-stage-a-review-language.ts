import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createPrismaClient } from '../../src/lib/prisma-client';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const anonymous = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);
const hasChinese = (value: unknown) => typeof value === 'string' && /[\u3400-\u9fff]/u.test(value);

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, questions: { select: { id: true, stableQuestionId: true } } },
  });
  const questionNames = new Map(revision.questions.map((question) => [question.id, question.stableQuestionId]));
  const attempts = await prisma.submissionAttempt.findMany({
    where: { answer: { assignmentQuestionId: { in: [...questionNames.keys()] }, submission: { assignmentRevisionId: revision.id } } },
    select: { id: true, answer: { select: { assignmentQuestionId: true } } },
    orderBy: { id: 'asc' },
  });
  const rows = [];
  for (const attempt of attempts) {
    const runs = await prisma.gradingRun.findMany({
      where: { answerAttemptId: attempt.id, state: { in: ['AWAITING_REVIEW', 'APPROVED'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
      select: { id: true, state: true, provider: true, evaluatorVersion: true, overallComment: true, overallFeedback: true, annotations: { select: { reason: true, comment: true } } },
    });
    const run = runs[0];
    if (!run) {
      rows.push({ attempt: anonymous(attempt.id), questionId: questionNames.get(attempt.answer.assignmentQuestionId) ?? 'unknown', state: null });
      continue;
    }
    const annotationTexts = run.annotations.flatMap((annotation) => [annotation.reason, annotation.comment]);
    const feedback = run.overallFeedback && typeof run.overallFeedback === 'object' ? run.overallFeedback as Record<string, unknown> : {};
    const feedbackTexts = Object.values(feedback).flatMap((value) => Array.isArray(value) ? value : []);
    rows.push({
      attempt: anonymous(attempt.id),
      questionId: questionNames.get(attempt.answer.assignmentQuestionId) ?? 'unknown',
      run: anonymous(run.id),
      state: run.state,
      provider: run.provider,
      evaluatorVersion: run.evaluatorVersion,
      annotationCount: run.annotations.length,
      annotationsChinese: annotationTexts.every(hasChinese),
      overallCommentChinese: hasChinese(run.overallComment),
      overallFeedbackChinese: feedbackTexts.every(hasChinese),
    });
  }
  console.log(JSON.stringify({ revision: anonymous(revision.id), count: rows.length, rows }));
}

void main().finally(() => prisma.$disconnect());
