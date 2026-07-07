import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TeacherDocumentGradingEmptyState } from '../document-rubric-grading-ui';
import {
  buildTeacherGradingRouteState,
  normalizeTeacherGradingRouteQuery,
} from '@/lib/teacher-report-grading-contracts';

describe('TeacherDocumentGradingEmptyState route state', () => {
  it('renders missing grading run as a recoverable blocked state', () => {
    const routeState = buildTeacherGradingRouteState(normalizeTeacherGradingRouteQuery({
      gradingRunId: 'missing-batch58',
      action: 'approve',
      returnTo: '/teacher/grading-workbench',
    }));

    const html = renderToStaticMarkup(TeacherDocumentGradingEmptyState({ routeState }));

    expect(html).toContain('data-audited-action-status="blocked"');
    expect(html).toContain('评分运行 missing-batch58 不存在或当前教师不可见');
    expect(html).toContain('返回报告账本或提交列表选择有效评分草稿');
  });
});
