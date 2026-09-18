import { describe, expect, it } from 'vitest';

import { excerptTextbookMarkdown } from '@/lib/textbook-preview';

describe('textbook preview helpers', () => {
  it('keeps the heading out of the excerpt and stops after a short preview', () => {
    const excerpt = excerptTextbookMarkdown([
      '# Lead ratio',
      '',
      'The lead ratio $\\alpha$ sets the zero-pole separation.',
      '',
      'A second paragraph should still appear.',
      '',
      'This trailing explanation is long enough that the preview can stop after the budget.',
      'It continues with more design commentary that learners will read in the full section.',
    ].join('\n'), { title: 'Lead ratio', maxChars: 80 });

    expect(excerpt.startsWith('# Lead ratio')).toBe(false);
    expect(excerpt).toContain('The lead ratio $\\alpha$ sets the zero-pole separation.');
    expect(excerpt.length).toBeLessThan(400);
  });
});
