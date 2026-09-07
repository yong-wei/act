const EXERCISE_STEP_BY_RESOURCE_ID: Readonly<Record<string, {
  lessonKey: string;
  stepId: string;
}>> = {};

export function resolveExerciseStepMapping(
  resourceId: string,
): { lessonKey: string; stepId: string } | null {
  return EXERCISE_STEP_BY_RESOURCE_ID[resourceId] ?? null;
}
