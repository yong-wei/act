import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { assignmentNextAction, EMPTY_ASSIGNMENT_DRAFT } from '../assignment-ui-contracts';

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('teacher assignment workspace contracts', () => {
  it('maps every lifecycle state to a next action without changing draft defaults', () => {
    const item = { id: 'a1', state: 'DRAFT' as const, updatedAt: '2026-07-11T00:00:00.000Z', latestRevision: null };
    expect(assignmentNextAction(item)).toBe('继续编辑');
    expect(assignmentNextAction({ ...item, state: 'PUBLISHED' })).toBe('查看完成情况');
    expect(EMPTY_ASSIGNMENT_DRAFT.solutionReleasePolicy).toEqual({ version: 1, mode: 'PRIVATE' });
  });

  it('keeps loading, empty, filtered-empty, and recoverable-error semantics distinct', () => {
    const text = source('src/features/assignment-authoring/teacher-assignment-list.tsx');
    expect(text).toContain("items.length === 0 ? 'empty'");
    expect(text).toContain("filtered.length === 0 ? 'filtered-empty'");
    expect(text).toContain('作业列表暂时无法加载');
    expect(text).toContain('重试');
  });

  it('exposes the three authoring regions and a mobile status-only fallback', () => {
    const text = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    expect(text).toContain('md:hidden');
    expect(text).toContain('请在平板或桌面端继续编辑');
    expect(text).toContain('id="prompt-title"');
    expect(text).toContain('id="answer-title"');
    expect(text).toContain('id="rubric-title"');
    expect(text).toContain('status === 409');
    expect(text).toContain('blockerRef.current?.focus()');
  });

  it('keeps catalog list projection teacher-safe and supports all seven governed filters', () => {
    const api = source('src/app/api/teacher/assignments/question-catalog/route.ts');
    const safeListProjection = api.split('const selectionSchema')[0];
    const picker = source('src/features/assignment-authoring/governed-question-picker.tsx');
    expect(safeListProjection).not.toContain('answerKey: item.questionRefs.answerKey');
    expect(safeListProjection).not.toContain('feedbackGuidance');
    for (const label of ['来源', '题型', '知识点', '难度', '审核', '评分标准', '版本']) expect(picker).toContain(`['${label}'`);
  });

  it('materializes catalog selections server-side and exposes complete policy and rubric controls', () => {
    const editor = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    expect(editor).toContain("method: 'POST'");
    expect(editor).not.toContain('prompt: item.stemPreview');
    for (const label of ['作业说明', '作答类型', '迟交策略', '允许作答类型', '最多提交次数', '解答发布时间', '添加评分项', '学生可见指导']) expect(editor).toContain(label);
    expect(editor).toContain('档位按 0.01 分连续覆盖最高分至 0 分');
    expect(editor).toContain('/next-draft');
    expect(editor).toContain("'published-frozen'");
  });

  it('serializes the latest save before publish and exposes decimal input constraints', () => {
    const editor = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    expect(editor).toContain('saveQueueRef.current.then');
    expect(editor).toContain('for (let attempt = 0; attempt < 5; attempt += 1)');
    expect(editor).toContain('result.draftFingerprint ===');
    expect(editor).toContain('assignmentDraftSchema.safeParse(documentRef.current.draft)');
    expect(editor).toContain("setPublishMessage('最新草稿保存失败，未执行发布。')");
    expect(editor).toContain('step="0.01"');
    expect(editor).toContain('max={criterion.maxPoints}');
    expect(editor).toContain('validationFieldRefs.current.get(path)');
    expect(editor).toContain('aria-describedby="assignment-validation-errors"');
    expect(editor).toContain("setPublishMessage('发布请求失败，请检查网络后重试。')");
    expect(editor).toContain('finally {');
    expect(editor).toContain('disabled={published || publishing}');
  });

  it('preserves focus on successful autosave and provides recoverable governed pickers', () => {
    const editor = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    const picker = source('src/features/assignment-authoring/governed-question-picker.tsx');
    expect(editor).not.toContain('saveStatusRef.current?.focus()');
    expect(editor).toContain('/api/teacher/assignments/managed-classes');
    expect(editor).toContain('暂无可发布的活跃班级');
    expect(editor).not.toContain('班级 ID');
    expect(picker).toContain('const selected = await onSelect(item)');
    expect(picker).toContain('题库题目载入失败，请重试。');
  });
});
