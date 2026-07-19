import { afterEach, describe, expect, it, vi } from 'vitest';

import { sourceBindingFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import { resolveSmartCoursewareStructuredProvider, createDeterministicCoursewareStage } from '../provider-runtime';

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
    expect(pre.moduleMetadata[0]).toMatchObject({ sourceState: 'verified', sourceBindings: [sourceBindingFixture] });
  });

  it('fails closed when the fixture provider is requested in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMART_COURSEWARE_E2E_FIXTURE_TOKEN', 'smart-courseware-real-browser-v1');
    await expect(resolveSmartCoursewareStructuredProvider()).rejects.toMatchObject({ code: 'fixture-provider-forbidden' });
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
