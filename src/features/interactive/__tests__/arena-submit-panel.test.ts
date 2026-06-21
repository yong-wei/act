import { describe, expect, it } from 'vitest';

import { sanitizeOfficialEvaluationExplanation } from '../multi-representation-linkage/arena-submit-panel';

describe('arena submit panel official evaluation copy', () => {
  it('does not describe late invalid submissions as hard-constraint passing', () => {
    const lines = sanitizeOfficialEvaluationExplanation(
      {
        taskId: 'task-second-order-lead-pid',
        artifact: {
          id: 'artifact-1',
          taskId: 'task-second-order-lead-pid',
          method: 'pid',
          params: {},
          createdAt: '2026-06-21T00:00:00.000Z',
        },
        valid: false,
        score: 0,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: ['硬约束未全部通过，提交未进入正式排名。'],
      },
      [],
      [],
      true,
    );

    expect(lines[0]).toContain('硬约束未全部通过');
    expect(lines[0]).toContain('已超过截止时间');
    expect(lines.join('\n')).not.toContain('硬约束已通过');
  });
});
