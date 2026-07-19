import { describe, expect, it } from 'vitest';

import { validateSmartLessonPlan } from '../schema';
import { sourceBindingFixture as binding, validPlanFixture as validPlan } from './fixtures';

describe('complete BOPPPS lesson plan contract', () => {
  it('accepts a complete plan whose stage, nested-step, and outline timings are exact', () => {
    expect(validateSmartLessonPlan(validPlan(), 30).durationMinutes).toBe(30);
  });

  it('rejects stage totals, nested step totals, and task duration disagreement', () => {
    const wrongStageTotal = validPlan();
    wrongStageTotal.boppps.summary.minutes = 10;
    expect(() => validateSmartLessonPlan(wrongStageTotal)).toThrow(/boppps-duration-mismatch|stage-step-duration-mismatch/);

    const wrongNestedTotal = validPlan();
    wrongNestedTotal.boppps.bridgeIn.steps[0].minutes = 4;
    expect(() => validateSmartLessonPlan(wrongNestedTotal)).toThrow(/stage-step-duration-mismatch/);

    expect(() => validateSmartLessonPlan(validPlan(), 45)).toThrow(/task-duration-mismatch/);
  });

  it('requires pending goals to retain a gap and verified goals to retain citations without a gap', () => {
    const missingGap = validPlan();
    missingGap.goals[0].gapIdentity = null as never;
    expect(() => validateSmartLessonPlan(missingGap)).toThrow(/pending-goal-gap-required/);

    const verifiedWithGap = validPlan();
    verifiedWithGap.goals[0] = { ...verifiedWithGap.goals[0], sourceState: 'VERIFIED', sourceBindings: [binding] } as never;
    expect(() => validateSmartLessonPlan(verifiedWithGap)).toThrow(/verified-goal-source-invalid/);
  });

  it('applies the same source-gap contract to knowledge points and aligns the outline per BOPPPS stage', () => {
    const pendingPointWithoutGap = validPlan();
    pendingPointWithoutGap.knowledgePoints[0] = {
      ...pendingPointWithoutGap.knowledgePoints[0],
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
      gapIdentity: null,
    } as never;
    expect(() => validateSmartLessonPlan(pendingPointWithoutGap)).toThrow(/pending-knowledge-gap-required/);

    const misplacedOutlineTime = validPlan();
    misplacedOutlineTime.coursewareStepOutline[0].bopppsStage = 'objectives';
    expect(() => validateSmartLessonPlan(misplacedOutlineTime)).toThrow(/courseware-stage-duration-mismatch/);
  });
});
