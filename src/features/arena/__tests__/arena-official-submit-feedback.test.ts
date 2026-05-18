import { describe, expect, it } from 'vitest';

import {
  buildOfficialSubmissionMetricRows,
  buildOfficialSubmissionScoreSummary,
  sanitizeOfficialEvaluationExplanation,
} from '../../interactive/multi-representation-linkage/arena-submit-panel';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { MetricDefinition } from '../types';

const rankingMetrics: MetricDefinition[] = [
  {
    id: 'settlingTime',
    label: '调节时间',
    direction: 'minimize',
    idealValue: 2.5,
    unacceptableValue: 8,
    unit: 's',
  },
  {
    id: 'overshoot',
    label: '超调量',
    direction: 'minimize',
    idealValue: 8,
    unacceptableValue: 30,
    unit: '%',
  },
  {
    id: 'steadyStateError',
    label: '稳态误差',
    direction: 'minimize',
    idealValue: 0.02,
    unacceptableValue: 0.08,
  },
];

function evaluation(overrides: Partial<ArenaEvaluationResult> = {}): ArenaEvaluationResult {
  return {
    taskId: 'task-second-order-lead-pid',
    artifact: {
      id: 'artifact-official-feedback',
      taskId: 'task-second-order-lead-pid',
      method: 'pid',
      params: { kp: 1, ki: 0, kd: 0 },
      createdAt: '2026-05-18T00:00:00.000Z',
    },
    valid: true,
    score: 0,
    metrics: {
      settlingTime: 9.2,
      overshoot: 12,
      steadyStateError: 0.01,
    },
    satisfaction: {
      settlingTime: 0,
      overshoot: 0.82,
      steadyStateError: 1,
    },
    hardConstraintResults: [
      { id: 'closed_loop_stable', label: '闭环稳定', passed: true },
      { id: 'finite_response', label: '响应有限', passed: true },
    ],
    penalties: [],
    explanation: [
      '硬约束全部通过，提交进入正式排名。',
      'template-whitebox-v1 uses deterministic template metrics.',
    ],
    ...overrides,
  };
}

describe('arena official submission feedback view model', () => {
  it('builds target actual and status rows for ranking metrics', () => {
    const rows = buildOfficialSubmissionMetricRows(evaluation(), rankingMetrics);

    expect(rows.map((row) => row.id)).toEqual(['settlingTime', 'overshoot', 'steadyStateError']);
    expect(rows[0]).toMatchObject({
      label: '调节时间',
      actualText: '9.200s',
      targetText: '目标 ≤ 2.500s',
      unacceptableText: '不可接受 ≥ 8.000s',
      status: 'failed',
      statusLabel: '未达标',
    });
    expect(rows[1]).toMatchObject({
      status: 'close',
      statusLabel: '接近目标',
    });
    expect(rows[2]).toMatchObject({
      status: 'reached',
      statusLabel: '已达标',
    });
  });

  it('explains valid zero score in Chinese without exposing raw English provider notes', () => {
    const result = evaluation();
    const summary = buildOfficialSubmissionScoreSummary(result, rankingMetrics, ['settlingTime', 'overshoot']);
    const explanation = sanitizeOfficialEvaluationExplanation(result, rankingMetrics, ['settlingTime', 'overshoot']);

    expect(summary).toMatchObject({
      hardConstraintLabel: '硬约束已通过',
      finalScore: 0,
      penaltyScore: 0,
    });
    expect(summary.baseScore).toBe(0);
    expect(explanation.join('\n')).toContain('硬约束已通过');
    expect(explanation.join('\n')).toContain('调节时间');
    expect(explanation.join('\n')).toContain('排名分为 0');
    expect(explanation.join('\n')).not.toContain('template-whitebox-v1');
    expect(explanation.join('\n')).not.toContain('deterministic template metrics');
  });
});
