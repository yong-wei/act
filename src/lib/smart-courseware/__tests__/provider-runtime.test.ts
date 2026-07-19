import { afterEach, describe, expect, it, vi } from 'vitest';

import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  createDeterministicCoursewareStage,
  deriveCoursewareApprovedPlanAlignment,
  parsePersistedCoursewareStageOutput,
  resolveSmartCoursewareStructuredProvider,
} from '../provider-runtime';
import { coursewareGeneratedStageOutputSchema, coursewareModuleCandidateOutputSchema } from '../schema';

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

  it('retains every legal outline title but rejects a plan whose two step outlines cannot map one-to-one', () => {
    const plan = validPlanFixture();
    plan.durationMinutes = 60;
    plan.boppps.bridgeIn.minutes = 35;
    plan.boppps.bridgeIn.steps[0].minutes = 35;
    plan.coursewareStepOutline = [
      ...Array.from({ length: 30 }, (_, index) => ({ title: `导入 ${index + 1}`, bopppsStage: 'bridgeIn', minutes: 1 })),
      { title: '导入 31', bopppsStage: 'bridgeIn', minutes: 5 },
      ...plan.coursewareStepOutline.filter((step) => step.bopppsStage !== 'bridgeIn'),
    ];
    const approved = validateSmartLessonPlan(plan);

    expect(deriveCoursewareApprovedPlanAlignment(approved, 'bridge-in').stageOutlineTitles).toHaveLength(31);
    expect(() => createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 2_100, approvedPlan: approved, sourceBinding: sourceBindingFixture,
    })).toThrowError(expect.objectContaining({ code: 'approved-plan-courseware-outline-inconsistent' }));
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
