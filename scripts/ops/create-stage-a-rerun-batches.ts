import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createQuestionScopedGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const requestedQuestionId = process.env.STAGE_A_QUESTION_ID?.trim();
const requestedAttemptIds = new Set((process.env.STAGE_A_ATTEMPT_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const rerunReason = process.env.STAGE_A_RERUN_REASON?.trim() || 'stage A controlled rerun for failed items only';

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { assignment: { select: { id: true, authorId: true } }, questions: { orderBy: { orderIndex: 'asc' }, select: { id: true, stableQuestionId: true } }, audiences: { select: { classId: true } } } });
  const outputs: unknown[] = [];
  const rubricPolicyId = 'grading-provider:siliconflow:qwen3.5-35b-rubric-2026-08-18-v1';
  const visualPolicyId = 'grading-provider:siliconflow:qwen3-vl-8b-visual-2026-08-17-v1';
  const rerunVersion = process.env.STAGE_A_RERUN_VERSION?.trim() || 'v11';
  for (const question of revision.questions.filter((candidate) => !requestedQuestionId || candidate.stableQuestionId === requestedQuestionId)) {
    const result = await createQuestionScopedGradingBatch({ db: prisma, request: {
      assignmentRevisionId: revision.id,
      questionId: question.id,
      classId: revision.audiences[0].classId,
      actor: { id: revision.assignment.authorId, role: 'TEACHER' },
      policyId: rubricPolicyId,
      conversionPolicyId: null,
      visualPolicyId,
      idempotencyKey: `stage-a-visual-policy-rerun-${rerunVersion}-${revision.id}-${question.id}`,
      rerunReason,
      ...(requestedAttemptIds.size > 0 ? { attemptIds: [...requestedAttemptIds] } : {}),
      maxItems: 20,
    }});
    outputs.push({ questionId: question.stableQuestionId, batchId: result.batch.id, state: result.batch.state, totalItems: result.items.length, replay: result.replay });
  }
  console.log(JSON.stringify({ revisionId: revision.id, outputs }));
}
void main().finally(() => prisma.$disconnect());
