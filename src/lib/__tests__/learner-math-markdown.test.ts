import { describe, expect, it } from 'vitest';

import { toLearnerMathMarkdown } from '@/lib/learner-math-markdown';

describe('toLearnerMathMarkdown', () => {
  it('wraps a standalone formula so KaTeX can render it', () => {
    expect(toLearnerMathMarkdown(
      '\\alpha=\\frac{1-\\sin \\phi_{\\max }}{1+\\sin \\phi_{\\max }}',
    )).toBe('$\\alpha=\\frac{1-\\sin \\phi_{\\max }}{1+\\sin \\phi_{\\max }}$');
  });

  it('keeps Chinese prose as prose and only wraps latex runs', () => {
    expect(toLearnerMathMarkdown('最大相位超前频率')).toBe('最大相位超前频率');
    expect(toLearnerMathMarkdown('超前比 \\alpha 必须小于 1')).toBe('超前比 $\\alpha$ 必须小于 1');
  });

  it('does not double-wrap already delimited math', () => {
    expect(toLearnerMathMarkdown('$\\omega_m$')).toBe('$\\omega_m$');
  });
});
