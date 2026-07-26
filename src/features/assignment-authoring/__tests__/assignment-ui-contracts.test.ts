import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  applyGeneratedRubricGuidelines,
  assignmentNextAction,
  EMPTY_ASSIGNMENT_DRAFT,
} from '../assignment-ui-contracts';

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
    for (const label of ['作业说明', '统一作答', '迟交策略', '最多提交次数', '解答发布时间', '添加评分项', '学生可见指导']) expect(editor).toContain(label);
    expect(editor).toContain('所有分值保留一位小数');
    expect(editor).toContain('启用详细评分细则');
    expect(editor).toContain('五级制');
    expect(editor).toContain('两级制');
    expect(editor).toContain('/next-draft');
    expect(editor).toContain("'published-frozen'");
  });

  it('uses one student answer surface for Markdown and all supported attachments', () => {
    const student = source('src/features/assignments/student-assignment-workspace.tsx');
    expect(student).not.toContain("question.responseType === 'SUBJECTIVE_TEXT'");
    expect(student).not.toContain("question.responseType === 'SUBJECTIVE_FILE'");
    expect(student).toContain('Markdown 正文');
    expect(student).toContain('.pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg,.md,.markdown,.txt');
    expect(student).toContain('合计最多 10 个');
    expect(student).toContain("method: 'DELETE'");
    expect(student).toContain('提交前保存正文失败');
    expect(student).toContain('附件已从本题草稿中移除');
    expect(student).toContain('disabled={uploadDisabled}');
    expect(student).toMatch(
      /Math\.max\(\s*candidate\.version,\s*result\.answerVersion \?\? candidate\.version,\s*\)/,
    );
    expect(student).toMatch(
      /assets\.some\(\(asset\) =>\s*asset\.id === finalizedAsset\.id\)/,
    );
  });

  it('publishes only an explicit saved baseline and exposes decimal input constraints', () => {
    const editor = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    expect(editor).toContain('saveQueueRef.current.then');
    expect(editor).not.toContain('const result = await save()');
    expect(editor).toContain("if (saveState !== 'saved')");
    expect(editor).toContain('contentDigest: saved.contentDigest');
    expect(editor).toContain('assignmentDraftSchema.safeParse(documentRef.current.draft)');
    expect(editor).toContain('router.push(');
    expect(editor).toContain('step="0.01"');
    const totalScoreControl = editor.slice(
      editor.indexOf('作业总分'),
      editor.indexOf('发布班级'),
    );
    expect(totalScoreControl).toContain('step="0.1"');
    expect(totalScoreControl).toContain('min="0.1"');
    expect(editor).toContain('max={criterion.maxPoints}');
    expect(editor).toContain('validationFieldRefs.current.get(path)');
    expect(editor).toContain('aria-describedby="assignment-validation-errors"');
    expect(editor).toContain("setPublishMessage('发布请求失败，请检查网络后重试。')");
    expect(editor).toContain('finally {');
    expect(editor).toContain("disabled={published || publishing || saveState !== 'saved'}");
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

  it('atomically replaces only the generated guidelines for the exact current level set', () => {
    const question = {
      stableQuestionId: 'question-1',
      responseType: 'SUBJECTIVE_TEXT' as const,
      points: 10,
      prompt: '题面',
      referenceAnswer: '答案',
      rubric: {
        schemaVersion: 'assignment-scoring-rubric.v2' as const,
        criteria: [{
          id: 'criterion-1',
          label: '证据质量',
          goalDimension: 'engineeringDecision' as const,
          maxPoints: 10,
          scoringStandard: '依据证据评分。',
          detailedRubricEnabled: true,
          levels: [
            { id: 'high', label: '优秀', maxPoints: 10, guideline: '旧高档准则' },
            { id: 'low', label: '待改进', maxPoints: 5, guideline: '旧低档准则' },
          ],
        }],
      },
      source: {
        family: 'MANUAL' as const,
        authoringMarker: 'assignment-authoring' as const,
      },
    };
    const result = applyGeneratedRubricGuidelines(
      question,
      'criterion-1',
      [
        { levelId: 'low', guideline: '新低档准则' },
        { levelId: 'high', guideline: '新高档准则' },
      ],
    );
    expect(result?.rubric).toEqual({
      ...question.rubric,
      criteria: [{
        ...question.rubric.criteria[0],
        levels: [
          { ...question.rubric.criteria[0].levels[0], guideline: '新高档准则' },
          { ...question.rubric.criteria[0].levels[1], guideline: '新低档准则' },
        ],
      }],
    });
    expect(applyGeneratedRubricGuidelines(
      question,
      'criterion-1',
      [{ levelId: 'high', guideline: '不完整' }],
    )).toBeNull();
    expect(question.rubric.criteria[0].levels[0].guideline).toBe('旧高档准则');
  });

  it('exposes explicit fallback, overwrite cancellation, and dialog keyboard semantics', () => {
    const editor = source('src/features/assignment-authoring/assignment-editor-workspace.tsx');
    expect(editor).toContain('AI 填写全部准则');
    expect(editor).toContain('忽略评分标准，使用评分项名称');
    expect(editor).toContain('覆盖全部评分准则？');
    expect(editor).toContain('onClick={() => setRubricDialog(null)}');
    expect(editor).toContain("if (event.key === 'Escape') setRubricDialog(null)");
    expect(editor).toContain('aria-modal="true"');
    expect(editor).toContain('dialogPrimaryRef.current?.focus()');
    expect(editor).toContain('role="status"');
    expect(editor).toContain('const requestedCriterionFingerprint = canonicalFingerprint(savedCriterion)');
    expect(editor).toContain('canonicalFingerprint(latestCriterion) !== requestedCriterionFingerprint');
  });
});
