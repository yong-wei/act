import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ReviewControlWorkbenchReuse560 } from '@/app/review/control-workbench-reuse-560/review-client';

describe('control workbench issue 560 review route', () => {
  it('renders the embedded shared workbench and teacher diagnostics markers', () => {
    const html = renderToStaticMarkup(
      createElement(ReviewControlWorkbenchReuse560, {
        role: 'teacher',
        state: 'diagnostics',
        theme: 'dark',
      }),
    );

    expect(html).toContain('data-control-workbench-review="issue-560"');
    expect(html).toContain('data-control-workbench-capability="control-workbench"');
    expect(html).toContain('data-control-workbench-panel="time-domain"');
    expect(html).toContain('data-control-workbench-panel="root-locus"');
    expect(html).not.toContain('data-control-workbench-panel="nyquist"');
    expect(html).toContain('data-control-workbench-teacher-diagnostics="visible"');
  });
});
