import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PersonalizedPathEffectPanel } from '@/features/teacher/personalized-path-effect-panel';
import type { PersonalizedPathEffectEvaluation } from '@/lib/personalized-path-effect-evaluation';

const evaluation: PersonalizedPathEffectEvaluation = {
  version: 'personalized-path-effect-evaluation.v1',
  classId: 'class-1',
  goalId: 'control-correction',
  evaluatedAt: '2026-08-28T00:00:00.000Z',
  evidenceWindow: { start: null, end: null },
  minSampleSize: 5,
  conclusion: 'insufficient-data',
  limitations: ['可信个性化或基准样本不足，不能给出个性化提升结论。'],
  cohorts: [
    { id: 'personalized', sampleSize: 1, limitations: [], metrics: [{ id: 'adoption', label: '路径采纳率', value: 1, numerator: 1, denominator: 1, sampleSize: 1 }] },
    { id: 'baseline', sampleSize: 0, limitations: [], metrics: [{ id: 'adoption', label: '路径采纳率', value: null, numerator: 0, denominator: 0, sampleSize: 0 }] },
    { id: 'insufficient', sampleSize: 2, limitations: [], metrics: [{ id: 'adoption', label: '路径采纳率', value: 0, numerator: 0, denominator: 2, sampleSize: 2 }] },
  ],
};

describe('PersonalizedPathEffectPanel', () => {
  it('renders insufficient-data without claiming a ranking', () => {
    const html = renderToStaticMarkup(<PersonalizedPathEffectPanel evaluation={evaluation} />);
    expect(html).toContain('数据不足，不给出提升结论');
    expect(html).not.toContain('最佳路径');
    expect(html).toContain('高置信个性化');
  });
});
