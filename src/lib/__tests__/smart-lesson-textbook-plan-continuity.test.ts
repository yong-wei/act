import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  textbookBindings: vi.fn(),
  adopt: vi.fn(),
  sync: vi.fn(),
}));

vi.mock('@/lib/smart-lesson-plan/textbook-resource-pack', () => ({
  retrieveConfirmedTextbookBindings: mocks.textbookBindings,
}));
vi.mock('@/lib/course-basis/service', () => ({
  adoptCourseBasisVersion: mocks.adopt,
  synchronizeCourseBasisAdopterVersions: mocks.sync,
}));

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import {
  approveSmartLessonDraft,
  deriveSmartLessonSourceState,
  sourceBindingEvidenceKey,
  updateSmartLessonDraft,
} from '@/lib/smart-lesson-plan/service';
import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

describe('smart lesson textbook plan continuity', () => {
  it('matches, saves, and approves a plan grounded in a confirmed textbook range', async () => {
    const actor = { id: 'teacher-1', role: 'TEACHER' as const };
    const binding = {
      citationId: 'textbook-v2:unit:section-1',
      sourceVersionId: 'textbook-v2:book-1:8:revision-1',
      anchor: 'section-1',
      contentHash: 'c'.repeat(64),
      sourceKind: 'textbook' as const,
      title: '稳定性判据',
      structuralPath: ['chapter-1', 'section-1'],
      snippet: '稳定性判据的教材依据',
      href: '/textbooks/book-1/section-1',
    };
    mocks.textbookBindings.mockResolvedValue([binding]);
    const plan = validPlanFixture();
    plan.sources = [binding];
    plan.knowledgePoints[0].sourceBindings = [binding];
    for (const stage of Object.values(plan.boppps)) stage.steps[0].sourceBindings = [binding];
    const task = {
      id: 'task-1',
      ownerId: actor.id,
      courseBasisId: 'basis-1',
      revision: 1,
      durationMinutes: 30,
      topic: '闭环稳定性',
      audience: '自动化专业本科生',
      prerequisites: '复数与传递函数',
      aggregateClassContextRef: null,
      textbookRanges: [{
        bookId: 'book-1',
        level: 'SECTION',
        unitId: 'section-1',
        structuralPath: ['chapter-1', 'section-1'],
      }],
      courseBasis: { title: '自动控制原理' },
      sources: [{ sourceVersionId: 'version-1' }],
      knowledgePoints: [{
        id: 'kp-1',
        title: '稳定性判据',
        sourceState: 'VERIFIED',
        sourceBindings: [binding],
        gapIdentity: null,
      }],
      goals: [{
        id: 'goal-1',
        content: '判断闭环系统稳定性',
        sourceState: 'AI_GENERATED_SOURCE_PENDING',
        sourceBindings: [],
        gapIdentity: `smart-goal-gap:${'b'.repeat(64)}`,
      }],
    };
    const draft: Record<string, any> = {
      id: 'draft-1',
      ownerId: actor.id,
      taskId: task.id,
      state: 'READY',
      version: 1,
      content: null,
      contentHash: null,
      task,
      jobs: [],
    };
    const createRevision = vi.fn(async ({ data }) => ({ id: 'revision-1', ...data }));
    const draftStore = {
      findFirst: vi.fn(async () => draft),
      updateMany: vi.fn(async ({ data }) => {
        Object.assign(draft, data, { version: draft.version + 1 });
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => draft),
      update: vi.fn(async ({ data }) => {
        Object.assign(draft, data);
        return draft;
      }),
    };
    const tx = {
      smartLessonDraft: draftStore,
      smartLessonGenerationJob: { updateMany: vi.fn(async () => ({ count: 0 })) },
      smartLessonRevision: { findFirst: vi.fn(async () => null), create: createRevision },
      courseBasisProjection: { findMany: vi.fn(async () => []) },
    };
    const db = {
      smartLessonDraft: draftStore,
      smartLessonRevision: { findFirst: vi.fn(async () => null) },
      courseBasisProjection: tx.courseBasisProjection,
      $transaction: vi.fn(async (operation) => operation(tx)),
    };

    expect(deriveSmartLessonSourceState(
      'SUGGESTED',
      'AI_GENERATED_SOURCE_PENDING',
      [binding],
      new Set([sourceBindingEvidenceKey(binding)]),
    )).toBe('VERIFIED');
    const forgedBindings = [
      { ...binding, sourceKind: 'upload' as const },
      { ...binding, title: '被改写的标题' },
      { ...binding, structuralPath: ['chapter-9', 'section-9'] },
      { ...binding, snippet: '被改写的教材摘录' },
      { ...binding, href: '/textbooks/book-1/forged' },
      { ...binding, citationId: 'textbook-v2:unit:forged' },
      { ...binding, anchor: 'forged-anchor' },
      { ...binding, contentHash: 'f'.repeat(64) },
    ];
    for (const forgedBinding of forgedBindings) {
      const forged = structuredClone(plan);
      forged.sources[0] = forgedBinding;
      await expect(updateSmartLessonDraft(db as never, {
        actor,
        draftId: draft.id,
        expectedVersion: 1,
        content: forged,
      })).rejects.toMatchObject({ code: 'plan-source-binding-unverified' });
    }
    const wrongVersion = structuredClone(plan);
    wrongVersion.sources[0] = { ...binding, sourceVersionId: 'textbook-v2:book-1:8:forged' };
    await expect(updateSmartLessonDraft(db as never, {
      actor,
      draftId: draft.id,
      expectedVersion: 1,
      content: wrongVersion,
    })).rejects.toMatchObject({ code: 'plan-source-not-selected' });
    await expect(updateSmartLessonDraft(db as never, {
      actor,
      draftId: draft.id,
      expectedVersion: 1,
      content: plan,
    })).resolves.toMatchObject({ contentHash: contentHash(plan) });
    await expect(approveSmartLessonDraft(db as never, {
      actor,
      draftId: draft.id,
      idempotencyKey: 'approve-textbook-001',
    })).resolves.toMatchObject({ id: 'revision-1' });
    expect(createRevision).toHaveBeenCalledTimes(1);
    expect(mocks.adopt).not.toHaveBeenCalled();
  });
});
