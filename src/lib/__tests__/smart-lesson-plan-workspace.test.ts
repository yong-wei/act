import { describe, expect, it } from 'vitest';

import { projectSmartPreparationTask, smartPreparationStatusLabel } from '../smart-lesson-plan/workspace';

function taskFixture() {
  return {
    id: 'task-1',
    revision: 1,
    topic: '闭环稳定性',
    audience: '本科生',
    scopeConfirmedAt: '2026-07-25T00:00:00.000Z',
    goalsConfirmedAt: '2026-07-25T00:00:00.000Z',
    sources: [{ state: 'SELECTED', sourceVersionId: 'source-1' }],
    knowledgePoints: [{ state: 'CONFIRMED', title: '稳定性判据', sourceState: 'verified' }],
    goals: [{ state: 'CONFIRMED', content: '判断稳定性', sourceState: 'verified' }],
    drafts: [{ state: 'READY', content: { title: '教案', stages: [] }, jobs: [{ state: 'COMPLETED' }] }],
    revisions: [{ id: 'revision-1', taskRevision: 1, coursewareDrafts: [] }],
  };
}

describe('smart preparation task workspace projection', () => {
  it('derives five ordered stages and invalidates downstream completion from persisted facts', () => {
    const complete = projectSmartPreparationTask(taskFixture());
    expect(complete.stages.map((stage) => stage.title)).toEqual([
      '课程依据',
      '主题与目标',
      '班级学情',
      '生成与审核教案',
      '生成课件',
    ]);
    expect(complete.stages.slice(0, 4).every((stage) => stage.complete)).toBe(true);
    expect(complete.currentStage).toBe('courseware-generation');

    const stale = projectSmartPreparationTask({
      ...taskFixture(),
      goalsConfirmedAt: null,
    });
    expect(stale.stages[1]).toMatchObject({ complete: false, state: 'current' });
    expect(stale.stages[2]).toMatchObject({ complete: false, state: 'blocked' });
    expect(stale.stages[3]).toMatchObject({ complete: false, state: 'blocked' });

    const retiredSource = projectSmartPreparationTask({
      ...taskFixture(),
      sources: [{ state: 'SELECTED', sourceVersionId: 'source-1', sourceValid: false }],
    });
    expect(retiredSource.stages[0]).toMatchObject({ complete: false, state: 'current' });
    expect(retiredSource.stages[1]).toMatchObject({ complete: false, state: 'blocked' });
  });

  it('projects retryable legacy jobs and rejects unsupported payload presentation', () => {
    const projection = projectSmartPreparationTask({
      ...taskFixture(),
      drafts: [{
        state: 'EDITABLE',
        content: { legacy: true },
        jobs: [{ state: 'FAILED', supersededAt: null }],
      }],
      revisions: [],
    });
    expect(projection.resumable).toBe(true);
    expect(projection.unsupportedPayload).toBe(true);
    expect(projection.stages[3]).toMatchObject({
      state: 'unavailable',
      nextAction: '从首个未完成阶段恢复',
    });
  });

  it('keeps topic and goals incomplete until every source ambiguity or gap is governed', () => {
    const ambiguous = projectSmartPreparationTask({
      ...taskFixture(),
      knowledgePoints: [{
        state: 'CONFIRMED',
        title: '稳定性判据',
        sourceState: 'ai_generated_source_pending',
        sourceBindings: [{ citationId: 'a' }, { citationId: 'b' }],
      }],
    });
    expect(ambiguous.stages[1]).toMatchObject({ complete: false, state: 'current' });

    const unexplainedGap = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{ state: 'CONFIRMED', content: '判断稳定性', sourceState: 'teacher_created_source_pending' }],
    });
    expect(unexplainedGap.stages[1]).toMatchObject({ complete: false });

    const pendingWithReason = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{
        state: 'CONFIRMED',
        content: '判断稳定性',
        sourceState: 'teacher_created_source_pending',
        gapReason: '当前资源包没有可靠依据',
      }],
    });
    expect(pendingWithReason.stages[1]).toMatchObject({ complete: false });

    const ambiguousWithReason = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{
        state: 'CONFIRMED',
        content: '判断稳定性',
        sourceState: 'ai_generated_source_pending',
        sourceBindings: [{ citationId: 'a' }, { citationId: 'b' }],
        gapReason: '当前资源包没有可靠依据',
      }],
    });
    expect(ambiguousWithReason.stages[1]).toMatchObject({ complete: false });

    const missingReason = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{
        state: 'CONFIRMED',
        content: '判断稳定性',
        sourceState: 'no_reliable_source',
        sourceBindings: [],
      }],
    });
    expect(missingReason.stages[1]).toMatchObject({ complete: false });

    const noSourceWithBinding = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{
        state: 'CONFIRMED',
        content: '判断稳定性',
        sourceState: 'no_reliable_source',
        sourceBindings: [{ citationId: 'a' }],
        gapReason: '当前资源包没有可靠依据',
      }],
    });
    expect(noSourceWithBinding.stages[1]).toMatchObject({ complete: false });

    const governedGap = projectSmartPreparationTask({
      ...taskFixture(),
      goals: [{
        state: 'CONFIRMED',
        content: '判断稳定性',
        sourceState: 'no_reliable_source',
        sourceBindings: [],
        gapReason: '当前资源包没有可靠依据',
      }],
    });
    expect(governedGap.stages[1]).toMatchObject({ complete: true });
  });

  it('recognizes the persisted BOPPPS document shape as renderable', () => {
    const projection = projectSmartPreparationTask({
      ...taskFixture(),
      drafts: [{
        state: 'READY',
        content: { topic: '闭环稳定性', boppps: { summary: { teacherActivity: '归纳' } } },
        jobs: [{ state: 'COMPLETED' }],
      }],
    });
    expect(projection.unsupportedPayload).toBe(false);
  });

  it('invalidates approved lesson and courseware facts from an earlier task revision', () => {
    const stale = projectSmartPreparationTask({
      ...taskFixture(),
      revision: 2,
      revisions: [{
        id: 'revision-1',
        taskRevision: 1,
        coursewareDrafts: [{ state: 'ACCEPTED' }],
      }],
      coursewarePublicationSeries: {
        revisions: [{ id: 'publication-1', planRevisionId: 'revision-1' }],
      },
    });
    expect(stale.stages[3]).toMatchObject({ complete: false, state: 'current' });
    expect(stale.stages[4]).toMatchObject({ complete: false, state: 'blocked' });
  });

  it('recognizes accepted courseware only for the current task revision', () => {
    const accepted = projectSmartPreparationTask({
      ...taskFixture(),
      revisions: [{
        id: 'revision-1',
        taskRevision: 1,
        coursewareDrafts: [{ state: 'ACCEPTED' }],
      }],
    });
    expect(accepted.stages[4]).toMatchObject({ complete: true });
  });

  it('uses the shared Chinese presentation map without exposing raw enum values', () => {
    expect(smartPreparationStatusLabel('RUNNING')).toBe('正在生成');
    expect(smartPreparationStatusLabel('UNRECOGNIZED')).toBe('状态不可用');
  });
});
