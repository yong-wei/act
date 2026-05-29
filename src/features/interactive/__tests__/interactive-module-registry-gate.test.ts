import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReactElement } from 'react';

import { describe, expect, it } from 'vitest';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  evaluateInteractiveModuleRegistryGate,
  scanRuntimeInteractiveModuleRegistry,
  STANDARD_MODULE_MIGRATED_LESSON_IDS,
} from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import {
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_DEFINITIONS,
  INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS,
} from '@/features/interactive/shared/manifest-runtime/module-taxonomy';
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

  it('registers response kinds with scoring support metadata', () => {
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS.singleChoice).toMatchObject({
      responseKind: 'singleChoice',
      scoring: 'objective',
    });
    expect(INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS.structured).toMatchObject({
      responseKind: 'structured',
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
    expect(registry['content.table']).toBeTypeOf('function');
    expect(registry['content.figure']).toBeTypeOf('function');
    expect(registry['content.reveal']).toBeTypeOf('function');
    expect(registry['content.stageMap']).toBeTypeOf('function');
    expect(registry['compute.panel']).toBeTypeOf('function');
    expect(registry['analytics.summary']).toBeTypeOf('function');
    expect(registry['layout.support']).toBeTypeOf('function');
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
        code: 'activity-missing-response-contract',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('does not infer response contracts from generic activity card container aliases', () => {
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
        code: 'activity-missing-response-contract',
        canonicalClass: 'activity.panel',
      }),
    ]);
  });

  it('allows generic activity card containers when the step kind defines the response contract', () => {
    const result = evaluateInteractiveModuleRegistryGate({
      manifests: [
        {
          lessonId: 'fixture-lesson',
          manifest: manifestFixture({
            module: {
              id: 'figure-submit-container',
              kind: 'activity-card-set',
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
              payload: { responseKind: 'singleChoice' },
            },
            interactionKind: 'quiz_group',
            activityCards: [
              activityCardFixture({ id: 'valid-card', responseKind: 'single_choice' }),
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
              activityCardFixture({ id: 'valid-card', responseKind: 'single_choice' }),
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

  it('passes for the current runtime manifest inventory with migrated lesson enforcement', () => {
    const result = scanRuntimeInteractiveModuleRegistry();

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.scannedModules).toBeGreaterThan(0);
  });

  it('passes the migrated early lesson group with canonical modules on every step', () => {
    const migratedLessonIds = [...STANDARD_MODULE_MIGRATED_LESSON_IDS];
    const result = scanRuntimeInteractiveModuleRegistry({ migratedLessonIds });
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

  it('passes the migrated variant-heavy lesson group with canonical modules on every step', () => {
    const migratedLessonIds = ['3-5', '3-6', '3-7', '3-8', '3-9'];
    const result = scanRuntimeInteractiveModuleRegistry({ migratedLessonIds });
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
    const result = scanRuntimeInteractiveModuleRegistry({ migratedLessonIds });
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
