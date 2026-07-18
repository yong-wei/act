import { describe, expect, it } from 'vitest';

import {
  BOPPPS_STAGES,
  GENERATED_CONTENT_CLASSES,
  GENERATED_RESPONSE_KINDS,
  GENERATED_SLIDE_ASPECT_RATIO,
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  GENERATED_SLIDE_SIZE_REGISTRY,
  GENERATED_SLIDE_TEXT_BUDGET_REGISTRY,
  adaptGeneratedSlideManifestToInteractiveRuntime,
  computeGeneratedSlideContentHash,
  generatedSlideManifestSchema,
  resolveGeneratedSlideTypographyFit,
  validateGeneratedSlideManifest,
  type GeneratedSlideManifest,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { evaluateInteractiveModuleRegistryGate } from '@/features/interactive/shared/manifest-runtime/module-registry-gate';
import { buildManifestSubmissionTelemetry } from '@/features/interactive/shared/manifest-runtime/submission-telemetry';
import {
  getInteractiveResponseKindMetadata,
  normalizeInteractiveResponseKind,
} from '@/lib/interactive-response-contracts';

describe('generated slide contract', () => {
  it('publishes only the fixed P0 vocabulary and immutable 16:9 registries', () => {
    expect(BOPPPS_STAGES).toEqual([
      'bridge-in',
      'objective',
      'pre-assessment',
      'participatory-learning',
      'post-assessment',
      'summary',
    ]);
    expect(GENERATED_CONTENT_CLASSES).toEqual([
      'content.rich',
      'content.cardSet',
      'content.formula',
      'content.table',
      'content.code',
      'content.reveal',
    ]);
    expect(GENERATED_RESPONSE_KINDS).toEqual([
      'choice.single',
      'choice.multi',
      'text.short',
      'text.long',
      'ordering.sequence',
      'matching.pairs',
    ]);

    expect(Object.isFrozen(GENERATED_SLIDE_LAYOUT_REGISTRY)).toBe(true);
    expect(Object.isFrozen(GENERATED_SLIDE_LAYOUT_REGISTRY['two-column'].slots)).toBe(true);
    expect(Object.isFrozen(GENERATED_SLIDE_SIZE_REGISTRY)).toBe(true);
    expect(Object.isFrozen(GENERATED_SLIDE_TEXT_BUDGET_REGISTRY)).toBe(true);
    for (const layout of Object.values(GENERATED_SLIDE_LAYOUT_REGISTRY)) {
      expect(layout.aspectRatio).toBe(GENERATED_SLIDE_ASPECT_RATIO);
      expect(layout.columns / layout.rows).toBe(12 / 9);
    }
  });

  it('accepts a complete six-stage manifest with exact timing and registered occupancy', () => {
    const manifest = validManifest();
    const result = validateGeneratedSlideManifest(manifest);

    expect(generatedSlideManifestSchema.safeParse(manifest).success).toBe(true);
    expect(result).toMatchObject({ valid: true, issues: [] });
    expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('resolves deterministic normal, bounded adapted, and explicit unfit typography states', () => {
    const manifestModule = validManifest().stages[0].steps[0].modules[0];

    expect(resolveGeneratedSlideTypographyFit(manifestModule)).toMatchObject({
      state: 'normal',
      fontSizePx: 32,
      suggestedCharacters: 900,
    });

    manifestModule.payload = { text: 'A'.repeat(1_000) };
    expect(resolveGeneratedSlideTypographyFit(manifestModule)).toEqual({
      state: 'adapted',
      fontSizePx: 28,
      actualCharacters: 1_000,
      suggestedCharacters: 900,
    });

    manifestModule.payload = { text: 'A'.repeat(1_201) };
    expect(resolveGeneratedSlideTypographyFit(manifestModule)).toEqual({
      state: 'unfit',
      fontSizePx: 24,
      actualCharacters: 1_201,
      suggestedCharacters: 900,
    });
  });

  it('accepts a canonical activity carrier with role-safe evidence metadata', () => {
    const manifest = validManifest();
    const step = manifest.stages[0].steps[0];
    step.layoutId = 'two-column';
    step.modules = [
      contentModule('module-1', 'left', 'half'),
      {
        id: 'activity-1',
        canonicalClass: 'activity.panel',
        slotId: 'right',
        sizeId: 'half',
        responseKind: 'choice.single',
        evidencePath: 'responses.step-1.activity-1',
        payload: {
          prompt: 'Select one.',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
        roleMetadata: {
          studentVisible: true,
          teacherVisible: true,
          referenceAnswerVisibility: 'teacher-only',
        },
      },
    ];

    expect(validateGeneratedSlideManifest(manifest)).toMatchObject({ valid: true, issues: [] });
  });

  it('adapts generated steps and modules into the existing runtime registry shape', () => {
    const manifest = validManifest();
    const generatedStep = manifest.stages[0].steps[0];
    generatedStep.layoutId = 'two-column';
    generatedStep.modules = [
      contentModule('module-1', 'left', 'half'),
      activityModule('activity-1', 'right', 'half', 'choice.single', {
        prompt: 'Select one.',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ];

    const adapted = adaptGeneratedSlideManifestToInteractiveRuntime(manifest);
    const mapping = adapted.stepMappings[0];
    const activityCard = mapping.runtimeStep.interactionSpec.activityCards?.[0];

    expect(mapping.generatedStep).toBe(generatedStep);
    expect(mapping.runtimeStep).toBe(adapted.runtimeManifest.steps[0]);
    expect(mapping.runtimeStep.layout).toEqual({
      template: 'two-column',
      regions: [
        { id: 'left', width: 'half', order: 0 },
        { id: 'right', width: 'half', order: 1 },
      ],
    });
    expect(mapping.runtimeStep.modules).toEqual([
      expect.objectContaining({
        id: 'module-1',
        kind: 'content.rich',
        region: 'left',
        mustBeVisible: true,
        payload: { text: 'Content for module-1.' },
      }),
      expect.objectContaining({
        id: 'activity-1',
        kind: 'activity.panel',
        region: 'right',
        mustBeVisible: true,
        payload: expect.objectContaining({ responseKind: 'choice.single' }),
      }),
    ]);
    expect(mapping.runtimeStep.interactionSpec.submitFields).toEqual([
      'responses.step-1.activity-1',
    ]);
    expect(activityCard).toMatchObject({
      id: 'activity-1',
      responseKind: normalizeInteractiveResponseKind('choice.single'),
      responseCategory: getInteractiveResponseKindMetadata('choice.single').category,
      responseScoringMode: getInteractiveResponseKindMetadata('choice.single').scoring,
      submitScope: 'per_card',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });

    expect(evaluateInteractiveModuleRegistryGate({
      manifests: [{ lessonId: manifest.lessonId, manifest: adapted.runtimeManifest }],
    })).toMatchObject({ passed: true, scannedModules: 7, violations: [] });
  });

  it('maps choice, ordering, and matching payloads into consumable activity cards', () => {
    const manifest = validManifest();
    const step = manifest.stages[0].steps[0];
    step.layoutId = 'three-column';
    step.modules = [
      activityModule('choice-1', 'left', 'third', 'choice.multi', {
        prompt: 'Choose all.',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
      activityModule('ordering-1', 'center', 'third', 'ordering.sequence', {
        prompt: 'Order these.',
        items: ['First', 'Second'],
      }),
      activityModule('matching-1', 'right', 'third', 'matching.pairs', {
        prompt: 'Match these.',
        left: [
          { value: 'l1', label: 'Left 1' },
          { value: 'l2', label: 'Left 2' },
        ],
        right: [
          { value: 'r1', label: 'Right 1' },
          { value: 'r2', label: 'Right 2' },
        ],
      }),
    ];

    const runtimeStep = adaptGeneratedSlideManifestToInteractiveRuntime(manifest).stepMappings[0].runtimeStep;
    const cards = runtimeStep.interactionSpec.activityCards ?? [];

    expect(cards[0].options).toEqual([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    expect(cards[1].options).toEqual([
      { value: 'First', label: 'First' },
      { value: 'Second', label: 'Second' },
    ]);
    expect(cards[2]).toMatchObject({
      options: [],
      matchItems: [
        { value: 'l1', label: 'Left 1' },
        { value: 'l2', label: 'Left 2' },
      ],
      matchOptions: [
        { value: 'r1', label: 'Right 1' },
        { value: 'r2', label: 'Right 2' },
      ],
    });
    expect(runtimeStep.interactionSpec.submitFields).toEqual([
      'responses.step-1.choice-1',
      'responses.step-1.ordering-1',
      'responses.step-1.matching-1',
    ]);
  });

  it('feeds adapted activity cards into the existing submission contract', () => {
    const manifest = validManifest();
    manifest.stages[0].steps[0].modules = [activityModule(
      'reflection-1',
      'main',
      'full',
      'text.short',
      { prompt: 'Explain the boundary.', placeholder: 'Your evidence' },
    )];
    const runtimeStep = adaptGeneratedSlideManifestToInteractiveRuntime(manifest).stepMappings[0].runtimeStep;

    expect(buildManifestSubmissionTelemetry({
      stepId: runtimeStep.id,
      submittedAt: 1_788_000_000_000,
      answers: { 'reflection-1': 'The response remains bounded.' },
    }, runtimeStep)).toMatchObject({
      responseSummaries: [{
        cardId: 'reflection-1',
        responseKind: 'text.short',
        responseCategory: 'subjective',
        answered: true,
        submittedAnswer: 'The response remains bounded.',
        scoringSupported: false,
        unsupportedReason: 'subjective_response_kind',
      }],
    });
  });

  it('reports stable hierarchy and exact timing codes with stage and step locations', () => {
    const manifest = validManifest();
    manifest.stages[0].stage = 'objective';
    manifest.stages[1].durationSeconds = 61;
    manifest.durationSeconds = 361;
    manifest.stages[2].steps[0].modules = [];

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'hierarchy.stage-order', location: {} }),
      expect.objectContaining({
        code: 'timing.stage-step-mismatch',
        location: expect.objectContaining({ stage: 'objective', stageIndex: 1 }),
      }),
      expect.objectContaining({
        code: 'hierarchy.module-count',
        location: expect.objectContaining({ stageIndex: 2, stepId: 'step-3', stepIndex: 0 }),
      }),
    ]));
  });

  it('requires every BOPPPS stage to contain at least one step', () => {
    const manifest = validManifest();
    manifest.stages[0].steps = [];

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'schema.invalid',
        location: expect.objectContaining({ stage: 'bridge-in', stageIndex: 0 }),
      }),
    ]);
  });

  it('rejects unsupported content, response kinds, and class-specific payloads', () => {
    const manifest = validManifest();
    manifest.stages[0].steps[0].modules[0].canonicalClass = 'content.figure';

    const activity = manifest.stages[1].steps[0].modules[0];
    activity.canonicalClass = 'activity.panel';
    activity.responseKind = 'simulation.result';
    activity.evidencePath = 'responses.step-2.activity-2';
    activity.roleMetadata.referenceAnswerVisibility = 'teacher-only';
    activity.payload = { prompt: 'Choose.' };

    const badPayload = manifest.stages[2].steps[0].modules[0];
    badPayload.canonicalClass = 'content.code';
    badPayload.payload = { language: 'ts' };

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'module.unsupported-class', location: expect.objectContaining({ moduleId: 'module-1' }) }),
      expect.objectContaining({ code: 'module.unsupported-response-kind', location: expect.objectContaining({ moduleId: 'module-2' }) }),
      expect.objectContaining({ code: 'module.payload-invalid', location: expect.objectContaining({ moduleId: 'module-3' }) }),
    ]));
  });

  it('checks slot reuse, exact size compatibility, and role-safe activity metadata', () => {
    const manifest = validManifest();
    const step = manifest.stages[0].steps[0];
    step.layoutId = 'two-column';
    step.modules = [
      contentModule('module-1', 'left', 'full'),
      {
        ...contentModule('module-extra', 'left', 'half'),
        canonicalClass: 'activity.panel',
        responseKind: 'choice.single',
        evidencePath: undefined,
        roleMetadata: {
          studentVisible: false,
          teacherVisible: true,
          referenceAnswerVisibility: 'none',
        },
        payload: {
          prompt: 'Select one.',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      },
    ];

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'size.incompatible-slot', location: expect.objectContaining({ moduleId: 'module-1' }) }),
      expect.objectContaining({ code: 'layout.slot-reused', location: expect.objectContaining({ moduleId: 'module-extra' }) }),
      expect.objectContaining({ code: 'layout.occupancy-overlap', location: expect.objectContaining({ moduleId: 'module-extra' }) }),
      expect.objectContaining({ code: 'module.activity-contract-invalid', location: expect.objectContaining({ moduleId: 'module-extra' }) }),
      expect.objectContaining({ code: 'metadata.role-unsafe', location: expect.objectContaining({ moduleId: 'module-extra' }) }),
    ]));
  });

  it('treats suggested text overflow as a warning without hiding a statically valid slide', () => {
    const manifest = validManifest();
    manifest.stages[0].steps[0].modules[0].payload = { text: 'x'.repeat(901) };

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'text.suggested-budget-exceeded',
        severity: 'warning',
        location: expect.objectContaining({ moduleId: 'module-1' }),
      }),
    ]);
  });

  it('rejects arbitrary geometry and maps schema failures to module locations', () => {
    const manifest = validManifest() as GeneratedSlideManifest & {
      stages: Array<GeneratedSlideManifest['stages'][number] & {
        steps: Array<GeneratedSlideManifest['stages'][number]['steps'][number] & {
          modules: Array<GeneratedSlideManifest['stages'][number]['steps'][number]['modules'][number] & { x?: number }>;
        }>;
      }>;
    };
    manifest.stages[0].steps[0].modules[0].x = 10;

    const result = validateGeneratedSlideManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'schema.invalid',
        location: expect.objectContaining({
          stage: 'bridge-in',
          stageIndex: 0,
          stepId: 'step-1',
          stepIndex: 0,
          moduleId: 'module-1',
          moduleIndex: 0,
        }),
      }),
    ]);
  });

  it('hashes canonical content deterministically and invalidates every validated dimension', () => {
    const manifest = validManifest();
    const reordered = {
      stages: manifest.stages,
      durationSeconds: manifest.durationSeconds,
      title: manifest.title,
      lessonId: manifest.lessonId,
      schemaVersion: manifest.schemaVersion,
    };
    const baseHash = computeGeneratedSlideContentHash(manifest);

    expect(computeGeneratedSlideContentHash({ b: 2, a: 1 })).toBe(
      'sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
    );
    expect(computeGeneratedSlideContentHash(reordered)).toBe(baseHash);
    for (const mutate of [
      (copy: GeneratedSlideManifest) => { copy.title = 'Changed'; },
      (copy: GeneratedSlideManifest) => { copy.stages[0].durationSeconds += 1; },
      (copy: GeneratedSlideManifest) => { copy.stages[0].steps[0].layoutId = 'stacked'; },
      (copy: GeneratedSlideManifest) => { copy.stages[0].steps[0].modules[0].payload = { text: 'Changed' }; },
      (copy: GeneratedSlideManifest) => { copy.stages[0].steps[0].modules[0].roleMetadata.studentVisible = false; },
    ]) {
      const copy = structuredClone(manifest);
      mutate(copy);
      expect(computeGeneratedSlideContentHash(copy)).not.toBe(baseHash);
    }
  });
});

function validManifest(): GeneratedSlideManifest {
  return {
    schemaVersion: 'generated-slide-v1',
    lessonId: 'lesson-938',
    title: 'Generated courseware contract',
    durationSeconds: 360,
    stages: BOPPPS_STAGES.map((stage, index) => ({
      stage,
      durationSeconds: 60,
      steps: [{
        id: `step-${index + 1}`,
        title: `Step ${index + 1}`,
        durationSeconds: 60,
        layoutId: 'single',
        modules: [contentModule(`module-${index + 1}`, 'main', 'full')],
      }],
    })),
  };
}

function contentModule(id: string, slotId: string, sizeId: string): GeneratedSlideManifest['stages'][number]['steps'][number]['modules'][number] {
  return {
    id,
    canonicalClass: 'content.rich',
    slotId,
    sizeId,
    payload: { text: `Content for ${id}.` },
    roleMetadata: {
      studentVisible: true,
      teacherVisible: true,
      referenceAnswerVisibility: 'none',
    },
  };
}

function activityModule(
  id: string,
  slotId: string,
  sizeId: string,
  responseKind: 'choice.single' | 'choice.multi' | 'text.short' | 'text.long' | 'ordering.sequence' | 'matching.pairs',
  payload: Record<string, unknown>,
): GeneratedSlideManifest['stages'][number]['steps'][number]['modules'][number] {
  return {
    id,
    canonicalClass: 'activity.panel',
    slotId,
    sizeId,
    responseKind,
    evidencePath: `responses.step-1.${id}`,
    payload,
    roleMetadata: {
      studentVisible: true,
      teacherVisible: true,
      referenceAnswerVisibility: 'teacher-only',
    },
  };
}
