import {
  BOPPPS_STAGES,
  GENERATED_SLIDE_SCHEMA_VERSION,
  type GeneratedSlideManifest,
  type GeneratedSlideModule,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

export function validCoursewareManifest(): GeneratedSlideManifest {
  return {
    schemaVersion: GENERATED_SLIDE_SCHEMA_VERSION,
    lessonId: 'smart-courseware-draft',
    title: '闭环稳定性',
    durationSeconds: 1_800,
    stages: BOPPPS_STAGES.map((stage, index) => ({
      stage,
      durationSeconds: 300,
      steps: [{
        id: `step-${index + 1}`,
        title: stage,
        durationSeconds: 300,
        layoutId: 'single',
        modules: [index >= 2 && index <= 4
          ? activityModule(`module-${index + 1}`)
          : contentModule(`module-${index + 1}`)],
      }],
    })),
  };
}

export function validCompositionInput() {
  const runtimeManifest = validCoursewareManifest();
  return {
    expectedVersion: 1,
    runtimeManifest,
    moduleMetadata: runtimeManifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules.map((module) => ({
      moduleId: module.id,
      sourceState: 'verified' as const,
      sourceBindings: [sourceBindingFixture],
      teacherFields: module.canonicalClass === 'activity.panel'
        ? { referenceAnswer: 'a', explanation: '教师专用解释', scoring: { strategy: 'exact-match', maxPoints: 1 } }
        : {},
    })))),
  };
}

export const validPlan = () => validateSmartLessonPlan(validPlanFixture());

function contentModule(id: string): GeneratedSlideModule {
  return {
    id,
    canonicalClass: 'content.rich',
    slotId: 'main',
    sizeId: 'full',
    payload: { text: `Content ${id}` },
    roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
  };
}

function activityModule(id: string): GeneratedSlideModule {
  return {
    id,
    canonicalClass: 'activity.panel',
    slotId: 'main',
    sizeId: 'full',
    responseKind: 'choice.single',
    evidencePath: `responses.${id}`,
    payload: {
      prompt: `Prompt ${id}`,
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    },
    roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
  };
}
