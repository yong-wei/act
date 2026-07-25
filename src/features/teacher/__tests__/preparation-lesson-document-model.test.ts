import { describe, expect, it } from 'vitest';

import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  BOPPPS_STAGES,
  lessonDocumentStage,
  preparationDocumentValidationErrors,
  replaceLessonStageSteps,
  replaceOutlineStageSteps,
} from '../preparation-document-editor/lesson-document-model';

describe('preparation lesson document model', () => {
  it('keeps all six outline stages ordered while editing ordered internal steps', () => {
    const outline = {
      coursewareStepOutline: BOPPPS_STAGES.map(([bopppsStage, title]) => ({
        title,
        bopppsStage,
        minutes: 5,
      })),
    };
    const bridgeSteps = [
      { title: '情境', bopppsStage: 'bridgeIn', minutes: 2 },
      { title: '问题', bopppsStage: 'bridgeIn', minutes: 3 },
    ];

    const updated = replaceOutlineStageSteps(outline, 'bridgeIn', bridgeSteps);

    expect(updated.coursewareStepOutline.map((step) => step.bopppsStage)).toEqual([
      'bridgeIn',
      'bridgeIn',
      'objectives',
      'preAssessment',
      'participatoryLearning',
      'postAssessment',
      'summary',
    ]);
    expect(preparationDocumentValidationErrors('outline', updated, 30)).toEqual([]);
  });

  it('reports missing fixed stages and nested duration mismatches', () => {
    const errors = preparationDocumentValidationErrors('outline', {
      coursewareStepOutline: [{ title: '导入', bopppsStage: 'bridgeIn', minutes: 5 }],
    }, 30);

    expect(errors).toContain('学习目标缺少教学步骤。');
    expect(errors).toContain('六阶段合计 5 分钟，应为 30 分钟。');
  });

  it('recomputes stage and courseware timing from lesson internal steps', () => {
    const plan = validPlanFixture();
    const current = lessonDocumentStage(plan, 'bridgeIn');
    const steps = [
      { ...current.steps[0], title: '问题情境', minutes: 2 },
      { ...current.steps[0], title: '追问', minutes: 3 },
    ];

    const updated = replaceLessonStageSteps(plan, 'bridgeIn', steps);

    expect(lessonDocumentStage(updated, 'bridgeIn')).toMatchObject({ minutes: 5, steps });
    expect(updated.coursewareStepOutline).toEqual(expect.arrayContaining([
      { title: '问题情境', bopppsStage: 'bridgeIn', minutes: 2 },
      { title: '追问', bopppsStage: 'bridgeIn', minutes: 3 },
    ]));
    expect(preparationDocumentValidationErrors('draft', updated, plan.durationMinutes)).toEqual([]);
  });
});
