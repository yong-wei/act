import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateAssignmentRubricGuidelines,
  generatedRubricGuidelinesSchema,
} from '@/lib/assignments/assignment-rubric-generation';

const request = {
  revisionId: 'revision-1',
  expectedVersion: 4,
  questionId: 'question-1',
  scoringItemId: 'criterion-1',
  levelIds: ['level-high', 'level-low'],
  basis: 'scoring-standard' as const,
};

function revision(input?: {
  version?: number;
  standard?: string;
  name?: string;
  levelIds?: string[];
}) {
  const levelIds = input?.levelIds ?? request.levelIds;
  return {
    assignmentId: 'assignment-1',
    state: 'DRAFT',
    version: input?.version ?? request.expectedVersion,
    frozenAt: null,
    questions: [{
      stableQuestionId: request.questionId,
      rubricSnapshot: {
        schemaVersion: 'assignment-scoring-rubric.v2',
        criteria: [{
          id: request.scoringItemId,
          label: input?.name ?? '证据质量',
          goalDimension: 'engineeringDecision',
          maxPoints: 10,
          scoringStandard: input?.standard ?? '依据证据的正确性与完整性评分。',
          detailedRubricEnabled: true,
          levels: levelIds.map((id, index) => ({
            id,
            label: index === 0 ? '优秀' : '待改进',
            maxPoints: index === 0 ? 10 : 6,
            guideline: '',
          })),
        }],
      },
    }],
  };
}

function harness(revisions = [revision(), revision()]) {
  const findUnique = vi.fn();
  for (const value of revisions) findUnique.mockResolvedValueOnce(value);
  const auditCreate = vi.fn(async (input) => input);
  const db = {
    assignment: { findFirst: vi.fn(async () => ({ id: 'assignment-1' })) },
    assignmentRevision: { findUnique },
    gradingAuditEvent: { create: auditCreate },
  };
  const generate = vi.fn(async () => ({
    output: {
      levels: [
        { levelId: 'level-high', guideline: '完整、准确且证据可复核。' },
        { levelId: 'level-low', guideline: '存在关键缺漏，需要补充证据。' },
      ],
    },
    responseId: 'provider-response-1',
    inputTokens: 80,
    outputTokens: 40,
  }));
  const provider = {
    provider: 'configured-provider',
    model: 'configured-model',
    generate,
  };
  return { db, provider, generate, auditCreate };
}

describe('assignment rubric guideline generation', () => {
  beforeEach(() => {
    process.env.GRADING_AUDIT_SECRET ??= 'rubric-generation-test-secret';
  });

  it('uses the saved scoring standard and returns one guideline per current level', async () => {
    const { db, provider, generate, auditCreate } = harness();
    const result = await generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request,
      },
      provider,
    );

    expect(result.levels.map((level) => level.levelId)).toEqual(request.levelIds);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      schema: generatedRubricGuidelinesSchema,
      prompt: expect.stringContaining('依据证据的正确性与完整性评分。'),
    }));
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'assignment-rubric-guidelines.generate',
        provider: 'configured-provider',
        providerRequestId: 'provider-response-1',
        metadata: expect.objectContaining({
          outcome: 'SUCCEEDED',
          basis: 'scoring-standard',
          levelCount: 2,
        }),
      }),
    });
    expect(JSON.stringify(auditCreate.mock.calls[0][0])).not.toContain(
      '依据证据的正确性与完整性评分。',
    );
  });

  it('accepts a complete keyed set in provider order and returns current level order', async () => {
    const { db, provider, generate } = harness();
    generate.mockResolvedValueOnce({
      output: {
        levels: [
          { levelId: 'level-low', guideline: '需要补充关键证据。' },
          { levelId: 'level-high', guideline: '证据完整且可复核。' },
        ],
      },
      responseId: null,
      inputTokens: null,
      outputTokens: null,
    } as never);
    const result = await generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request,
      },
      provider,
    );
    expect(result.levels.map((level) => level.levelId)).toEqual(request.levelIds);
  });

  it('uses the scoring-item name only after an explicit fallback selection', async () => {
    const { db, provider, generate } = harness([
      revision({ standard: '' }),
      revision({ standard: '' }),
    ]);
    await generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request: { ...request, basis: 'scoring-item-name' },
      },
      provider,
    );
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('证据质量'),
    }));
  });

  it.each([
    [{ standard: '', name: '' }, 'rubric-generation-basis-missing'],
    [{ standard: '已有标准' }, 'rubric-generation-basis-mismatch'],
  ])('rejects an unavailable or weaker basis without calling the provider', async (criterion, code) => {
    const { db, provider, generate, auditCreate } = harness([
      revision(criterion),
    ]);
    await expect(generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request: {
          ...request,
          basis: criterion.standard ? 'scoring-item-name' : 'scoring-standard',
        },
      },
      provider,
    )).rejects.toMatchObject({ code });
    expect(generate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it.each([
    {
      levels: [{ levelId: 'level-high', guideline: '只有一个级别。' }],
    },
    {
      levels: [
        { levelId: 'level-high', guideline: '一。' },
        { levelId: 'level-high', guideline: '二。' },
      ],
    },
    {
      levels: [
        { levelId: 'level-high', guideline: '一。' },
        { levelId: 'invented', guideline: '二。' },
      ],
    },
    {
      levels: [
        { levelId: 'level-high', guideline: '' },
        { levelId: 'level-low', guideline: '二。' },
      ],
    },
  ])('rejects malformed or non-exact output as one complete set', async (output) => {
    const { db, provider, generate, auditCreate } = harness();
    generate.mockResolvedValueOnce({
      output,
      responseId: null,
      inputTokens: null,
      outputTokens: null,
    } as never);
    await expect(generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request,
      },
      provider,
    )).rejects.toMatchObject({ code: 'rubric-generation-output-invalid' });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: 'REJECTED',
          failureCode: 'rubric-generation-output-invalid',
        }),
      }),
    });
  });

  it('rejects a revision changed while the provider was running', async () => {
    const { db, provider, auditCreate } = harness([
      revision(),
      revision({ version: 5 }),
    ]);
    await expect(generateAssignmentRubricGuidelines(
      db as never,
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        request,
      },
      provider,
    )).rejects.toMatchObject({ code: 'rubric-generation-revision-stale' });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: 'FAILED',
          failureCode: 'rubric-generation-revision-stale',
        }),
      }),
    });
  });
});
