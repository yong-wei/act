import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateInteractiveModuleRegistryGate,
  scanRuntimeInteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import {
  INTERACTIVE_MODULE_DEFINITIONS,
  INTERACTIVE_MODULE_RESPONSE_KIND_DEFINITIONS,
} from '@/features/interactive/shared/manifest-runtime/module-taxonomy';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

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

  it('passes for the current runtime manifest inventory through explicit aliases', () => {
    const result = scanRuntimeInteractiveModuleRegistry();

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.scannedModules).toBeGreaterThan(0);
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
