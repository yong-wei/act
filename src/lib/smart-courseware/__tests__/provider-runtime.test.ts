import { afterEach, describe, expect, it, vi } from 'vitest';

import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  createDeterministicCoursewareStage,
  deriveCoursewareApprovedPlanAlignment,
  parsePersistedCoursewareStageOutput,
  resolveSmartCoursewareStructuredProvider,
} from '../provider-runtime';
import {
  createCoursewareGeneratedStageProviderOutputSchema,
  coursewareGeneratedStageOutputSchema,
  coursewareModuleCandidateOutputSchema,
  legacyCoursewareGeneratedStageOutputSchema,
} from '../schema';

describe('smart courseware provider runtime', () => {
  const approvedPlan = validPlanFixture();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds deterministic registered stages with executable required activities', () => {
    const pre = createDeterministicCoursewareStage({ unitKey: 'pre-assessment', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture });
    expect(pre.stage).toMatchObject({ stage: 'pre-assessment', durationSeconds: 300 });
    expect(pre.approvedPlanAlignment).toEqual(deriveCoursewareApprovedPlanAlignment(
      validateSmartLessonPlan(approvedPlan),
      'pre-assessment',
    ));
    expect(pre.stage.steps[0].modules[0]).toMatchObject({
      canonicalClass: 'activity.panel', responseKind: 'choice.single',
    });
    expect(pre.moduleMetadata[0]).toMatchObject({
      sourceState: 'verified',
      sourceBindings: [sourceBindingFixture],
      teacherFields: { inclusionRationale: expect.any(String) },
    });
  });

  it('generates courseware steps from a finer approved outline than the lesson-stage steps', () => {
    const plan = validPlanFixture();
    plan.coursewareStepOutline = [
      { title: '情境导入', bopppsStage: 'bridgeIn', minutes: 2 },
      { title: '问题聚焦', bopppsStage: 'bridgeIn', minutes: 3 },
      ...plan.coursewareStepOutline.filter((step) => step.bopppsStage !== 'bridgeIn'),
    ];
    const approved = validateSmartLessonPlan(plan);

    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: approved, sourceBinding: sourceBindingFixture,
    });
    expect(approved.boppps.bridgeIn.steps).toHaveLength(1);
    expect(output.stage.steps.map((step) => [step.title, step.durationSeconds])).toEqual([
      ['情境导入', 120], ['问题聚焦', 180],
    ]);
    expect(output.stepPlanBindings.map((binding) => binding.approvedOutlineIndex)).toEqual([0, 1]);
  });

  it('still rejects a courseware outline whose stage and total minutes do not match the plan', () => {
    const plan = validPlanFixture();
    plan.coursewareStepOutline = [
      { title: '情境导入', bopppsStage: 'bridgeIn', minutes: 2 },
      { title: '问题聚焦', bopppsStage: 'bridgeIn', minutes: 4 },
      ...plan.coursewareStepOutline.filter((step) => step.bopppsStage !== 'bridgeIn'),
    ];
    expect(() => validateSmartLessonPlan(plan)).toThrow();
  });

  it('fails closed when the fixture provider is requested in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMART_COURSEWARE_E2E_FIXTURE_TOKEN', 'smart-courseware-real-browser-v1');
    await expect(resolveSmartCoursewareStructuredProvider()).rejects.toMatchObject({ code: 'fixture-provider-forbidden' });
  });

  it.each([
    ['stage generation', coursewareGeneratedStageOutputSchema],
    ['module candidate generation', coursewareModuleCandidateOutputSchema],
  ])('rejects verified %s output without a non-blank inclusion rationale', (_label, schema) => {
    const stage = createDeterministicCoursewareStage({
      unitKey: 'summary', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    const output: unknown = schema === coursewareGeneratedStageOutputSchema
      ? stage
      : { runtimeModule: stage.stage.steps[0].modules[0], moduleMetadata: stage.moduleMetadata[0] };
    const metadata = stage.moduleMetadata[0];
    delete metadata.teacherFields.inclusionRationale;
    expect(() => schema.parse(output)).toThrow();
    metadata.teacherFields.inclusionRationale = '   ';
    expect(() => schema.parse(output)).toThrow();
  });

  it('rejects provider ordering output with normalized duplicate items', () => {
    const output = createDeterministicCoursewareStage({
      unitKey: 'pre-assessment', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    const runtimeModule = output.stage.steps[0].modules[0];
    runtimeModule.responseKind = 'ordering.sequence';
    runtimeModule.payload = { prompt: '排序', items: ['Step A', ' step a '] };
    output.moduleMetadata[0].teacherFields.referenceAnswer = 'Step A|step a';

    expect(() => coursewareGeneratedStageOutputSchema.parse(output)).toThrowError(expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: 'ordering items must be unique after normalization' }),
      ]),
    }));
  });

  it('keeps the legacy metadata limit while allowing the current manifest-wide limit', () => {
    const current = createDeterministicCoursewareStage({
      unitKey: 'summary', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    current.moduleMetadata = Array.from({ length: 31 }, (_, index) => ({
      ...structuredClone(current.moduleMetadata[0]),
      moduleId: `module-${index}`,
    }));
    expect(() => coursewareGeneratedStageOutputSchema.parse(current)).not.toThrow();

    const { approvedPlanAlignment: _alignment, stepPlanBindings: _bindings, ...legacy } = current;
    legacy.moduleMetadata = legacy.moduleMetadata.slice(0, 13);
    expect(() => legacyCoursewareGeneratedStageOutputSchema.parse(legacy)).toThrow();
  });

  it('accepts only stage content from the provider and strips server-owned fields', () => {
    const output = createDeterministicCoursewareStage({
      unitKey: 'summary', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    const schema = createCoursewareGeneratedStageProviderOutputSchema(1);
    expect(schema.parse(output)).toEqual({ stage: output.stage, teacherActivityEvidence: [] });
    output.moduleMetadata[0].sourceBindings[0].citationId = 'provider-rewritten-citation';
    expect(schema.parse(output)).toEqual({ stage: output.stage, teacherActivityEvidence: [] });
    output.stage.steps.push(structuredClone(output.stage.steps[0]));
    expect(() => schema.parse(output)).toThrow();
    output.stage.steps.pop();
    output.stage.steps[0].layoutId = 'slide';
    expect(() => schema.parse(output)).toThrow();
    output.stage.steps[0].layoutId = 'single';
    output.stage.steps[0].modules[0].canonicalClass = 'text';
    expect(() => schema.parse(output)).toThrow();
    const activitySchema = createCoursewareGeneratedStageProviderOutputSchema(1, true);
    expect(() => activitySchema.parse(createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    }))).toThrow();
    const activity = createDeterministicCoursewareStage({
      unitKey: 'pre-assessment', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    expect(activitySchema.parse({
      stage: activity.stage,
      teacherActivityEvidence: [{
        moduleId: activity.stage.steps[0].modules[0].id,
        referenceAnswer: 'a', explanation: '教师专用说明', scoring: { strategy: 'exact-match' },
      }],
    })).toMatchObject({ stage: activity.stage });
    const placeholderOption = {
      stage: activity.stage,
      teacherActivityEvidence: [{
        moduleId: activity.stage.steps[0].modules[0].id,
        referenceAnswer: 'a', explanation: '教师专用说明', scoring: { strategy: 'exact-match' },
      }],
    };
    const placeholderModule = placeholderOption.stage.steps[0].modules[0] as unknown as {
      payload: { options: Array<{ label: string }> };
    };
    placeholderModule.payload.options[0].label = 'A';
    expect(() => activitySchema.parse(placeholderOption)).toThrow();
  });

  it.each([
    ['choice values', 'choice.single', { prompt: '选择', options: [{ value: 'A', label: '甲' }, { value: ' a ', label: '乙' }] }],
    ['choice labels', 'choice.multi', { prompt: '选择', options: [{ value: 'a', label: 'Same' }, { value: 'b', label: ' same ' }] }],
    ['matching left values', 'matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'A', label: '甲' }, { value: ' a ', label: '乙' }],
      right: [{ value: 'x', label: '子' }, { value: 'y', label: '丑' }],
    }],
    ['matching right labels', 'matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }],
      right: [{ value: 'x', label: 'Same' }, { value: 'y', label: ' same ' }],
    }],
  ])('rejects normalized duplicate %s', (_label, responseKind, payload) => {
    const output = createDeterministicCoursewareStage({
      unitKey: 'pre-assessment', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    Object.assign(output.stage.steps[0].modules[0], { responseKind, payload });
    expect(() => coursewareGeneratedStageOutputSchema.parse(output)).toThrow();
  });

  it('returns stable fixture identities outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SMART_COURSEWARE_E2E_FIXTURE_TOKEN', 'smart-courseware-real-browser-v1');
    const runtime = await resolveSmartCoursewareStructuredProvider();
    const fixture = createDeterministicCoursewareStage({ unitKey: 'summary', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture });
    const result = await runtime.generate({
      schema: (await import('../schema')).coursewareGeneratedStageOutputSchema,
      schemaVersion: 'smart-courseware-stage-summary.v2', system: 'test', prompt: 'test',
      idempotencyKey: 'fixture-key', fixtureOutput: fixture,
    });
    expect(result.output).toEqual(fixture);
    expect(result.normalizedResponseId).toMatch(/^fixture:/);
  });

  it('accepts legacy persisted output only when the successful attempt declares the v1 schema', () => {
    const current = createDeterministicCoursewareStage({
      unitKey: 'summary', durationSeconds: 300, approvedPlan, sourceBinding: sourceBindingFixture,
    });
    const { approvedPlanAlignment: _alignment, stepPlanBindings: _bindings, ...legacy } = current;
    expect(parsePersistedCoursewareStageOutput({
      output: legacy, unitKey: 'summary', schemaVersion: 'smart-courseware-stage-summary.v1',
    })).toEqual(legacy);
    expect(() => parsePersistedCoursewareStageOutput({
      output: legacy, unitKey: 'summary', schemaVersion: 'smart-courseware-stage-summary.v2',
    })).toThrow();
    expect(() => parsePersistedCoursewareStageOutput({
      output: legacy, unitKey: 'summary', schemaVersion: undefined,
    })).toThrowError(expect.objectContaining({ code: 'persisted-courseware-stage-schema-version-unsupported' }));
  });
});
