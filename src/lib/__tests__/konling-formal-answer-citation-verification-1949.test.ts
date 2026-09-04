import { describe, expect, it, vi } from 'vitest';

import {
  buildKonlingCitationGuard,
  stripUnverifiedKonlingCitationMarkers,
  type KonlingRuntimeContext,
} from '@/lib/konling-agent-runtime';

vi.mock('server-only', () => ({}));

// 非 study-question 的正式回答：citationContext 内 #1 可绑定（verified 且有
// 目标），#2 未核验。数字碰撞到 #2 的占位标记必须被收集并剥离（#1949）。
function createCitationContext(): KonlingRuntimeContext['citationContext'] {
  return {
    required: true,
    contentCitations: [
      {
        id: 'content:evidence:primary',
        sourceType: 'content',
        displayTitle: '闭环控制教材片段',
        href: '/course-runtime/resources/closed-loop.md',
        confidence: 'high',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        citationTargetId: 'content:closed-loop',
        verified: true,
        resolver: 'course-runtime',
        displayNumber: 1,
      },
      {
        id: 'content:evidence:unverified',
        sourceType: 'content',
        displayTitle: '未验证材料',
        href: '/course-runtime/resources/unverified.md',
        confidence: 'medium',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        displayNumber: 2,
      },
    ],
    evidenceCitations: [],
    missingCitationClasses: [],
    lowConfidenceReasons: [],
    responseProtocol: {
      requiredOwners: ['answer'],
      minimum: { content: 1, evidenceWhenAvailable: 0 },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

function guardFor(answer: string) {
  return buildKonlingCitationGuard({ citationContext: createCitationContext() }, answer);
}

describe('issue #1949 formal answer citation verification', () => {
  it('collects unverified markers without a study-question contract', () => {
    const guard = guardFor('闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。');

    expect(guard.studyQuestion).toBeNull();
    expect(guard.unverifiedCitationMarkers).toEqual([2, 9]);
  });

  it('strips unverified and unassigned markers outside study questions', () => {
    const answer = '闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。';
    const guard = guardFor(answer);
    const stripped = stripUnverifiedKonlingCitationMarkers(answer, guard);

    expect(stripped).toContain('[1]');
    expect(stripped).not.toContain('[2]');
    expect(stripped).not.toContain('[9]');
    expect(stripped).toContain('占位结论');
    expect(stripped).toContain('越界引用');
  });

  it('keeps technical index expressions intact while stripping', () => {
    const answer = [
      '离散序列 y[2] 与 values[9] 保持下标。',
      '代码 `values[2]` 与：',
      '```ts',
      '[2]',
      '```',
      '占位结论 [2]。',
    ].join('\n');
    const guard = guardFor(answer);
    const stripped = stripUnverifiedKonlingCitationMarkers(answer, guard);

    expect(guard.unverifiedCitationMarkers).toEqual([2]);
    expect(stripped).toContain('y[2]');
    expect(stripped).toContain('values[9]');
    expect(stripped).toContain('`values[2]`');
    expect(stripped).toContain('```ts\n[2]\n```');
    expect(stripped).not.toMatch(/占位结论 \[2\]/);
  });

  it('is a no-op when the answer carries no invalid markers', () => {
    const answer = '闭环能抑制扰动 [1]。';
    const guard = guardFor(answer);

    expect(guard.unverifiedCitationMarkers).toEqual([]);
    expect(stripUnverifiedKonlingCitationMarkers(answer, guard)).toBe(answer);
  });
});
