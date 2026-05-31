import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

describe('interactive commercial module chrome', () => {
  it('wraps standard activity runtime modules in commercial module chrome', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '互动模块商业壳测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'activity-quiz',
              kind: 'quiz-card',
              region: 'main',
              must_be_visible: true,
              title: '课中判断',
            },
          ],
          content_blocks: {},
          interaction_spec: {},
          ai_context_spec: { page_goal: '检查 activity 模块商业壳。' },
        },
      },
      step_order: ['step-01'],
    });

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: manifest.steps[0]!,
        moduleRegistry: {},
        extra: undefined,
      }),
    );

    expect(html).toContain('data-commercial-module-chrome="quiz-card"');
    expect(html).toContain('data-commercial-module-state="required"');
    expect(html).toContain('data-manifest-activity-kind="quiz-card"');
  });

  it('keeps optional activity runtime modules out of layout regions', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '可选互动模块测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'activity-optional',
              kind: 'card-sort',
              region: 'main',
              must_be_visible: false,
              title: '可选排序',
            },
          ],
          content_blocks: {},
          interaction_spec: {},
          ai_context_spec: { page_goal: '检查可选 activity 模块仍不渲染。' },
        },
      },
      step_order: ['step-01'],
    });

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: manifest.steps[0]!,
        moduleRegistry: {
          unused: () => createElement('div', null, 'unused'),
        },
        extra: undefined,
      }),
    );

    expect(html).not.toContain('data-commercial-module-chrome="card-sort"');
    expect(html).not.toContain('data-manifest-activity-kind="card-sort"');
  });
});
