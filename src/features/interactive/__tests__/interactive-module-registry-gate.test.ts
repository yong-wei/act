import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  evaluateInteractiveCoursePrivateControlPanelSourceGate,
  evaluateInteractiveModuleRegistryGate,
  scanRuntimeInteractiveModuleRegistry,
  STANDARD_MODULE_ENFORCED_LESSON_IDS,
  STANDARD_MODULE_MIGRATED_LESSON_IDS,
} from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import {
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_DEFINITIONS,
  INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS,
} from '@/features/interactive/shared/manifest-runtime/module-taxonomy';
import {
  INTERACTIVE_MODULE_VISUAL_STANDARDS,
  resolveInteractiveModuleVisualStandard,
} from '@/features/interactive/shared/manifest-runtime/module-visual-standards';
import { normalizeInteractiveRuntimeManifest, type InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

describe('interactive module registry gate', () => {
  it('defines every canonical module class with validation metadata', () => {
    expect(INTERACTIVE_MODULE_DEFINITIONS['activity.panel']).toMatchObject({
      canonicalClass: 'activity.panel',
      renderBehavior: 'activity-slot',
      configShape: 'activity payload with response contract',
      producesEvidence: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['compute.panel']).toMatchObject({
      canonicalClass: 'compute.panel',
      renderBehavior: 'renderer',
      requiresCapabilityRef: true,
      allowedInNewAuthoring: true,
    });
    expect(INTERACTIVE_MODULE_DEFINITIONS['legacy.adapter']).toMatchObject({
      canonicalClass: 'legacy.adapter',
      migrationOnly: true,
      allowedInNewAuthoring: false,
    });
  });

  it('defines projection-safe visual standards for every canonical module class', () => {
    expect(Object.keys(INTERACTIVE_MODULE_VISUAL_STANDARDS).sort()).toEqual([...INTERACTIVE_MODULE_CANONICAL_CLASSES].sort());

    for (const canonicalClass of INTERACTIVE_MODULE_CANONICAL_CLASSES) {
      const standard = resolveInteractiveModuleVisualStandard(canonicalClass);
      expect(standard, canonicalClass).toBeDefined();
      expect(standard?.roleStates).toEqual(expect.arrayContaining(['student', 'guest', 'teacher']));
      expect(standard?.themeStates).toEqual(expect.arrayContaining(['light', 'dark']));
      expect(standard?.viewportStates).toEqual(expect.arrayContaining(['desktop', 'mobile', 'projection']));
      expect(standard?.projectionSafe).toBe(true);
      expect(standard?.projectionTypography).toBe('projection-readable');
      expect(standard?.geometry).toBe('stable-panel');
      expect(standard?.chromeClassName).toMatch(/^commercial-module-chrome--/);
    }
  });

  it('registers response kinds with scoring support metadata', () => {
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS['choice.single']).toMatchObject({
      responseKind: 'choice.single',
      scoring: 'objective',
    });
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS['text.structured']).toMatchObject({
      responseKind: 'text.structured',
      scoring: 'unsupported',
    });
  });

  it('registers shared renderers for canonical standard content module classes', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });

    expect(registry['content.rich']).toBeTypeOf('function');
    expect(registry['content.cardSet']).toBeTypeOf('function');
    expect(registry['content.formula']).toBeTypeOf('function');
    expect(registry['content.code']).toBeTypeOf('function');
    expect(registry['content.table']).toBeTypeOf('function');
    expect(registry['content.figure']).toBeTypeOf('function');
    expect(registry['content.reveal']).toBeTypeOf('function');
    expect(registry['content.stageMap']).toBeTypeOf('function');
    expect(registry['compute.panel']).toBeTypeOf('function');
    expect(registry['analytics.summary']).toBeTypeOf('function');
    expect(registry['layout.support']).toBeTypeOf('function');
  });

  it('routes shared control workbench compute capabilities through the shared renderer', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'control-workbench-module',
        kind: 'compute.panel',
        mustBeVisible: true,
        payload: {
          capabilityRef: 'control-workbench',
          visiblePanelIds: ['time-domain', 'root-locus'],
          responseContractId: 'parameter.set',
          releaseState: 'released',
          request: controlAnalysisRequestFixture(),
          fallbackResult: controlAnalysisResultFixture(),
        },
      },
    });
    const step = manifest.steps[0];
    const node = registry['compute.panel']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement;
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, node));

    expect(html).toContain('data-control-workbench-capability="control-workbench"');
    expect(html).toContain('data-control-workbench-module-id="control-workbench-module"');
    expect(html).toContain('data-control-workbench-panel="time-domain"');
    expect(html).toContain('data-control-workbench-panel="root-locus"');
    expect(html).not.toContain('data-control-workbench-panel="nyquist"');
    expect(html).toContain('提交会保存当前参数、图形状态和判断');
  });

  it('renders MATLAB code with the canonical content.code module renderer', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'matlab-code',
        kind: 'content.code',
        mustBeVisible: true,
        payload: { block_key: 'code_block' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.code_block = {
      language: 'matlab',
      code: 'G = tf(1, [1 2 0]);   % G(s)=1/(s(s+2))\nstep(G);',
      explanation: '同一对象先看开环阶跃，再进入根轨迹和频域诊断。',
    };
    const node = registry['content.code']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ code?: string; language?: string }>;

    expect(node.props.code).toContain('tf(1, [1 2 0])');
    expect(node.props.language).toBe('matlab');

    const html = renderToStaticMarkup(node);
    expect(html).toContain('data-module-kind="content.code"');
    expect(html).toContain('premium-code-token-function');
    expect(html).toContain('premium-code-token-comment');
  });

  it('renders inline payload items for canonical card set modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'inline-card-set',
        kind: 'content.cardSet',
        mustBeVisible: true,
        payload: { items: ['第一条', '第二条'] },
      },
    });
    const step = manifest.steps[0];
    const node = registry['content.cardSet']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ items?: string[] }>;

    expect(node.props.items).toEqual(['第一条', '第二条']);
  });

  it('renders formula group values for canonical formula modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'formula-group',
        kind: 'content.formula',
        mustBeVisible: true,
        payload: { block_key: 'formula_group' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.formula_group = {
      type: 'formula_group',
      values: ['G(s)=K', 'T(s)=\\frac{G(s)}{1+G(s)H(s)}'],
    };
    const node = registry['content.formula']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ formulas?: string[] }>;

    expect(node.props.formulas).toEqual(['G(s)=K', 'T(s)=\\frac{G(s)}{1+G(s)H(s)}']);
  });

  it('renders asset media blocks for canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'media-block',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { block_key: 'media_block' },
      },
    });
    const step = manifest.steps[0];
    step.contentBlocks.media_block = {
      type: 'media',
      asset: 'diagram.png',
    };
    const node = registry['content.figure']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/fixture-lesson/media/diagram.png');
  });

  it('renders single image payload assets for canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'single-payload-asset',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { assets: ['single.png'] },
      },
    });
    const step = manifest.steps[0];
    const node = registry['content.figure']({
      manifest,
      step,
      module: step.modules[0],
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/fixture-lesson/media/single.png');
  });

  it('keeps media fallback order for multiple canonical figure modules', () => {
    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const manifest = manifestFixture({
      module: {
        id: 'segmented-block',
        kind: 'content.figure',
        mustBeVisible: true,
        payload: { block_key: 'route_task_table' },
      },
    });
    const step = manifest.steps[0];
    step.modules = [
      'segmented-block',
      'rudder-identification-figure',
      'hull-figure',
      'disturbance-figure',
    ].map((id) => ({
      id,
      kind: 'content.figure',
      region: 'main',
      mustBeVisible: true,
      payload: { block_key: 'route_task_table', legacyKind: 'image-panel' },
    }));
    step.contentBlocks.route_task_table = {
      columns: ['航线任务'],
      rows: [['zig-zag 航线']],
    };
    step.contentBlocks.media = [
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/segmented.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/rudder.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/hull.png' },
      { runtime_media: '/course-runtime/lessons/fixture-lesson/media/disturbance.png' },
    ];

    const sources = step.modules.map((module) => {
      const node = registry['content.figure']({
        manifest,
        step,
        module,
        extra: { revealProgress: 0, allowInlineReveal: false },
      }) as ReactElement<{ src?: string }>;
      return node.props.src;
    });

    expect(sources).toEqual([
      '/course-runtime/lessons/fixture-lesson/media/segmented.png',
      '/course-runtime/lessons/fixture-lesson/media/rudder.png',
      '/course-runtime/lessons/fixture-lesson/media/hull.png',
      '/course-runtime/lessons/fixture-lesson/media/disturbance.png',
    ]);
  });

  it('renders the migrated 2-1 step 13 loop diagram from its media group', () => {
    const rawManifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as unknown;
    const manifest = normalizeInteractiveRuntimeManifest(rawManifest);
    expect(manifest).not.toBeNull();
    if (!manifest) throw new Error('2-1 manifest should normalize');
    const step = manifest.steps.find((item) => item.id === 'step-13');
    expect(step).toBeDefined();
    if (!step) throw new Error('2-1 step-13 should exist');
    const runtimeModule = step.modules.find((item) => item.id === 'loop-diagram');
    expect(runtimeModule).toBeDefined();
    if (!runtimeModule) throw new Error('2-1 step-13 loop-diagram should exist');

    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const node = registry['content.figure']({
      manifest,
      step,
      module: runtimeModule,
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/2-1/media/2-1-md-07-example-ship-loop.png');
  });

  it('renders the migrated 2-1 step 14 SFG stage as a figure', () => {
    const rawManifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as unknown;
    const manifest = normalizeInteractiveRuntimeManifest(rawManifest);
    expect(manifest).not.toBeNull();
    if (!manifest) throw new Error('2-1 manifest should normalize');
    const step = manifest.steps.find((item) => item.id === 'step-14');
    expect(step).toBeDefined();
    if (!step) throw new Error('2-1 step-14 should exist');
    const runtimeModule = step.modules.find((item) => item.id === 'sfg-stage');
    expect(runtimeModule).toBeDefined();
    if (!runtimeModule) throw new Error('2-1 step-14 sfg-stage should exist');
    expect(runtimeModule.kind).toBe('content.figure');

    const registry = createManifestContentModuleRegistry({
      revealProgress: 0,
      allowInlineReveal: false,
    });
    const node = registry['content.figure']({
      manifest,
      step,
      module: runtimeModule,
      extra: { revealProgress: 0, allowInlineReveal: false },
    }) as ReactElement<{ src?: string }>;

    expect(node.props.src).toBe('/course-runtime/lessons/2-1/media/2-1-md-14-example2-sfg.png');
  });

  it('uses formula renderers for migrated 2-1 formula-only visible content blocks', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/lessons/2-1/interactive-manifest.json'), 'utf8'),
    ) as {
      steps: Record<string, {
        modules?: Array<{
          id?: string;
          kind?: string;
          must_be_visible?: boolean;
          payload?: { block_key?: string };
        }>;
        content_blocks?: Record<string, { type?: string; value?: unknown; values?: unknown; formula?: unknown; latex?: unknown; math?: unknown }>;
      }>;
    };
    const offenders: string[] = [];

    for (const [stepId, step] of Object.entries(manifest.steps)) {
      for (const runtimeModule of step.modules ?? []) {
        const blockKey = runtimeModule.payload?.block_key;
        const block = blockKey ? step.content_blocks?.[blockKey] : undefined;
        const formulaOnlyBlock = block && (
          block.type === 'formula'
          || block.type === 'formula_group'
          || Boolean(block.value)
          || Boolean(block.values)
          || Boolean(block.formula)
          || Boolean(block.latex)
          || Boolean(block.math)
        );
        if (
          runtimeModule.must_be_visible
          && formulaOnlyBlock
          && ['content.rich', 'content.cardSet'].includes(runtimeModule.kind ?? '')
        ) {
          offenders.push(`${stepId}/${runtimeModule.id}:${runtimeModule.kind}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('reports unknown module kinds with lesson, step, and module identifiers', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'unknown-module',
              kind: 'custom-surprise-widget',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'unknown-module',
        kind: 'custom-surprise-widget',
        code: 'unregistered-module-kind',
      }),
    ]);
  });

  it('rejects course-local chrome overrides for standard module kinds', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'local-chrome-module',
              kind: 'content.rich',
              mustBeVisible: true,
              payload: { className: 'premium-lesson-card custom-local-shell' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'local-chrome-module',
        kind: 'content.rich',
        code: 'course-local-module-chrome',
        canonicalClass: 'content.rich',
      }),
    ]);
  });

  it('rejects object-shaped course-local chrome overrides for standard module kinds', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'object-local-chrome-module',
              kind: 'content.rich',
              mustBeVisible: true,
              payload: { moduleChrome: { variant: 'custom-local-shell' } },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'object-local-chrome-module',
        kind: 'content.rich',
        code: 'course-local-module-chrome',
        canonicalClass: 'content.rich',
      }),
    ]);
  });

  it('rejects legacy aliases in lessons marked migrated to canonical modules', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      migratedLessonIds: ['fixture-lesson'],
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-formula',
              kind: 'formula-strip',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-formula',
        kind: 'formula-strip',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'content.formula',
      }),
    ]);
  });

  it('rejects legacy aliases in new manifests even before a lesson is marked migrated', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'new-legacy-formula',
              kind: 'formula-strip',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'new-legacy-formula',
        kind: 'formula-strip',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'content.formula',
      }),
    ]);
  });

  it('rejects migration-only canonical module classes in migrated lessons', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      migratedLessonIds: ['fixture-lesson'],
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-adapter-module',
              kind: 'legacy.adapter',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-adapter-module',
        kind: 'legacy.adapter',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'legacy.adapter',
      }),
    ]);
  });

  it('rejects activity modules without a registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-without-contract',
              kind: 'activity.panel',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'activity-without-contract',
        kind: 'activity.panel',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects legacy activity aliases without a registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'legacy-activity-without-contract',
              kind: 'submit-feedback-bar',
              mustBeVisible: true,
            },
            interactionKind: 'display',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-activity-without-contract',
        kind: 'submit-feedback-bar',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('rejects generic activity card container aliases before response contract inference', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'generic-activity-container',
              kind: 'activity-card-set',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'generic-activity-container',
        kind: 'activity-card-set',
        code: 'legacy-alias-in-migrated-lesson',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('allows canonical activity panels when the step kind defines the response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'figure-submit-container',
              kind: 'activity.panel',
              mustBeVisible: true,
            },
            interactionKind: 'interactive_figure_submit',
            activityCards: [],
            submitFields: ['gain', 'observation'],
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('reports unregistered activity card response kinds without filtering them out', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-with-mixed-contracts',
              kind: 'activity.panel',
              mustBeVisible: true,
              payload: { responseKind: 'choice.single' },
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'valid-card', responseKind: 'choice.single' }),
              activityCardFixture({ id: 'invalid-card', responseKind: 'not_registered' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'invalid-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'not_registered',
      }),
    ]);
  });

  it('rejects legacy response aliases even when their canonical replacement is known', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'activity-with-legacy-response',
              kind: 'activity.panel',
              mustBeVisible: true,
              payload: { responseKind: 'choice.single' },
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'legacy-response-card', responseKind: 'single_choice' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'legacy-response-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'single_choice',
      }),
    ]);
  });

  it('rejects individual activity cards without response kinds even when sibling cards are valid', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'valid-card', responseKind: 'choice.single' }),
              activityCardFixture({ id: 'missing-card', responseKind: '' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'missing-card',
        kind: 'quiz_group',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('validates response-producing steps even when the visible module is content-only', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'step-card', responseKind: 'not_registered' }),
            ],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'step-card',
        kind: 'quiz_group',
        code: 'activity-unregistered-response-kind',
        responseKind: 'not_registered',
      }),
    ]);
  });

  it('rejects response-producing steps without any response contract cards', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group',
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'quiz_group',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects display steps with submit fields but no registered response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'display',
            activityCards: [],
            submitFields: ['observation', 'reason'],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'display',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects suffixed response-producing steps without any response contract cards', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'quiz_group+exit_reflection' as never,
            activityCards: [],
          }),
        },
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'short_response' as never,
            activityCards: [],
          }),
        },
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'content-only-module',
              kind: 'content.rich',
              mustBeVisible: true,
            },
            interactionKind: 'curve_compare_panel' as never,
            activityCards: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'quiz_group+exit_reflection',
        code: 'activity-missing-response-contract',
      }),
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'short_response',
        code: 'activity-missing-response-contract',
      }),
      expect.objectContaining({
        stepId: 'step-01',
        moduleId: '(step)',
        kind: 'curve_compare_panel',
        code: 'activity-missing-response-contract',
      }),
    ]);
  });

  it('rejects compute modules without a registered capability reference', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'compute-without-capability',
              kind: 'compute.panel',
              mustBeVisible: true,
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'compute-without-capability',
        kind: 'compute.panel',
        code: 'compute-missing-capability-ref',
      }),
    ]);
  });

  it('rejects compute modules with unregistered capability references', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'compute-with-unknown-capability',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: { capabilityRef: 'unknown-compute-capability' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'compute-with-unknown-capability',
        kind: 'compute.panel',
        code: 'compute-unregistered-capability-ref',
        capabilityRef: 'unknown-compute-capability',
      }),
    ]);
  });

  it('accepts registered shared control workbench capabilities with response and panel contracts', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'control-workbench',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'control-linked-comparison',
                visiblePanelIds: ['time-domain', 'bode'],
                responseContractId: 'parameter.set',
                request: controlAnalysisRequestFixture(),
              },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects shared control workbench capabilities without visible panel and response contracts', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'control-workbench-missing-contract',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: { capabilityRef: 'control-workbench' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        moduleId: 'control-workbench-missing-contract',
        code: 'compute-control-migration-exception-invalid',
        capabilityRef: 'control-workbench',
      }),
    ]);
  });

  it('rejects interactive-figure as a generic control-analysis carrier without a complete migration exception', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'private-bode-panel',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'interactive-figure',
                panel_id: 'rust_bode_private_panel',
                migrationException: {
                  issueId: '560',
                  owner: 'interactive-course-visual-components',
                },
              },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        moduleId: 'private-bode-panel',
        code: 'compute-control-migration-exception-invalid',
        capabilityRef: 'interactive-figure',
      }),
    ]);
  });

  it('validates static 3D surface compute panel payloads', () => {
    const validResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: staticSurfacePayloadFixture(),
            },
          }),
        },
      ],
    });

    expect(validResult.passed).toBe(true);
    expect(validResult.violations).toEqual([]);

    const inlineDataResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-inline-data',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                ...staticSurfacePayloadFixture(),
                data: {
                  regularGrid: {
                    x: [-2, 0, 2],
                    y: [-1, 1],
                    values: [
                      [8, 18, 8],
                      [6, 12, 6],
                    ],
                  },
                },
              },
            },
          }),
        },
      ],
    });

    expect(inlineDataResult.passed).toBe(true);
    expect(inlineDataResult.violations).toEqual([]);

    const invalidResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-missing-contract',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                capabilityRef: 'static-surface-3d',
                data: { url: '/course-runtime/lessons/1-2/media/generated-data/pole-magnitude-surface.json' },
              },
            },
          }),
        },
      ],
    });

    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'static-surface-missing-contract',
        kind: 'compute.panel',
        code: 'compute-static-surface-payload-invalid',
        capabilityRef: 'static-surface-3d',
      }),
    ]);

    const unsupportedInlineDataResult = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'static-surface-values-only',
              kind: 'compute.panel',
              mustBeVisible: true,
              payload: {
                ...staticSurfacePayloadFixture(),
                data: { values: [[1, 2], [3, 4]] },
              },
            },
          }),
        },
      ],
    });

    expect(unsupportedInlineDataResult.passed).toBe(false);
    expect(unsupportedInlineDataResult.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'static-surface-values-only',
        kind: 'compute.panel',
        code: 'compute-static-surface-payload-invalid',
        capabilityRef: 'static-surface-3d',
      }),
    ]);
  });

  it('rejects content.code modules without code text', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'empty-code',
              kind: 'content.code',
              mustBeVisible: true,
              payload: { language: 'python' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'empty-code',
        kind: 'content.code',
        code: 'code-module-missing-source',
      }),
    ]);
  });

  it('allows non-MATLAB code modules while reserving MATLAB highlighting for MATLAB code', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'python-code',
              kind: 'content.code',
              mustBeVisible: true,
              payload: { language: 'python', code: 'print(\"control example\")' },
            },
          }),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects code-like examples hidden inside non-code content modules', () => {
    const manifest = manifestFixture({
      module: {
        id: 'hidden-code-reveal',
        kind: 'content.reveal',
        mustBeVisible: true,
        payload: { block_key: 'hidden_code' },
      },
    });
    manifest.steps[0].contentBlocks.hidden_code = {
      items: [
        { text: 'G = tf(1, [1 2 0]);   % G(s)=1/(s(s+2))' },
      ],
    };

    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'hidden-code-reveal',
        kind: 'content.reveal',
        code: 'code-like-content-outside-code-module',
      }),
    ]);
  });

  it('rejects generic interaction status modules on non-interactive pages', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'status-panel',
              kind: 'layout.support',
              mustBeVisible: true,
              payload: { title: '本页互动状态', text: '无需作答' },
            },
            interactionKind: 'none',
            activityCards: [],
            submitFields: [],
          }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        lessonId: 'fixture-lesson',
        stepId: 'step-01',
        moduleId: 'status-panel',
        kind: 'layout.support',
        code: 'non-interactive-status-module',
      }),
    ]);
  });

  it('reports invalid manifest JSON as a structured gate violation', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/broken-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(join(lessonDir, 'interactive-manifest.json'), '{ invalid json', 'utf8');

      const result = scanRuntimeInteractiveModuleRegistry({ rootDir });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'broken-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/broken-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('reports structurally malformed manifest objects as structured gate violations', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const emptyLessonDir = join(rootDir, 'course-content/runtime/lessons/empty-lesson');
      const malformedLessonDir = join(rootDir, 'course-content/runtime/lessons/malformed-lesson');
      mkdirSync(emptyLessonDir, { recursive: true });
      mkdirSync(malformedLessonDir, { recursive: true });
      writeFileSync(join(emptyLessonDir, 'interactive-manifest.json'), '{}', 'utf8');
      writeFileSync(join(malformedLessonDir, 'interactive-manifest.json'), '{"steps":[]}', 'utf8');

      const result = scanRuntimeInteractiveModuleRegistry({ rootDir });

      expect(result.passed).toBe(false);
      expect(result.scannedModules).toBe(0);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'empty-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/empty-lesson/interactive-manifest.json',
        }),
        expect.objectContaining({
          lessonId: 'malformed-lesson',
          code: 'invalid-runtime-manifest',
          manifestPath: 'course-content/runtime/lessons/malformed-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when a runtime-first manifest is missing from the standard module lesson inventory', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/unlisted-runtime-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'unlisted-runtime-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: [],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'unlisted-runtime-lesson',
          code: 'lesson-missing-from-standard-module-inventory',
          manifestPath: 'course-content/runtime/lessons/unlisted-runtime-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects top-level course-local chrome before runtime manifest normalization strips it', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/local-chrome-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'local-chrome-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  className: 'course-local-shell',
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['local-chrome-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'local-chrome-lesson',
          stepId: 'step-01',
          moduleId: 'intro',
          kind: 'content.rich',
          code: 'course-local-module-chrome',
          canonicalClass: 'content.rich',
          manifestPath: 'course-content/runtime/lessons/local-chrome-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects top-level object or array course-local chrome before normalization strips it', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/local-chrome-object-lesson');
      mkdirSync(lessonDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'local-chrome-object-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  localChrome: [{ variant: 'course-local-shell' }],
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['local-chrome-object-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'local-chrome-object-lesson',
          stepId: 'step-01',
          moduleId: 'intro',
          kind: 'content.rich',
          code: 'course-local-module-chrome',
          canonicalClass: 'content.rich',
          manifestPath: 'course-content/runtime/lessons/local-chrome-object-lesson/interactive-manifest.json',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('passes for the current runtime manifest inventory with standard module lesson enforcement', () => {
    const result = scanRuntimeInteractiveModuleRegistry();

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.scannedModules).toBeGreaterThan(0);
  });

  it('does not hard-code generic interaction status or runtime media implementation copy in step panel source', () => {
    const files = collectSourceFiles(join(process.cwd(), 'src/features/interactive'))
      .filter((filePath) => filePath.endsWith('/step-panels.tsx'));
    const forbiddenCopy = /本页互动状态|互动状态模块|课程 runtime 配套图示|当前交互实现直接消费|Python 函数|Python 代码|```python|import control/;
    const offenders = files.filter((filePath) => forbiddenCopy.test(readFileSync(filePath, 'utf8')));

    expect(offenders.map((filePath) => filePath.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });

  it('rejects course-private duplicate control panel source unless a complete migration exception is documented', () => {
    const invalidSource = evaluateInteractiveCoursePrivateControlPanelSourceGate([
      {
        path: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        source: 'import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels"; export function LocalBodePanel() { return null; }',
      },
    ]);
    expect(invalidSource).toEqual([
      expect.objectContaining({
        lessonId: 'unit-9-9-demo',
        code: 'course-private-control-panel-duplicate',
      }),
    ]);

    const validSource = evaluateInteractiveCoursePrivateControlPanelSourceGate([
      {
        path: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        source: `
          const controlWorkbenchMigrationException = {
            issueId: '#560',
            owner: 'interactive-course-visual-components',
            removalCondition: 'replace with shared control workbench capability',
            expiresOn: '2026-12-31',
          };
          import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels";
        `,
      },
    ]);
    expect(validSource).toEqual([]);
  });

  it('scans course-private duplicate control panel source by default', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'interactive-module-gate-'));
    try {
      const lessonDir = join(rootDir, 'course-content/runtime/lessons/source-gate-lesson');
      const sourceDir = join(rootDir, 'src/features/interactive/unit-9-9-demo');
      mkdirSync(lessonDir, { recursive: true });
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(
        join(lessonDir, 'interactive-manifest.json'),
        JSON.stringify({
          lesson_id: 'source-gate-lesson',
          steps: {
            'step-01': {
              title: 'Step 01',
              layout: { regions: [{ id: 'main', width: 'full', order: 1 }] },
              modules: [
                {
                  id: 'intro',
                  kind: 'content.rich',
                  region: 'main',
                  must_be_visible: true,
                  payload: {},
                },
              ],
              interaction_spec: { interaction_kind: 'display' },
            },
          },
        }),
        'utf8',
      );
      writeFileSync(
        join(sourceDir, 'step-panels.tsx'),
        'import { BodePanel } from "@/resources/control-system/charts/control-analysis-panels"; export function LocalBodePanel() { return null; }',
        'utf8',
      );

      const result = scanRuntimeInteractiveModuleRegistry({
        rootDir,
        standardModuleLessonIds: ['source-gate-lesson'],
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          lessonId: 'unit-9-9-demo',
          code: 'course-private-control-panel-duplicate',
          manifestPath: 'src/features/interactive/unit-9-9-demo/step-panels.tsx',
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('passes the standard module lesson group with canonical modules on every step', () => {
    const standardModuleLessonIds = [...STANDARD_MODULE_ENFORCED_LESSON_IDS];
    const result = scanRuntimeInteractiveModuleRegistry({ standardModuleLessonIds });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    expect(standardModuleLessonIds).toContain('1-1');

    for (const lessonId of standardModuleLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });

  it('passes the migrated variant-heavy lesson group with canonical modules on every step', () => {
    const migratedLessonIds = ['3-5', '3-6', '3-7', '3-8', '3-9'];
    const result = scanRuntimeInteractiveModuleRegistry({
      migratedLessonIds: STANDARD_MODULE_MIGRATED_LESSON_IDS,
    });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    for (const lessonId of migratedLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });

  it('passes the migrated stable lesson group with canonical modules on every step', () => {
    const migratedLessonIds = [
      '4-1',
      '4-2',
      '4-3',
      '4-4',
      '4-5',
      '4-6',
      '4-7',
      '5-1',
      '5-2',
      '5-3',
      '5-4',
      '5-5',
      '5-6',
      'cruise-comfort-boppps',
    ];
    const result = scanRuntimeInteractiveModuleRegistry({
      migratedLessonIds: STANDARD_MODULE_MIGRATED_LESSON_IDS,
    });
    const canonicalClasses = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);

    for (const lessonId of migratedLessonIds) {
      const manifest = JSON.parse(
        readFileSync(join(process.cwd(), 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
      ) as {
        steps: Record<string, { modules?: Array<{ kind?: string }> }>;
      };

      for (const [stepId, step] of Object.entries(manifest.steps)) {
        expect(step.modules, `${lessonId} ${stepId} should have standard modules`).toBeDefined();
        expect(step.modules?.length, `${lessonId} ${stepId} should have standard modules`).toBeGreaterThan(0);
        for (const runtimeModule of step.modules ?? []) {
          expect(
            canonicalClasses.has(runtimeModule.kind ?? ''),
            `${lessonId} ${stepId} module kind ${runtimeModule.kind} should be canonical`,
          ).toBe(true);
          expect(runtimeModule.kind).not.toBe('legacy.adapter');
        }
      }
    }
  });
});

function manifestFixture({
  module,
  interactionKind = 'display',
  activityCards,
  submitFields,
}: {
  module: { id: string; kind: string; mustBeVisible: boolean; payload?: Record<string, unknown> };
  interactionKind?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['interactionKind'];
  activityCards?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['activityCards'];
  submitFields?: InteractiveRuntimeManifest['steps'][number]['interactionSpec']['submitFields'];
}): InteractiveRuntimeManifest {
  return {
    lessonId: 'fixture-lesson',
    courseTitle: 'Fixture Lesson',
    courseRouteSegment: 'fixture-lesson',
    previewMode: {},
    mediaPolicy: {},
    telemetryStrategy: 'fixture',
    teacherInsightStrategy: 'fixture',
    requiredStepFields: [],
    stepOrder: ['step-01'],
    steps: [
      {
        id: 'step-01',
        title: 'Step 01',
        layout: { template: 'stacked_regions', regions: [{ id: 'main', width: 'full', order: 1 }] },
        modules: [
          {
            id: module.id,
            kind: module.kind,
            region: 'main',
            mustBeVisible: module.mustBeVisible,
            payload: module.payload ?? {},
          },
        ],
        contentBlocks: {},
        evidenceSequence: [],
        interactionSpec: {
          interactionKind,
          activityCards,
          submitFields,
        },
        teacherControls: {
          releaseActivity: 'not_applicable',
          openBrowse: 'not_applicable',
          teacherStepReveal: 'not_applicable',
          revealReferenceAnswer: 'not_applicable',
        },
        studentAccess: {},
        teacherInsightSpec: { widgets: [] },
        telemetrySpec: { summaryFields: [], misconceptionTags: [] },
        aiContextSpec: { pageGoal: '', deliveryMode: '' },
        interactiveFigureSpec: {},
        previewContract: { demoPath: '' },
        acceptanceChecks: [],
      },
    ],
  };
}

function staticSurfacePayloadFixture(): Record<string, unknown> {
  return {
    capabilityRef: 'static-surface-3d',
    data: { url: '/course-runtime/lessons/1-2/media/generated-data/pole-magnitude-surface.json' },
    axes: {
      x: { label: '实部 σ' },
      y: { label: '虚部 jω' },
      z: { label: '20log10|G(s)|' },
    },
    colorScale: { label: '幅值 dB', min: -20, max: 60 },
    defaultCamera: { position: [3, 3, 2], target: [0, 0, 0], zoom: 1 },
    fallback: {
      image: '/course-runtime/lessons/1-2/media/1-2-fig-08-magnitude-surface.png',
      alt: '船舶传递函数极点幅值曲面的静态图',
    },
  };
}

function activityCardFixture({
  id,
  responseKind,
}: {
  id: string;
  responseKind: string;
}): NonNullable<InteractiveRuntimeManifest['steps'][number]['interactionSpec']['activityCards']>[number] {
  return {
    id,
    prompt: 'Fixture prompt',
    responseKind,
    submitScope: 'step',
    layoutSpan: 'full',
    options: [],
  };
}

function controlAnalysisRequestFixture(): Record<string, unknown> {
  return {
    runtimeMode: 'analysis',
    caseId: 'fixture-control-workbench',
    plant: {
      numerator: [1],
      denominator: [1, 2, 1],
      coefficientOrder: 'descending',
      label: 'G(s)',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: 1 },
        label: 'K',
      },
    ],
    outputs: ['step_response', 'bode', 'root_locus', 'nyquist'],
    responseType: 'step',
    timeRange: { start: 0, end: 10, samples: 64 },
    frequencyRange: { min: 0.1, max: 10, samples: 64 },
    rootLocus: { minGain: 0, maxGain: 10, samples: 64, currentGain: 1 },
  };
}

function controlAnalysisResultFixture(): Record<string, unknown> {
  const line = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  return {
    metrics: {
      overshootPct: 0,
      riseTimeSec: 1,
      settlingTimeSec: 2,
      peakTimeSec: 1,
      finalValue: 1,
      phaseMarginDeg: 45,
      gainMarginDb: 12,
      gainCrossoverRadPerSec: 1,
      phaseCrossoverRadPerSec: 2,
      bandwidthRadPerSec: 3,
    },
    stepResponse: { points: line },
    magnitude: { points: line },
    phase: { points: line },
    nyquist: { points: [{ re: 0, im: 0 }, { re: 1, im: -1 }] },
    rootLocus: {
      branches: [[{ re: -1, im: 0 }, { re: -2, im: 0 }]],
      currentPoles: [{ re: -1, im: 0 }],
      openLoopPoles: [{ re: -1, im: 0 }],
      openLoopZeros: [],
    },
    isFallback: true,
  };
}

function collectSourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result.sort();
}
