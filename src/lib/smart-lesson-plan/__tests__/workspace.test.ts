import { describe, expect, it } from 'vitest';

import { projectSmartPreparationTask, smartPreparationStatusLabel } from '../workspace';

function taskFixture() {
  return {
    id: 'task-1',
    topic: '闭环稳定性',
    audience: '本科生',
    scopeConfirmedAt: '2026-07-25T00:00:00.000Z',
    goalsConfirmedAt: '2026-07-25T00:00:00.000Z',
    sources: [{ state: 'SELECTED', sourceVersionId: 'source-1' }],
    knowledgePoints: [{ state: 'CONFIRMED', title: '稳定性判据' }],
    goals: [{ state: 'CONFIRMED', content: '判断稳定性' }],
    drafts: [{ state: 'READY', content: { title: '教案', stages: [] }, jobs: [{ state: 'COMPLETED' }] }],
    revisions: [{ id: 'revision-1', coursewareDrafts: [] }],
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

  it('uses the shared Chinese presentation map without exposing raw enum values', () => {
    expect(smartPreparationStatusLabel('RUNNING')).toBe('正在生成');
    expect(smartPreparationStatusLabel('UNRECOGNIZED')).toBe('状态不可用');
  });
});
