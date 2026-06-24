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
    expect(html).toContain('data-interactive-module-chrome-role="metadata-only"');
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

    for (const className of [
      'commercial-module-chrome--visual-block-diagram',
      'commercial-module-chrome--visual-derivation-stage',
      'commercial-module-chrome--visual-stage',
      'commercial-module-chrome--visual-signal-flow-graph',
      'commercial-module-chrome--visual-annotated-media',
      'commercial-module-chrome--visual-embedded-activity',
      'commercial-module-chrome--media',
      'commercial-module-chrome--card-set',
      'commercial-module-chrome--content',
      'commercial-module-chrome--formula',
      'commercial-module-chrome--stage-map',
      'commercial-module-chrome--interaction',
      'commercial-module-chrome--workspace',
      'commercial-module-chrome--compute',
      'commercial-module-chrome--table',
      'commercial-module-chrome--code',
      'commercial-module-chrome--reveal',
      'commercial-module-chrome--teacher-summary',
    ]) {
      expect(globalsCss).toContain(`.${className}`);
    }
    expect(globalsCss).toContain('@apply border-0 bg-transparent p-0 shadow-none;');
    expect(globalsCss).toContain('display: contents;');
    expect(globalsCss).toContain('backdrop-filter: none;');
    expect(globalsCss).toContain('.commercial-module-chrome--visual-block-diagram[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('.commercial-module-chrome--visual-derivation-stage[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('.commercial-module-chrome--visual-stage[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('.commercial-module-chrome--media[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('.commercial-module-chrome--compute[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('.commercial-module-chrome--teacher-summary[data-interactive-module-teacher-controls="module"],');
    expect(globalsCss).toContain('@apply border-l-0;');
  });

  it('defines governed courseware typography and spacing primitives', () => {
    const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

    for (const className of [
      'interactive-courseware-stack',
      'interactive-courseware-region',
      'interactive-courseware-panel',
      'interactive-courseware-section',
      'interactive-courseware-toolbar',
      'interactive-courseware-title-level-1',
      'interactive-courseware-title-level-2',
      'interactive-courseware-title-level-3',
      'interactive-courseware-body',
      'interactive-courseware-caption',
      'interactive-courseware-control',
      'interactive-courseware-flow-arrow',
    ]) {
      expect(globalsCss).toContain(`.${className}`);
    }

    expect(globalsCss).toContain('@apply text-2xl font-semibold leading-9 tracking-normal;');
    expect(globalsCss).toContain('@apply text-[22px] font-semibold leading-8 tracking-normal;');
    expect(globalsCss).toContain('@apply text-xl font-semibold leading-[30px] tracking-normal;');
    expect(globalsCss).toContain('@apply text-base leading-7 md:text-lg md:leading-8;');
  });

  it('keeps manifest layout spacing and page title typography tokenized', () => {
    const layoutSource = readFileSync(
      join(process.cwd(), 'src/features/interactive/shared/manifest-runtime/layout-renderer.tsx'),
      'utf8',
    );

    expect(layoutSource).toContain('interactive-courseware-stack');
    expect(layoutSource).toContain('interactive-courseware-region');
    expect(layoutSource).toContain('interactive-courseware-title-level-1');
    expect(layoutSource).toContain('interactive-courseware-body');
    expect(layoutSource).not.toContain("className: 'space-y-4'");
    expect(layoutSource).not.toContain('text-2xl');
    expect(layoutSource).not.toContain('text-sm leading-7');
  });

  it('rejects shared runtime title, body and control primitive drift', () => {
    const files = [
      'src/features/interactive/shared/manifest-runtime/layout-renderer.tsx',
      'src/features/interactive/shared/manifest-runtime/content-renderers.tsx',
      'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx',
      'src/features/interactive/shared/manifest-runtime/static-surface-3d-panel.tsx',
    ];
    const source = files
      .map((file) => `\n/* ${file} */\n${readFileSync(join(process.cwd(), file), 'utf8')}`)
      .join('\n');

    expect(source).not.toMatch(/premium-lesson-panel interactive-courseware-panel space-y-4/);
    expect(source).not.toMatch(/premium-lesson-title[^"`']*text-(xs|sm|base|lg|xl|2xl)/);
    expect(source).not.toMatch(/premium-lesson-muted[^"`']*text-(xs|sm|base|lg|xl|2xl)/);
    expect(source).not.toMatch(/premium-lesson-action-(tone|primary)(?![^"`']*interactive-courseware-control)/);
    expect(source).not.toMatch(
      /\b(?:border|bg|text)-(?:slate|cyan|emerald)(?:-\d{2,3})?(?:\/\d{1,3})?\b|\bbg-white\b|\btext-white\b|\bborder-white\b/,
    );
    expect(source).toContain('interactive-courseware-title-level-1');
    expect(source).toContain('interactive-courseware-title-level-2');
    expect(source).toContain('interactive-courseware-title-level-3');
    expect(source).toContain('interactive-courseware-body');
    expect(source).toContain('interactive-courseware-control');
  });
});
