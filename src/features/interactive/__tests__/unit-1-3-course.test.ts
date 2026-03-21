import { describe, expect, it } from 'vitest';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { UNIT_1_3_LESSON_STEPS, getUNIT_1_3MediaSrc } from '@/lib/unit-1-3-course';

describe('unit 1-3 interactive course', () => {
  it('registers the 1-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-1-3-time-domain-response-v1'];

    expect(registry).toBeDefined();
    expect(registry.courseMeta.courseTitle).toContain('时域响应分析');
  });

  it('defines the full 17-step lesson flow', () => {
    expect(UNIT_1_3_LESSON_STEPS).toHaveLength(17);
    expect(UNIT_1_3_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_1_3_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('exposes AI quick questions for the AI comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-1-3-time-domain-response-v1', 'step-14');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('约束');
  });

  it('maps runtime media for representative time-domain steps', () => {
    expect(getUNIT_1_3MediaSrc('step-06')).toContain('td-02-first-order-step-time-constant.svg');
    expect(getUNIT_1_3MediaSrc('step-15')).toContain('td-06-time-spec-to-pole-region.svg');
  });

  it('keeps the first-order anchor ratio fixed at 63.2% when t equals T', async () => {
    const { calculateFirstOrderAnchorRatio } = await import('@/features/interactive/unit-1-3-time-response/time-response-math');

    expect(calculateFirstOrderAnchorRatio(1.2)).toBeCloseTo(63.2, 1);
    expect(calculateFirstOrderAnchorRatio(3.4)).toBeCloseTo(63.2, 1);
  });

  it('marks the enhanced workspaces for step-07, step-09, and step-13', () => {
    expect(UNIT_1_3_LESSON_STEPS.find((step) => step.id === 'step-07')?.workspaceKind).toBe('second-order-parameter-map');
    expect(UNIT_1_3_LESSON_STEPS.find((step) => step.id === 'step-09')?.workspaceKind).toBe('metric-overview');
    expect(UNIT_1_3_LESSON_STEPS.find((step) => step.id === 'step-13')?.workspaceKind).toBe('worked-example');
  });

  it('defines the second-order parameter mapping cards and metric callouts', async () => {
    const { SECOND_ORDER_PARAMETER_CARDS, TIME_DOMAIN_METRIC_CALLOUTS, WORKED_EXAMPLE_SEQUENCE } = await import(
      '@/features/interactive/unit-1-3-time-response/workspace'
    );

    expect(SECOND_ORDER_PARAMETER_CARDS.map((card) => card.key)).toEqual(['wn', 'zeta', 'wd']);
    expect(SECOND_ORDER_PARAMETER_CARDS.every((card) => card.formula.length > 0 && card.phenomenon.length > 0)).toBe(true);

    expect(TIME_DOMAIN_METRIC_CALLOUTS.map((item) => item.key)).toEqual(['tr', 'tp', 'mp', 'ts']);
    expect(TIME_DOMAIN_METRIC_CALLOUTS.every((item) => item.label.length > 0 && item.question.length > 0)).toBe(true);

    expect(WORKED_EXAMPLE_SEQUENCE.map((item) => item.key)).toEqual(['read', 'wd', 'metrics']);
    expect(WORKED_EXAMPLE_SEQUENCE[1]?.focus).toContain('wd');
  });

  it('solves a representative second-order example through wd before the four metrics', async () => {
    const { solveSecondOrderWorkedExample } = await import('@/features/interactive/unit-1-3-time-response/time-response-math');

    const result = solveSecondOrderWorkedExample({ wn: 4, zeta: 0.5, settlingBand: 2 });

    expect(result.wd).toBeCloseTo(3.464, 3);
    expect(result.tr).toBeCloseTo(0.605, 3);
    expect(result.tp).toBeCloseTo(0.907, 3);
    expect(result.mpPercent).toBeCloseTo(16.3, 1);
    expect(result.ts).toBeCloseTo(2, 3);
    expect(result.sequence).toEqual(['read', 'wd', 'metrics']);
  });
});
