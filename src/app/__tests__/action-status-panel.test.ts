import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState, type AuditedActionIdentity } from '@/lib/action-status-contract';

const identity: AuditedActionIdentity = {
  id: 'approve-1',
  category: 'approve',
  label: '审批报告',
  sourceRoute: '/teacher/grading',
};

describe('ActionStatusPanel', () => {
  it('renders successful action state as polite status region', () => {
    const html = renderToStaticMarkup(
      createElement(ActionStatusPanel, {
        state: createAuditedActionState({
          identity,
          status: 'succeeded',
          message: '审批已写回。',
          nextAction: '查看学生报告',
        }),
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-audited-action-status="succeeded"');
    expect(html).toContain('审批已写回');
    expect(html).toContain('下一步：查看学生报告');
  });

  it('renders failed action state as assertive alert region with recovery', () => {
    const html = renderToStaticMarkup(
      createElement(ActionStatusPanel, {
        state: createAuditedActionState({
          identity,
          status: 'failed',
          message: '审批失败。',
          recoveryAction: '检查评分草稿后重试',
          displayReference: 'run-1',
          recoveryKind: 'missing-object',
        }),
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('data-audited-action-category="approve"');
    expect(html).toContain('data-platform-recovery-kind="missing-object"');
    expect(html).toContain('引用：run-1');
    expect(html).toContain('恢复：检查评分草稿后重试');
  });
});
