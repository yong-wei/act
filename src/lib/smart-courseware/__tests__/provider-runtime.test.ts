import { afterEach, describe, expect, it, vi } from 'vitest';

import { sourceBindingFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import { resolveSmartCoursewareStructuredProvider, createDeterministicCoursewareStage } from '../provider-runtime';
import { coursewareGeneratedStageOutputSchema, coursewareModuleCandidateOutputSchema } from '../schema';

describe('smart courseware provider runtime', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds deterministic registered stages with executable required activities', () => {
    const pre = createDeterministicCoursewareStage({ unitKey: 'pre-assessment', durationSeconds: 300, sourceBinding: sourceBindingFixture });
    expect(pre.stage).toMatchObject({ stage: 'pre-assessment', durationSeconds: 300 });
    expect(pre.stage.steps[0].modules[0]).toMatchObject({
      canonicalClass: 'activity.panel', responseKind: 'choice.single',
    });
    expect(pre.moduleMetadata[0]).toMatchObject({
      sourceState: 'verified',
      sourceBindings: [sourceBindingFixture],
      teacherFields: { inclusionRationale: expect.any(String) },
    });
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
      unitKey: 'summary', durationSeconds: 300, sourceBinding: sourceBindingFixture,
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
      unitKey: 'pre-assessment', durationSeconds: 300, sourceBinding: sourceBindingFixture,
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
      unitKey: 'pre-assessment', durationSeconds: 300, sourceBinding: sourceBindingFixture,
    });
    Object.assign(output.stage.steps[0].modules[0], { responseKind, payload });
    expect(() => coursewareGeneratedStageOutputSchema.parse(output)).toThrow();
  });

  it('returns stable fixture identities outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SMART_COURSEWARE_E2E_FIXTURE_TOKEN', 'smart-courseware-real-browser-v1');
    const runtime = await resolveSmartCoursewareStructuredProvider();
    const fixture = createDeterministicCoursewareStage({ unitKey: 'summary', durationSeconds: 300, sourceBinding: sourceBindingFixture });
    const result = await runtime.generate({
      schema: (await import('../schema')).coursewareGeneratedStageOutputSchema,
      schemaVersion: 'smart-courseware-stage-summary.v1', system: 'test', prompt: 'test',
      idempotencyKey: 'fixture-key', fixtureOutput: fixture,
    });
    expect(result.output).toEqual(fixture);
    expect(result.normalizedResponseId).toMatch(/^fixture:/);
  });
});
