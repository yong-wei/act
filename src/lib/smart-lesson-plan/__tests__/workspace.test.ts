import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildSmartTaskUpdateInput,
  SMART_JOB_ACTIVE_STATES,
  SMART_JOB_EDIT_BLOCKING_STATES,
  SMART_JOB_RECOVERY_STATES,
  SMART_PREPARATION_STAGE_ORDER,
  smartDraftStateLabel,
  smartGenerationStageLabel,
  smartGenerationStateLabel,
  smartPreparationStatusLabel,
} from '../index';

const publicTask = {
  courseBasisId: 'basis-1',
  topic: '闭环控制',
  audience: '本科生',
  durationMinutes: 45,
  selectedClassId: 'class-9',
  sources: [
    { sourceVersionId: 'v-1', state: 'SELECTED' },
    { sourceVersionId: 'v-2', state: 'RETIRED' },
  ],
  knowledgePoints: [
    { id: 'kp-1', lineageId: 'ln-1', title: '稳定性', origin: 'TEACHER_CREATED' as const, sourceState: 'verified', sourceBindings: [], state: 'CONFIRMED' },
    { id: 'kp-2', lineageId: 'ln-2', title: '已删除点', origin: 'SUGGESTED' as const, sourceState: 'verified', sourceBindings: [], state: 'REMOVED' },
  ],
  goals: [
    { id: 'g-1', lineageId: 'lg-1', content: '能判断稳定性', sourceState: 'verified', sourceBindings: [], state: 'CONFIRMED' },
  ],
};

describe('smart-lesson-plan workspace projection owners', () => {
  it('keeps the five-stage order as the single stage identity list', () => {
    expect([...SMART_PREPARATION_STAGE_ORDER]).toEqual([
      'course-basis',
      'topic-goals',
      'class-attainment',
      'lesson-generation',
      'courseware-generation',
    ]);
  });

  it('keeps job state sets disjoint by intent', () => {
    expect([...SMART_JOB_ACTIVE_STATES]).toEqual(['QUEUED', 'RUNNING']);
    expect([...SMART_JOB_RECOVERY_STATES]).toEqual(['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED']);
    expect([...SMART_JOB_EDIT_BLOCKING_STATES]).toEqual(['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE']);
  });

  it('preserves the historical label semantics verbatim', () => {
    expect(smartDraftStateLabel('READY')).toBe('待审核');
    expect(smartDraftStateLabel(undefined)).toBe('未创建');
    expect(smartGenerationStateLabel('PENDING')).toBe('等待处理');
    expect(smartGenerationStateLabel('COMPLETED')).toBe('已完成');
    expect(smartGenerationStateLabel('UNKNOWN')).toBe('状态不可用');
    expect(smartGenerationStageLabel('OUTLINE')).toBe('提纲');
    expect(smartGenerationStageLabel('NOPE')).toBe('未知阶段');
    expect(smartPreparationStatusLabel(null)).toBe('尚未开始');
  });

  it('rebuilds the update input from a public task projection without removed or retired identities', () => {
    const input = buildSmartTaskUpdateInput(publicTask);
    expect(input.courseBasisId).toBe('basis-1');
    expect(input.sourceVersionIds).toEqual(['v-1']);
    expect(input.knowledgePoints.map((item) => item.id)).toEqual(['kp-1']);
    expect(input.knowledgePoints[0]).toEqual(expect.objectContaining({
      lineageId: 'ln-1',
      content: '稳定性',
      supersedesIds: [],
      gapReason: null,
    }));
    expect(input.goals.map((item) => item.id)).toEqual(['g-1']);
    expect(input.confirmScope).toBe(true);
    expect(input.confirmGoals).toBe(true);
  });

  it('fills defaults for optional projection fields', () => {
    const input = buildSmartTaskUpdateInput({
      courseBasisId: 'basis-2',
      topic: '根轨迹',
      audience: '研究生',
      durationMinutes: 90,
    });
    expect(input.prerequisites).toBe('');
    expect(input.selectedClassId).toBeNull();
    expect(input.textbookRanges).toEqual([]);
    expect(input.sourceVersionIds).toEqual([]);
    expect(input.knowledgePoints).toEqual([]);
    expect(input.goals).toEqual([]);
  });

  it('rejects stale task responses so delayed polls cannot roll back a newer revision', () => {
    const workspaceSource = readFileSync(
      join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
      'utf8',
    );
    // 所有 setTasks 替换路径必须经 revision 单调合并，不允许无条件整表覆盖。
    expect(workspaceSource).toContain('function mergeTasksByIdentity(');
    expect(workspaceSource).toContain('function acceptFresherTask(');
    expect(workspaceSource).not.toContain('setTasks(payload.tasks);');
    expect(workspaceSource).not.toContain('? payload.task : task)');
    expect(workspaceSource).not.toContain('? taskPayload.task : task)');
  });

  it('keeps the fresher task identity when merging by task id', () => {
    const workspaceSource = readFileSync(
      join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
      'utf8',
    );
    expect(workspaceSource).toContain('taskRevisionOf(incoming) >= taskRevisionOf(current) ? incoming : current');
  });

  it('keeps the workspace component free of duplicate label, set and input rebuilding code', () => {
    const workspaceSource = readFileSync(
      join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
      'utf8',
    );
    expect(workspaceSource).not.toContain('function taskUpdateInput(');
    expect(workspaceSource).not.toContain('function draftStateLabel(');
    expect(workspaceSource).not.toContain('function generationStateLabel(');
    expect(workspaceSource).not.toContain('function generationStageLabel(');
    expect(workspaceSource).not.toContain('=== 5 ?');
    expect(workspaceSource).toContain('buildSmartTaskUpdateInput(task)');
    expect(workspaceSource).toContain('SMART_PREPARATION_STAGE_ORDER.length');
    // BOPPPS stage labels reuse the preparation editor model instead of a local copy.
    expect(workspaceSource).toContain('Object.fromEntries(BOPPPS_STAGES)');
  });
});
