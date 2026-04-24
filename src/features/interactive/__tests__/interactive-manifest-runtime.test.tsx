import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import {
  renderInteractiveLessonLayout,
  renderInteractiveManifestStep,
  type InteractiveLayoutRegionNode,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/interactive-manifest-renderer';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();

describe('interactive runtime manifest', () => {
  it('ships the reviewed 4-3 runtime with an interactive manifest path and loads the manifest into the runtime bundle', async () => {
    const lessonJson = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/runtime/lessons/4-3/lesson.json'), 'utf8'),
    ) as {
      interactive_manifest_path?: string;
    };

    expect(lessonJson.interactive_manifest_path).toBe('/course-runtime/lessons/4-3/interactive-manifest.json');

    const runtime = await loadLessonRuntimeEntry('4-3');

    expect(runtime.interactiveManifest).toBeDefined();
    expect(runtime.interactiveManifest?.lessonId).toBe('4-3');
    expect(runtime.interactiveManifest?.steps).toHaveLength(14);
    expect(runtime.interactiveManifest?.steps[0]?.modules.map((module) => module.kind)).toEqual([
      'stage-map',
      'goal-card-row',
    ]);
  });

  it('renders template regions through the shared layout registry in region order instead of course-local step switches', () => {
    const step = {
      id: 'step-01',
      title: '共享模板测试页',
      layout: {
        template: 'stacked_regions',
        regions: [
          { id: 'region-b', width: 'full', order: 2 },
          { id: 'region-a', width: 'full', order: 1 },
        ],
      },
    } as InteractiveRuntimeStepManifest;

    const regionNodes: InteractiveLayoutRegionNode[] = [
      { moduleId: 'module-b', regionId: 'region-b', node: createElement('div', null, 'module-b') },
      { moduleId: 'module-a', regionId: 'region-a', node: createElement('div', null, 'module-a') },
    ];

    const html = renderToStaticMarkup(renderInteractiveLessonLayout({ step, regionNodes }));

    expect(html.indexOf('module-a')).toBeLessThan(html.indexOf('module-b'));
    expect(html).toContain('data-template="stacked_regions"');
  });

  it('loads the reviewed 4-6 runtime manifest including teacher_reveal_only steps', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');

    expect(runtime.interactiveManifest?.lessonId).toBe('4-6');
    expect(runtime.interactiveManifest?.steps).toHaveLength(11);
    expect(runtime.interactiveManifest?.steps.map((step) => step.interactionSpec.interactionKind)).toContain(
      'teacher_reveal_only',
    );
  });

  it('renders the revised 4-6 content payload from the manifest', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const manifest = runtime.interactiveManifest!;
    const moduleRegistry = {
      'formula-card': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'summary-card': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'native-table': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'image-panel': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
      'step-reveal': ({ step, module }: { step: InteractiveRuntimeStepManifest; module: { id: string } }) =>
        createElement('div', null, module.id, JSON.stringify(step.contentBlocks)),
    };

    const renderStep = (stepId: string) => {
      const step = manifest.steps.find((item) => item.id === stepId);
      expect(step).toBeDefined();
      return renderToStaticMarkup(
        renderInteractiveManifestStep({
          manifest,
          step: step!,
          moduleRegistry,
          extra: undefined,
        }),
      );
    };

    expect(renderStep('step-01')).toContain('多段快速机动');
    expect(renderStep('step-04')).toContain('legacy-symbol-table');
    expect(renderStep('step-05')).toContain('船是否真正走到位');
    expect(renderStep('step-06')).toContain('解码例');
    expect(renderStep('step-11')).toContain('4-6-info.png');
  });

  it('renders visible errors for required modules without a renderer instead of silently dropping them', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const step = runtime.interactiveManifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: runtime.interactiveManifest!,
        step: step!,
        moduleRegistry: {},
        extra: undefined,
      }),
    );

    expect(html).toContain('data-manifest-render-error="step-01:plant-card"');
    expect(html).toContain('缺少模块 renderer');
  });

  it('keeps multiple modules in the same manifest region in module order', async () => {
    const runtime = await loadLessonRuntimeEntry('4-6');
    const step = runtime.interactiveManifest?.steps[0];
    expect(step).toBeDefined();

    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: runtime.interactiveManifest!,
        step: step!,
        moduleRegistry: {
          'formula-card': ({ module }) => createElement('div', null, module.id),
          'summary-card': ({ module }) => createElement('div', null, module.id),
          'image-panel': ({ module }) => createElement('div', null, module.id),
        },
        extra: undefined,
      }),
    );

    expect(html.indexOf('plant-card')).toBeLessThan(html.indexOf('recovered-solution-card'));
    expect(html.indexOf('recovered-solution-card')).toBeLessThan(html.indexOf('problem-focus'));
  });
});
