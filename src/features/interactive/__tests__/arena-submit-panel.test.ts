import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sanitizeOfficialEvaluationExplanation } from '../multi-representation-linkage/arena-submit-panel';

describe('arena submit panel official evaluation copy', () => {
  it('keeps official submission separate from retryable path synchronization', () => {
    const source = readFileSync(join(
      process.cwd(),
      'src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx',
    ), 'utf8');

    expect(source).toContain('useArenaOfficialSubmissionPathSync');
    expect(source).toContain('await pathSync.synchronize(data.submission.id)');
    expect(source).toContain('pathSync.retry()');
    expect(source).toContain('重试同步路径');
  });

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
