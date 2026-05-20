import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export type ManifestSubmissionEvidenceCategory =
  | 'objective'
  | 'drag-match-sort'
  | 'parameter'
  | 'simulation'
  | 'subjective'
  | 'training-result';

export interface ManifestSubmissionGateInventoryItem {
  lessonId: string;
  routeSegment: string;
  manifestPath: string;
  studentPagePath: string;
  manifestGetterName: string;
  minimumResponseSteps: number;
}

export interface ManifestResponseProducingStep {
  lessonId?: string;
  stepId: string;
  interactionKind: string;
  categories: ManifestSubmissionEvidenceCategory[];
}

export interface ManifestSubmissionGateViolation {
  lessonId: string;
  routeSegment: string;
  code:
    | 'missing-response-step-inventory'
    | 'missing-useManifestSubmissionController'
    | 'missing-submitManifestStepResponse'
    | 'missing-manifest-step-getter'
    | 'direct-course-submit-event';
  message: string;
  stepIds?: string[];
}

export interface ManifestSubmissionPageGateInput {
  lessonId: string;
  routeSegment: string;
  manifestGetterName: string;
  studentPageSource: string;
  responseSteps: ManifestResponseProducingStep[];
  minimumResponseSteps?: number;
}

const OBJECTIVE_RESPONSE_KINDS = new Set([
  'single_choice',
  'binary_choice',
  'multi_choice',
  'multi_select',
]);

const ORDERED_RESPONSE_KINDS = new Set([
  'drag_match',
  'triple_match',
  'drag_sort',
  'card_sort',
]);

const TRAINING_INTERACTION_KINDS = new Set([
  'rust_toy_training_panel',
  'rust_heading_rl_training_panel',
]);

function uniqueSortedCategories(categories: ManifestSubmissionEvidenceCategory[]) {
  return Array.from(new Set(categories)).sort();
}

export function classifyManifestResponseStep(
  step: InteractiveRuntimeStepManifest,
): ManifestSubmissionEvidenceCategory[] {
  const categories: ManifestSubmissionEvidenceCategory[] = [];
  const responseKinds = (step.interactionSpec.activityCards ?? []).map((card) => card.responseKind);

  for (const kind of responseKinds) {
    if (OBJECTIVE_RESPONSE_KINDS.has(kind)) categories.push('objective');
    else if (ORDERED_RESPONSE_KINDS.has(kind)) categories.push('drag-match-sort');
    else if (kind === 'parameter_set') categories.push('parameter');
    else categories.push('subjective');
  }

  if (step.interactionSpec.interactionKind === 'parameter_slider') {
    categories.push('parameter');
  }
  if (step.interactionSpec.interactionKind === 'interactive_figure_submit') {
    categories.push('simulation');
  }
  if (TRAINING_INTERACTION_KINDS.has(step.interactionSpec.interactionKind)) {
    categories.push('training-result');
  }

  return uniqueSortedCategories(categories);
}

export function collectManifestResponseProducingSteps(
  manifest: InteractiveRuntimeManifest,
  lessonId?: string,
): ManifestResponseProducingStep[] {
  return manifest.steps
    .map((step) => ({
      lessonId,
      stepId: step.id,
      interactionKind: step.interactionSpec.interactionKind,
      categories: classifyManifestResponseStep(step),
    }))
    .filter((item) => item.categories.length > 0);
}

export function evaluateManifestSubmissionPageGate({
  lessonId,
  routeSegment,
  manifestGetterName,
  studentPageSource,
  responseSteps,
  minimumResponseSteps = 1,
}: ManifestSubmissionPageGateInput) {
  const violations: ManifestSubmissionGateViolation[] = [];
  const responseStepIds = responseSteps.map((step) => step.stepId);

  if (responseSteps.length < minimumResponseSteps) {
    violations.push({
      lessonId,
      routeSegment,
      code: 'missing-response-step-inventory',
      message: `${lessonId} has ${responseSteps.length} response-producing steps; expected at least ${minimumResponseSteps}.`,
      stepIds: responseStepIds,
    });
  }

  if (responseSteps.length === 0) {
    return {
      lessonId,
      routeSegment,
      responseStepCount: 0,
      passed: violations.length === 0,
      violations,
    };
  }

  if (!studentPageSource.includes('useManifestSubmissionController')) {
    violations.push({
      lessonId,
      routeSegment,
      code: 'missing-useManifestSubmissionController',
      message: `${lessonId} ${routeSegment} does not initialize the shared manifest submission controller.`,
      stepIds: responseStepIds,
    });
  }

  if (!studentPageSource.includes('submitManifestStepResponse')) {
    violations.push({
      lessonId,
      routeSegment,
      code: 'missing-submitManifestStepResponse',
      message: `${lessonId} ${routeSegment} does not submit responses through submitManifestStepResponse.`,
      stepIds: responseStepIds,
    });
  }

  if (!studentPageSource.includes(manifestGetterName)) {
    violations.push({
      lessonId,
      routeSegment,
      code: 'missing-manifest-step-getter',
      message: `${lessonId} ${routeSegment} does not pass ${manifestGetterName} into the shared submission path.`,
      stepIds: responseStepIds,
    });
  }

  if (
    studentPageSource.includes('COURSE_EVENT_TYPES.LESSON_SUBMIT')
    || studentPageSource.includes('COURSE_EVENT_TYPES.LESSON_RESUBMIT')
  ) {
    violations.push({
      lessonId,
      routeSegment,
      code: 'direct-course-submit-event',
      message: `${lessonId} ${routeSegment} emits lesson submit events directly instead of using the shared evidence path.`,
      stepIds: responseStepIds,
    });
  }

  return {
    lessonId,
    routeSegment,
    responseStepCount: responseSteps.length,
    passed: violations.length === 0,
    violations,
  };
}

export function assertRequiredLessonsInGateInventory(
  inventory: ManifestSubmissionGateInventoryItem[],
  requiredLessonIds: string[],
) {
  const lessonIds = new Set(inventory.map((item) => item.lessonId));
  return requiredLessonIds
    .filter((lessonId) => !lessonIds.has(lessonId))
    .map((lessonId): ManifestSubmissionGateViolation => ({
      lessonId,
      routeSegment: '',
      code: 'missing-response-step-inventory',
      message: `${lessonId} is missing from the response-producing lesson inventory.`,
    }));
}
