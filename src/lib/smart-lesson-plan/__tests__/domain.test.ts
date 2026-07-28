import { describe, expect, it } from 'vitest';

import {
  SmartLessonPlanError,
  assertSingleLessonDuration,
  canonicalSourceFields,
  createDeterministicFixtureProvider,
  deterministicPlanChecks,
  projectAggregateClassContext,
  projectCurrentCumulativeClassPortrait,
  selectStructuredProvider,
  SMART_LESSON_FIXTURE_STAGES,
  smartLessonGenerationInputHash,
} from '../domain';
import { bopppsStageSchema, smartLessonOutlineOutputSchema } from '../schema';

const binding = {
  citationId: 'citation-1',
  sourceVersionId: 'version-1',
  anchor: 'chapter-1',
  contentHash: 'a'.repeat(64),
};

function pending(overrides: Partial<Parameters<typeof canonicalSourceFields>[0]> = {}) {
  return canonicalSourceFields({
    itemId: 'goal-1',
    itemLineageId: 'goal-lineage-1',
    taskLineageId: 'task-lineage-1',
    content: '建立闭环系统稳定性的判断能力',
    sourceState: 'AI_GENERATED_SOURCE_PENDING',
    sourceBindings: [],
    ...overrides,
  });
}

describe('smart lesson aggregate domain', () => {
  it('accepts only one-lesson durations from 30 to 120 in five-minute increments', () => {
    expect(assertSingleLessonDuration(45)).toBe(45);
    expect(assertSingleLessonDuration(90)).toBe(90);
    for (const invalid of [25, 31, 125, 60.5]) {
      expect(() => assertSingleLessonDuration(invalid)).toThrowError(SmartLessonPlanError);
    }
  });

  it('projects aggregate class context and rejects private learner evidence', () => {
    const safe = {
      classId: 'class-1',
      asOf: '2026-07-19T00:00:00.000Z',
      contextRef: 'cumulative-class-portrait:abc',
      cohortBucket: '20-plus',
      overall: { attainment: 0.6, coverage: 0.8, confidence: 0.7 },
      competencies: [{ identity: 'stability', attainment: 0.5, coverage: 0.75, confidence: 0.8 }],
      gaps: [{ identity: 'stability', reason: 'improvement-cluster' }],
    };
    expect(projectAggregateClassContext(safe)).toEqual(safe);
    expect(() => projectAggregateClassContext({ ...safe, rawAnswers: [{ studentId: 'student-1', body: 'private' }] }))
      .toThrowError('aggregate-class-context-invalid');
  });

  it('projects only the allowlisted current cumulative class portrait aggregate', () => {
    const projected = projectCurrentCumulativeClassPortrait({
      classId: 'class-1',
      portrait: {
        stateKind: 'SNAPSHOT',
        evidenceAsOf: '2026-07-19T00:00:00.000Z',
        generatedAt: '2026-07-19T01:00:00.000Z',
        activeStudentCount: 18,
        totalStudentCount: 36,
        aggregate: {
          overall: { mean: 0.62, meanConfidence: 0.71, includedCount: 30, missingCount: 6 },
          dimensions: {
            stability: { mean: 0.55, meanConfidence: 0.8, includedCount: 27, missingCount: 9 },
          },
        },
        diagnosis: {
          improvementClusters: ['stability'],
          limitations: ['private free text must not persist'],
          riskList: [{ studentId: 'student-1' }],
        },
      },
    });
    expect(projected).toMatchObject({
      classId: 'class-1',
      asOf: '2026-07-19T00:00:00.000Z',
      cohortBucket: '20-plus',
      overall: { attainment: 0.62, coverage: 30 / 36, confidence: 0.71 },
      competencies: [{ identity: 'stability', attainment: 0.55, coverage: 27 / 36, confidence: 0.8 }],
      gaps: [{ identity: 'stability', reason: 'improvement-cluster' }],
    });
    expect(JSON.stringify(projected)).not.toContain('student-1');
    expect(JSON.stringify(projected)).not.toContain('private free text');
  });

  it('keeps pending gap identity stable and changes it only with gap-defining inputs', () => {
    const first = pending();
    expect(pending().gapIdentity).toBe(first.gapIdentity);
    expect(pending({ content: '修改后的目标' }).gapIdentity).not.toBe(first.gapIdentity);
    expect(pending({ itemId: 'goal-recreated' }).gapIdentity).not.toBe(first.gapIdentity);
    expect(pending({ sourceState: 'TEACHER_CREATED_SOURCE_PENDING' }).gapIdentity).not.toBe(first.gapIdentity);
    expect(pending({ sourceBindings: [binding] }).gapIdentity).not.toBe(first.gapIdentity);
    expect(pending({ content: '建立闭环系统稳定性的判断能力！  ' }).gapIdentity).toBe(first.gapIdentity);
  });

  it('hashes only normalized generation inputs and is sensitive to task revision', () => {
    const task = {
      id: 'task-1', lineageId: 'task-lineage-1', revision: 1, courseBasisId: 'basis-1',
      topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 45,
      outlineConfirmationRequired: false, scopeConfirmedAt: new Date('2026-07-19T00:00:00Z'),
      goalsConfirmedAt: new Date('2026-07-19T00:00:00Z'), aggregateClassContext: null,
      aggregateClassContextRef: null,
      sources: [{ sourceVersionId: 'version-2' }, { sourceVersionId: 'version-1' }],
      knowledgePoints: [{
        id: 'kp-1', lineageId: 'kp-lineage-1', title: '稳定性', contentHash: 'kp-hash',
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], sourceBindingSetHash: 'empty-hash',
        gapIdentity: 'gap-1', origin: 'TEACHER_CREATED', supersedesIds: ['kp-3', 'kp-2'],
      }],
      goals: [{
        id: 'goal-1', lineageId: 'goal-lineage-1', content: '判断稳定性', contentHash: 'goal-hash',
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], sourceBindingSetHash: 'empty-hash',
        gapIdentity: 'gap-2', standardsMappings: [],
      }],
    };
    const first = smartLessonGenerationInputHash(task);
    expect(smartLessonGenerationInputHash({
      ...task,
      sources: [...task.sources].reverse(),
      knowledgePoints: task.knowledgePoints.map((point) => ({ ...point, supersedesIds: [...point.supersedesIds].reverse() })),
    })).toBe(first);
    expect(smartLessonGenerationInputHash({ ...task, revision: 2 })).not.toBe(first);
  });

  it('requires verified items to retain governed bindings and removes their gap identity', () => {
    expect(() => pending({ sourceState: 'VERIFIED', sourceBindings: [] })).toThrowError('verified-source-binding-required');
    const verified = pending({ sourceState: 'VERIFIED', sourceBindings: [binding] });
    expect(verified.gapIdentity).toBeNull();
    expect(verified.sourceBindings).toEqual([binding]);
  });

  it('selects an enabled structured provider and never selects fixtures in production', () => {
    const candidates = [
      { serviceId: 'fixture', providerKind: 'fixture', model: 'fixture-v1', enabled: true, priority: 1, capabilities: { jsonSchema: true }, fixture: true },
      { serviceId: 'runtime', providerKind: 'openai-compatible', model: 'model-1', enabled: true, priority: 2, capabilities: { jsonSchema: true } },
    ];
    expect(selectStructuredProvider(candidates, 'test').serviceId).toBe('fixture');
    expect(selectStructuredProvider(candidates, 'production').serviceId).toBe('runtime');
    expect(() => selectStructuredProvider(candidates.slice(0, 1), 'production')).toThrowError('structured-provider-unavailable');
  });

  it('returns deterministic schema-valid output for all seven generation stages and is forbidden in production', async () => {
    expect(() => createDeterministicFixtureProvider('production')).toThrowError('fixture-provider-forbidden');
    const provider = createDeterministicFixtureProvider('test');
    for (const stage of SMART_LESSON_FIXTURE_STAGES) {
      const first = await provider.generateStage({ mode: 'success', stage, seed: 'same' });
      const second = await provider.generateStage({ mode: 'success', stage, seed: 'same' });
      expect(second).toEqual(first);
      expect(stage === 'OUTLINE'
        ? smartLessonOutlineOutputSchema.safeParse(first).success
        : bopppsStageSchema.safeParse(first).success).toBe(true);
    }
  });

  it('exposes deterministic invalid-schema and retryable failure seams', async () => {
    const provider = createDeterministicFixtureProvider('test');
    await expect(provider.generateStage({ mode: 'retryable-failure', stage: 'OUTLINE', seed: 'same' })).rejects.toMatchObject({ status: 503 });
    await expect(provider.generateStage({ mode: 'invalid-schema', stage: 'OUTLINE', seed: 'same' })).resolves.toEqual({ invalid: true });
  });

  it('emits resumable progressive output without changing the final stage result', async () => {
    const provider = createDeterministicFixtureProvider('test');
    const firstProgress: number[] = [];
    const first = await provider.generateStage({
      mode: 'progressive', stage: 'OUTLINE', seed: 'resume-seed',
      onProgress: (event) => { firstProgress.push(event.sequence); },
    });
    const resumedProgress: number[] = [];
    const resumed = await provider.generateStage({
      mode: 'progressive', stage: 'OUTLINE', seed: 'resume-seed', resumeAfterSequence: 1,
      onProgress: (event) => { resumedProgress.push(event.sequence); },
    });
    expect(firstProgress).toEqual([1, 2, 3]);
    expect(resumedProgress).toEqual([2, 3]);
    expect(resumed).toEqual(first);
  });

  it('observes cancellation before generation and between progressive chunks', async () => {
    const provider = createDeterministicFixtureProvider('test');
    await expect(provider.generateStage({ mode: 'cancelled', stage: 'OUTLINE', seed: 'same' }))
      .rejects.toMatchObject({ code: 'generation-cancelled', status: 409 });
    const controller = new AbortController();
    await expect(provider.generateStage({
      mode: 'progressive', stage: 'BRIDGE_IN', seed: 'same', signal: controller.signal,
      onProgress: ({ sequence }) => { if (sequence === 1) controller.abort(); },
    })).rejects.toMatchObject({ code: 'generation-cancelled', status: 409 });
  });

  it('reports undeclared goal source bindings as deterministic advisory-independent failures', () => {
    const plan = { goals: [{ id: 'goal-1', sourceBindings: [binding] }], knowledgePoints: [], sources: [] } as never;
    expect(deterministicPlanChecks(plan)).toEqual([
      { code: 'goal-source-not-declared', path: 'goals.goal-1', message: '目标引用不在教案来源集合中。' },
    ]);
  });
});
