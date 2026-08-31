import 'dotenv/config';
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createQuestionScopedGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const questionFilter = new Set((process.env.STAGE_A_QUESTION_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const hasChinese = (value: unknown) => typeof value === 'string' && /[\u3400-\u9fff]/u.test(value);

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({
    where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { assignment: { select: { authorId: true } }, questions: { select: { id: true, stableQuestionId: true } }, audiences: { select: { classId: true }, take: 1 } },
  });
  const outputs: unknown[] = [];
  const rubricPolicyId = 'grading-provider:siliconflow:qwen3.5-35b-rubric-2026-08-18-v1';
  const visualPolicyId = 'grading-provider:siliconflow:qwen3-vl-8b-visual-2026-08-17-v1';
  for (const question of revision.questions) {
    if (questionFilter.size > 0 && !questionFilter.has(question.stableQuestionId)) continue;
    const attempts = await prisma.submissionAttempt.findMany({
      where: { answer: { assignmentQuestionId: question.id, submission: { assignmentRevisionId: revision.id } } },
      select: { id: true },
    });
    const attemptIds: string[] = [];
    for (const attempt of attempts) {
      const run = await prisma.gradingRun.findFirst({
        where: { answerAttemptId: attempt.id, state: { in: ['AWAITING_REVIEW', 'APPROVED'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { overallComment: true, overallFeedback: true, annotations: { select: { reason: true, comment: true } } },
      });
      if (!run) continue;
      const feedback = run.overallFeedback && typeof run.overallFeedback === 'object' ? run.overallFeedback as Record<string, unknown> : {};
      const feedbackTexts = Object.values(feedback).flatMap((value) => Array.isArray(value) ? value : []);
      const annotationTexts = run.annotations.flatMap((annotation) => [annotation.reason, annotation.comment]);
      if (!hasChinese(run.overallComment) || !feedbackTexts.every(hasChinese) || !annotationTexts.every(hasChinese)) attemptIds.push(attempt.id);
    }
    if (attemptIds.length === 0) continue;
    const result = await createQuestionScopedGradingBatch({ db: prisma, request: {
      assignmentRevisionId: revision.id,
      questionId: question.id,
      classId: revision.audiences[0].classId,
      actor: { id: revision.assignment.authorId, role: 'TEACHER' },
      policyId: rubricPolicyId,
      conversionPolicyId: null,
      visualPolicyId,
      attemptIds,
      rerunReason: 'stage A 中文批注修订：仅重跑历史英文学生可见反馈项目',
      idempotencyKey: `stage-a-language-rerun-${question.stableQuestionId}-${Date.now()}`,
      maxItems: attemptIds.length,
    }});
    outputs.push({ questionId: question.stableQuestionId, itemCount: result.items.length, state: result.batch.state, replay: result.replay });
  }
  console.log(JSON.stringify({ revisionId: revision.id, outputs }));
}

void main().finally(() => prisma.$disconnect());
