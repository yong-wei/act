import { randomUUID } from 'node:crypto';
import { generateObject } from 'ai';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { createAIProviderFromConfig } from '@/lib/ai/provider-registry';
import { resolveConfiguredAIProviderConfig } from '@/lib/ai/provider-settings';
import { pseudonymizeGradingLineage } from '@/lib/data-governance/math-document-grading-lifecycle';
import {
  ASSIGNMENT_LIMITS,
  AssignmentDomainError,
  scoringRubricV2Schema,
} from './assignment-domain';
import { stableHash } from './assignment-integrity';

export const ASSIGNMENT_RUBRIC_GENERATION_SCHEMA_VERSION =
  'assignment-rubric-guidelines.v1';

export const assignmentRubricGenerationRequestSchema = z.object({
  revisionId: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().positive(),
  questionId: z.string().trim().min(1).max(100),
  scoringItemId: z.string().trim().min(1).max(80),
  levelIds: z.array(z.string().trim().min(1).max(80))
    .min(1)
    .max(ASSIGNMENT_LIMITS.levels)
    .refine((ids) => new Set(ids).size === ids.length, 'duplicate-level-id'),
  basis: z.enum(['scoring-standard', 'scoring-item-name']),
}).strict();

export const generatedRubricGuidelinesSchema = z.object({
  levels: z.array(z.object({
    levelId: z.string().trim().min(1).max(80),
    guideline: z.string().trim().min(1).max(2_000),
  }).strict()).min(1).max(ASSIGNMENT_LIMITS.levels),
}).strict();

export type AssignmentRubricGenerationRequest = z.infer<
  typeof assignmentRubricGenerationRequestSchema
>;

type RubricGenerationProvider = {
  provider: string;
  model: string;
  generate(input: {
    schema: typeof generatedRubricGuidelinesSchema;
    system: string;
    prompt: string;
    requestId: string;
  }): Promise<{
    output: unknown;
    responseId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  }>;
};

type RubricGenerationDb = Pick<
  PrismaClient,
  'assignment' | 'assignmentRevision' | 'gradingAuditEvent'
>;

export async function resolveAssignmentRubricGenerationProvider(): Promise<RubricGenerationProvider> {
  try {
    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { jsonSchema: true },
    );
    if (!config.enabled) {
      throw new AssignmentDomainError('rubric-generation-unavailable');
    }
    const adapter = createAIProviderFromConfig(config);
    return {
      provider: config.provider,
      model: config.model,
      async generate(input) {
        const result = await generateObject({
          model: adapter.getModel(),
          schema: input.schema,
          schemaName: ASSIGNMENT_RUBRIC_GENERATION_SCHEMA_VERSION.replace(
            /[^A-Za-z0-9_-]/g,
            '_',
          ),
          system: input.system,
          prompt: input.prompt,
          temperature: 0.1,
          maxRetries: 0,
          maxOutputTokens: 4_000,
          headers: { 'Idempotency-Key': input.requestId },
        });
        return {
          output: result.object,
          responseId: result.response?.id ?? null,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
        };
      },
    };
  } catch (error) {
    if (error instanceof AssignmentDomainError) throw error;
    throw new AssignmentDomainError('rubric-generation-unavailable');
  }
}

export async function generateAssignmentRubricGuidelines(
  db: RubricGenerationDb,
  input: {
    actor: { id: string; role: 'TEACHER' | 'ADMIN' };
    assignmentId: string;
    request: AssignmentRubricGenerationRequest;
  },
  provider: RubricGenerationProvider,
) {
  const request = assignmentRubricGenerationRequestSchema.parse(input.request);
  const assignment = await db.assignment.findFirst({
    where: input.actor.role === 'ADMIN'
      ? { id: input.assignmentId }
      : { id: input.assignmentId, authorId: input.actor.id },
    select: { id: true },
  });
  if (!assignment) throw new AssignmentDomainError('assignment-forbidden');

  const revision = await readBoundRubricRevision(
    db,
    input.assignmentId,
    request,
  );
  const basisText = selectGenerationBasis(
    revision.criterion,
    request.basis,
  );
  const requestId = randomUUID();
  const auditBase = {
    requestId,
    actor: input.actor,
    assignmentId: input.assignmentId,
    revisionId: request.revisionId,
    questionId: request.questionId,
    scoringItemId: request.scoringItemId,
    expectedVersion: request.expectedVersion,
    basis: request.basis,
    levelCount: revision.levels.length,
    provider: provider.provider,
    model: provider.model,
  };

  try {
    const generated = await provider.generate({
      schema: generatedRubricGuidelinesSchema,
      requestId,
      system: [
        '你是教师评分细则辅助工具。',
        '只为给定评价级别填写评分准则，不得修改级别身份、名称、分值、数量或顺序。',
        '每条准则应具体、可观察、可据证评分，并严格返回完整 JSON 集合。',
      ].join('\n'),
      prompt: JSON.stringify({
        basis: basisText,
        levels: revision.levels.map((level) => ({
          levelId: level.id,
          label: level.label,
          maxPoints: level.maxPoints,
        })),
      }),
    });
    const output = validateCompleteGeneratedSet(
      generated.output,
      revision.levels.map((level) => level.id),
    );
    await assertRevisionStillCurrent(
      db,
      input.assignmentId,
      request,
    );
    await writeRubricGenerationAudit(db, {
      ...auditBase,
      outcome: 'SUCCEEDED',
      responseId: generated.responseId ?? null,
      inputTokens: generated.inputTokens ?? null,
      outputTokens: generated.outputTokens ?? null,
    });
    return {
      schemaVersion: ASSIGNMENT_RUBRIC_GENERATION_SCHEMA_VERSION,
      revisionId: request.revisionId,
      revisionVersion: request.expectedVersion,
      questionId: request.questionId,
      scoringItemId: request.scoringItemId,
      levels: output.levels,
      audit: {
        requestId,
        provider: provider.provider,
        model: provider.model,
        basis: request.basis,
      },
    };
  } catch (error) {
    const code = error instanceof AssignmentDomainError
      ? error.code
      : 'rubric-generation-unavailable';
    await writeRubricGenerationAudit(db, {
      ...auditBase,
      outcome: code === 'rubric-generation-output-invalid'
        ? 'REJECTED'
        : 'FAILED',
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      failureCode: code,
    });
    if (error instanceof AssignmentDomainError) throw error;
    throw new AssignmentDomainError('rubric-generation-unavailable');
  }
}

function validateCompleteGeneratedSet(
  value: unknown,
  expectedLevelIds: readonly string[],
) {
  const parsed = generatedRubricGuidelinesSchema.safeParse(value);
  if (!parsed.success) {
    throw new AssignmentDomainError('rubric-generation-output-invalid');
  }
  const actualIds = parsed.data.levels.map((level) => level.levelId);
  if (new Set(actualIds).size !== actualIds.length
    || actualIds.length !== expectedLevelIds.length
    || actualIds.some((id) => !expectedLevelIds.includes(id))) {
    throw new AssignmentDomainError('rubric-generation-output-invalid');
  }
  const byLevelId = new Map(
    parsed.data.levels.map((level) => [level.levelId, level]),
  );
  return {
    levels: expectedLevelIds.map((levelId) => byLevelId.get(levelId)!),
  };
}

async function readBoundRubricRevision(
  db: RubricGenerationDb,
  assignmentId: string,
  request: AssignmentRubricGenerationRequest,
) {
  const revision = await db.assignmentRevision.findUnique({
    where: { id: request.revisionId },
    select: {
      assignmentId: true,
      state: true,
      version: true,
      frozenAt: true,
      questions: {
        where: { stableQuestionId: request.questionId },
        select: { stableQuestionId: true, rubricSnapshot: true },
      },
    },
  });
  if (!revision
    || revision.assignmentId !== assignmentId
    || revision.state !== 'DRAFT'
    || revision.frozenAt
    || revision.version !== request.expectedVersion) {
    throw new AssignmentDomainError('rubric-generation-revision-stale');
  }
  const question = revision.questions[0];
  const rubric = scoringRubricV2Schema.safeParse(question?.rubricSnapshot);
  if (!question || !rubric.success) {
    const rawRubric = question?.rubricSnapshot as {
      criteria?: Array<{
        id?: unknown;
        label?: unknown;
        scoringStandard?: unknown;
      }>;
    } | null;
    const rawCriterion = rawRubric?.criteria?.find(
      (item) => item.id === request.scoringItemId,
    );
    if (rawCriterion
      && String(rawCriterion.label ?? '').trim() === ''
      && String(rawCriterion.scoringStandard ?? '').trim() === '') {
      throw new AssignmentDomainError('rubric-generation-basis-missing');
    }
    throw new AssignmentDomainError('rubric-generation-target-invalid');
  }
  const criterion = rubric.data.criteria.find(
    (item) => item.id === request.scoringItemId,
  );
  if (!criterion
    || !criterion.detailedRubricEnabled
    || criterion.levels.length === 0
    || criterion.levels.length !== request.levelIds.length
    || criterion.levels.some((level, index) => level.id !== request.levelIds[index])) {
    throw new AssignmentDomainError('rubric-generation-revision-stale');
  }
  return { criterion, levels: criterion.levels };
}

async function assertRevisionStillCurrent(
  db: RubricGenerationDb,
  assignmentId: string,
  request: AssignmentRubricGenerationRequest,
) {
  await readBoundRubricRevision(db, assignmentId, request);
}

function selectGenerationBasis(
  criterion: z.infer<typeof scoringRubricV2Schema>['criteria'][number],
  basis: AssignmentRubricGenerationRequest['basis'],
) {
  const standard = criterion.scoringStandard.trim();
  const name = criterion.label.trim();
  if (basis === 'scoring-standard') {
    if (!standard) {
      throw new AssignmentDomainError('rubric-generation-basis-missing');
    }
    return standard;
  }
  if (standard || !name) {
    throw new AssignmentDomainError(
      standard
        ? 'rubric-generation-basis-mismatch'
        : 'rubric-generation-basis-missing',
    );
  }
  return name;
}

async function writeRubricGenerationAudit(
  db: RubricGenerationDb,
  input: {
    requestId: string;
    actor: { id: string; role: 'TEACHER' | 'ADMIN' };
    assignmentId: string;
    revisionId: string;
    questionId: string;
    scoringItemId: string;
    expectedVersion: number;
    basis: AssignmentRubricGenerationRequest['basis'];
    levelCount: number;
    provider: string;
    model: string;
    outcome: 'SUCCEEDED' | 'REJECTED' | 'FAILED';
    responseId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    failureCode?: string;
  },
) {
  await db.gradingAuditEvent.create({
    data: {
      eventKey: `assignment-rubric-generation:${input.requestId}`,
      actorPseudoId: pseudonymizeGradingLineage(input.actor.id, 'teacher'),
      actorRole: input.actor.role,
      action: 'assignment-rubric-guidelines.generate',
      purpose: 'teacher-directed-rubric-authoring',
      resourceType: 'AssignmentRevision',
      resourceId: pseudonymizeGradingLineage(
        input.revisionId,
        'assignment-revision',
      ),
      assignmentId: input.assignmentId,
      provider: input.provider,
      providerRequestId: input.responseId,
      policyVersion: ASSIGNMENT_RUBRIC_GENERATION_SCHEMA_VERSION,
      requestHash: stableHash({
        revisionId: input.revisionId,
        questionId: input.questionId,
        scoringItemId: input.scoringItemId,
        expectedVersion: input.expectedVersion,
        basis: input.basis,
        levelCount: input.levelCount,
      }),
      metadata: {
        outcome: input.outcome,
        basis: input.basis,
        levelCount: input.levelCount,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        ...(input.failureCode ? { failureCode: input.failureCode } : {}),
      },
      redactionCount: 3,
    },
  });
}
