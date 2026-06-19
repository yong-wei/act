import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { INTERACTIVE_MODULE_VISUAL_STANDARDS } from '@/features/interactive/shared/manifest-runtime/module-visual-standards';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

describe('interactive commercial module chrome', () => {
  it('wraps standard renderer modules in commercial module chrome', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '渲染模块商业壳测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'compute-workspace',
              kind: 'compute.panel',
              region: 'main',
              must_be_visible: true,
              payload: { compute_ref: 'fixture' },
            },
          ],
          content_blocks: {},
          interaction_spec: {},
          ai_context_spec: { page_goal: '检查 renderer 模块商业壳。' },
        },
      },
      step_order: ['step-01'],
    });
    if (!manifest) throw new Error('expected test manifest to normalize');

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: manifest.steps[0]!,
        moduleRegistry: {
          'compute.panel': () => createElement('div', { 'data-fixture-compute-panel': 'true' }, 'compute panel'),
        },
        extra: undefined,
      }),
    );

    expect(html).toContain('data-commercial-module-chrome="compute.panel"');
    expect(html).toContain('data-commercial-module-state="required"');
    expect(html).toContain('data-fixture-compute-panel="true"');
    expect(html).toContain('data-interactive-module-standard-class="compute.panel"');
    expect(html).toContain('data-interactive-module-chrome-category="interaction"');
    expect(html).toContain('data-interactive-module-teacher-controls="module"');
    expect(html).toContain('data-interactive-module-control-scope="compute-workspace"');
    expect(html).toContain('data-interactive-module-projection-safe="true"');
    expect(html).toContain('data-interactive-module-geometry="stable-panel"');
    expect(html).toContain('commercial-module-chrome--compute');
  });

  it('keeps teacher controls scoped to each visible interaction module', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '多互动模块控件绑定测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'choice-check',
              kind: 'compute.panel',
              region: 'main',
              must_be_visible: true,
              payload: { compute_ref: 'choice' },
            },
            {
              id: 'ordering-check',
              kind: 'visual.stage',
              region: 'main',
              must_be_visible: true,
              payload: { stage_id: 'ordering' },
            },
          ],
          content_blocks: {},
          interaction_spec: {},
          ai_context_spec: { page_goal: '检查教师控件绑定。' },
        },
      },
      step_order: ['step-01'],
    });
    if (!manifest) throw new Error('expected test manifest to normalize');

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: manifest.steps[0]!,
        moduleRegistry: {
          'compute.panel': () => createElement('div', { 'data-fixture-compute-panel': 'true' }, 'compute panel'),
          'visual.stage': () => createElement('div', { 'data-fixture-visual-stage': 'true' }, 'visual stage'),
        },
        extra: undefined,
      }),
    );

    expect(html).toContain('data-interactive-module-control-scope="choice-check"');
    expect(html).toContain('data-interactive-module-control-scope="ordering-check"');
  });

  it('wraps required invalid-state fallbacks in shared module chrome', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: 'test-lesson',
      steps: {
        'step-01': {
          title: '缺失 renderer 状态测试',
          layout: {
            template: 'stacked_regions',
            regions: [{ id: 'main', width: 'full', order: 1 }],
          },
          modules: [
            {
              id: 'missing-renderer-content',
              kind: 'content.rich',
              region: 'main',
              must_be_visible: true,
              title: '必须可见内容',
            },
          ],
          content_blocks: {},
          interaction_spec: {},
          ai_context_spec: { page_goal: '检查缺失 renderer 时仍有共享外壳。' },
        },
      },
      step_order: ['step-01'],
    });
    if (!manifest) throw new Error('expected test manifest to normalize');

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest,
        step: manifest.steps[0]!,
        moduleRegistry: {},
        extra: undefined,
      }),
    );

    expect(html).toContain('data-manifest-render-error="step-01:missing-renderer-content"');
    expect(html).toContain('data-commercial-module-chrome="content.rich"');
    expect(html).toContain('data-interactive-module-standard-class="content.rich"');
    expect(html).toContain('data-interactive-module-projection-safe="true"');
    expect(html).toContain('commercial-module-chrome--content');
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
    if (!manifest) throw new Error('expected test manifest to normalize');

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

  it('defines shared CSS for every emitted commercial module chrome class', () => {
    const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const emittedClasses = new Set([
      'commercial-module-chrome',
      'commercial-module-chrome--stable-panel',
      'commercial-module-chrome--projection-readable',
      ...Object.values(INTERACTIVE_MODULE_VISUAL_STANDARDS).map((standard) => standard.chromeClassName),
    ]);

    for (const className of emittedClasses) {
      expect(globalsCss).toContain(`.${className}`);
    }

    expect(globalsCss).toContain('.commercial-module-chrome--visual-block-diagram,');
    expect(globalsCss).toContain('.commercial-module-chrome--visual-signal-flow-graph {');
    expect(globalsCss).toContain('@apply border-0 bg-transparent p-0 shadow-none;');
    expect(globalsCss).toContain('backdrop-filter: none;');
    expect(globalsCss).toContain('.commercial-module-chrome--visual-block-diagram[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('@apply border-l-0;');
  });
});
