import { describe, expect, it } from 'vitest';

import {
  buildStandaloneCopilotEntryPresentation,
  resolveStandaloneCopilotEntryKind,
} from '@/lib/standalone-copilot-entry';

const MARITIME_CANARIES = [
  '请获取当前的仿真状态',
  '指导 PID',
  '诺莫托',
  'CCS 规范',
  '航迹误差',
  '海况',
  '船舶控制',
  '查看和分析仿真器状态',
] as const;

function flatten(presentation: ReturnType<typeof buildStandaloneCopilotEntryPresentation>): string {
  return [
    presentation.kind,
    presentation.description,
    ...presentation.capabilities,
    ...presentation.suggestions.flatMap((item) => [item.label, item.question]),
    presentation.placeholder,
    presentation.inputAriaLabel,
    ...presentation.limitations,
    ...presentation.adjacentActions.flatMap((item) => [item.href, item.label]),
  ].join('\n');
}

describe('standalone Copilot entry presentation', () => {
  it.each([
    { context: null, evidenceUnavailable: false, evidenceStatus: null, kind: 'neutral' },
    { context: 'ship-pid', evidenceUnavailable: false, evidenceStatus: null, kind: 'neutral' },
    { context: 'portfolio-reflection', evidenceUnavailable: false, evidenceStatus: null, kind: 'portfolio-reflection' },
    { context: 'evidence', evidenceUnavailable: false, evidenceStatus: 'available', kind: 'evidence-available' },
    { context: 'evidence', evidenceUnavailable: false, evidenceStatus: 'missing', kind: 'evidence-missing' },
    { context: 'evidence', evidenceUnavailable: false, evidenceStatus: null, kind: 'evidence-pending' },
    { context: 'evidence', evidenceUnavailable: false, evidenceStatus: 'partial', kind: 'evidence-limited' },
    { context: 'evidence', evidenceUnavailable: false, evidenceStatus: 'stale', kind: 'evidence-limited' },
    { context: 'evidence', evidenceUnavailable: true, evidenceStatus: 'available', kind: 'evidence-unavailable' },
  ] as const)('maps $context / unavailable=$evidenceUnavailable / $evidenceStatus to $kind', (input) => {
    expect(resolveStandaloneCopilotEntryKind(input)).toBe(input.kind);
  });

  it('keeps the unregistered URL text out of the neutral projection', () => {
    const presentation = buildStandaloneCopilotEntryPresentation({
      context: 'ship-pid-and-ccs-review',
    });
    const text = flatten(presentation);
    expect(presentation.kind).toBe('neutral');
    expect(text).not.toContain('ship-pid-and-ccs-review');
    expect(presentation.limitations).toContain('当前没有绑定具体课程步骤、仿真状态或个人证据。');
    expect(presentation.suggestions.some((item) => item.question.includes('不要假设我正在做仿真'))).toBe(true);
    for (const canary of MARITIME_CANARIES) {
      expect(text).not.toContain(canary);
    }
  });

  it('preserves portfolio-reflection draft questions and explicit save boundary', () => {
    const presentation = buildStandaloneCopilotEntryPresentation({
      context: 'portfolio-reflection',
      portfolioHref: '/profile/portfolio?category=reflection&intent=create&source=learning-journal',
    });
    expect(presentation.kind).toBe('portfolio-reflection');
    expect(presentation.suggestions.map((item) => item.question)).toEqual([
      '请把本次 AI 协作的任务目标和输出对象整理成反思草稿。',
      '请列出本次 AI 建议中仍需要我验证的疑问。',
      '请把下一步验证行动写成作品集反思候选。',
    ]);
    expect(presentation.limitations.some((item) => item.includes('显式保存'))).toBe(true);
    expect(presentation.adjacentActions[0]?.href).toContain('/profile/portfolio');
    expect(MARITIME_CANARIES.some((canary) => flatten(presentation).includes(canary))).toBe(false);
  });

  it('uses authorized evidence next action and does not invent evidence when missing', () => {
    const presentation = buildStandaloneCopilotEntryPresentation({
      context: 'evidence',
      evidenceStatus: 'missing',
      evidenceLimitations: ['当前没有可核验的学习证据。'],
      evidenceNextAction: {
        href: '/assessment/adaptive-practice?intent=practice',
        label: '去做一次自适应练习，补充学习证据',
      },
    });
    expect(presentation.kind).toBe('evidence-missing');
    expect(flatten(presentation)).not.toContain('仿真');
    expect(presentation.adjacentActions).toEqual([
      {
        href: '/assessment/adaptive-practice?intent=practice',
        label: '去做一次自适应练习，补充学习证据',
      },
    ]);
    expect(presentation.suggestions.every((item) => !item.question.includes('当前证据摘要'))).toBe(true);
  });

  it.each(['pending', 'partial', 'stale'] as const)(
    'does not advertise weak-target diagnosis while evidence is %s',
    (state) => {
      const presentation = buildStandaloneCopilotEntryPresentation({
        context: 'evidence',
        evidenceStatus: state === 'pending' ? null : state,
        evidenceLimitations: state === 'pending' ? undefined : [`学习证据${state === 'stale' ? '已过期' : '不完整'}。`],
      });
      expect(presentation.kind).toBe(state === 'pending' ? 'evidence-pending' : 'evidence-limited');
      const text = flatten(presentation);
      expect(presentation.suggestions.map((item) => item.label)).not.toContain('薄弱点');
      expect(text).not.toContain('当前证据摘要');
      expect(presentation.suggestions.every((item) => item.question.includes('证据限制'))).toBe(true);
    },
  );

  it('keeps available evidence questions and forbids simulation claims', () => {
    const presentation = buildStandaloneCopilotEntryPresentation({
      context: 'evidence',
      evidenceStatus: 'available',
      evidenceLimitations: ['当前证据置信度较低，建议仅作参考。'],
    });
    expect(presentation.suggestions[0]?.question).toBe('请先说明当前证据来源，再给出下一步练习建议。');
    expect(MARITIME_CANARIES.some((canary) => flatten(presentation).includes(canary))).toBe(false);
  });
});
