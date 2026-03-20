import type { L2BActivity, L2BStepDefinition } from '@/lib/l2b-course';

export function selectTeacherSummaryActivity(step: L2BStepDefinition): L2BActivity | undefined {
  if (step.teacher.activity && step.teacher.activity.kind !== 'none') {
    return step.teacher.activity;
  }

  if (step.student.activity && step.student.activity.kind !== 'none') {
    return step.student.activity;
  }

  return undefined;
}
