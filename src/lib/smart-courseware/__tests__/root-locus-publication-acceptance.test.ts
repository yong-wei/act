import { describe, expect, it } from 'vitest';

import { validateGeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';
import { validateCoursewareComposition } from '../domain';
import {
  ROOT_LOCUS_ACCEPTANCE_PROVIDER,
  ROOT_LOCUS_AUTHORITATIVE_ANCHORS,
  ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT,
  ROOT_LOCUS_KONLING_TURNS,
  compareRootLocusManifestAgainstSource,
  rootLocusCoursewareFixture,
} from '../../../../tests/fixtures/root-locus-publication';

describe('45-minute root-locus deterministic publication acceptance fixture', () => {
  it('records one clarification and a later constraint revision in prep-coauthor order', () => {
    expect(ROOT_LOCUS_ACCEPTANCE_PROVIDER).toMatchObject({ providerKind: 'DETERMINISTIC_FIXTURE', acceptanceScope: 'task-3.1-only' });
    expect(ROOT_LOCUS_KONLING_TURNS).toHaveLength(3);
    expect(ROOT_LOCUS_KONLING_TURNS[0]).toHaveProperty('clarification');
    expect(ROOT_LOCUS_KONLING_TURNS[2]).toHaveProperty('revision');
    expect(ROOT_LOCUS_KONLING_TURNS.map((turn) => turn.turn)).toEqual([1, 2, 3]);
  });

  it('produces a source-complete six-stage 45-minute courseware contract', () => {
    const fixture = rootLocusCoursewareFixture();
    const plan = validateSmartLessonPlan(fixture.plan);
    const manifest = validateGeneratedSlideManifest(fixture.composition.runtimeManifest);
    const validation = validateCoursewareComposition(fixture.composition, plan);

    expect(plan.durationMinutes).toBe(45);
    expect(fixture.composition.runtimeManifest.durationSeconds).toBe(2_700);
    expect(fixture.composition.runtimeManifest.stages.map((stage) => stage.stage)).toEqual(fixture.expectedStages);
    expect(fixture.composition.runtimeManifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules)).filter((module) => module.canonicalClass === 'activity.panel').length).toBeGreaterThanOrEqual(3);
    expect(manifest.valid).toBe(true);
    expect(validation.validation.valid).toBe(true);
    expect(plan.goals.every((goal) => goal.sourceState === 'VERIFIED' && goal.gapIdentity === null)).toBe(true);
    expect(fixture.composition.moduleMetadata.every((module) => module.sourceState === 'verified' && module.sourceBindings.length > 0)).toBe(true);
  });

  it('compares at least three generated claims with distinct authoritative anchors', () => {
    const fixture = rootLocusCoursewareFixture();
    expect(ROOT_LOCUS_AUTHORITATIVE_ANCHORS).toHaveLength(3);
    expect(new Set(ROOT_LOCUS_AUTHORITATIVE_ANCHORS.map((anchor) => anchor.anchor)).size).toBe(3);
    expect(fixture.comparisons).toHaveLength(3);
    expect(fixture.comparisons.every((comparison) => comparison.matches
      && comparison.generatedClaimHash === comparison.expectedClaimHash)).toBe(true);
  });

  it('fails the independent source comparison when generated evidence is deleted or tampered', () => {
    const fixture = rootLocusCoursewareFixture();
    const deleted = structuredClone(fixture.composition.runtimeManifest);
    deleted.stages[0].steps[0].modules = [];
    deleted.stages[1].steps[0].modules = [];
    expect(compareRootLocusManifestAgainstSource(ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT, deleted)[0].matches).toBe(false);

    const tampered = JSON.parse(JSON.stringify(fixture.composition.runtimeManifest).replaceAll(
      '由幅值条件计算指定根轨迹点对应的增益。',
      '幅值条件可以被忽略。',
    ));
    expect(compareRootLocusManifestAgainstSource(ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT, tampered)[1].matches).toBe(false);
  });
});
