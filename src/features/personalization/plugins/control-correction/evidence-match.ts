import { asRecord, readString } from '../json';
import {
  CONTROL_CORRECTION_ARENA_TASK_IDS,
  CONTROL_CORRECTION_COURSE_IDS,
  CONTROL_CORRECTION_GOAL_ID,
} from './mappings';

export function explicitAdaptiveGoalValues(fact: Record<string, unknown>): string[] {
  const context = asRecord(fact.contextJson);
  return [
    readString(context.goalId),
    readString(context.goal),
    readString(context.targetGoal),
    readString(context.learningGoal),
  ].filter((value): value is string => value !== null);
}

export function hasExplicitAdaptiveGoal(fact: Record<string, unknown>): boolean {
  return explicitAdaptiveGoalValues(fact).length > 0;
}

export function isControlCorrectionArenaTaskId(
  taskId: string | null | undefined,
): taskId is string {
  return typeof taskId === 'string' && CONTROL_CORRECTION_ARENA_TASK_IDS.has(taskId);
}

export function isControlCorrectionArenaFact(fact: Record<string, unknown>): boolean {
  const context = asRecord(fact.contextJson);
  return isControlCorrectionArenaTaskId(readString(asRecord(context.arena).taskId));
}

export function isLegacyControlCorrectionFact(
  fact: Record<string, unknown>,
  context: Record<string, unknown> = asRecord(fact.contextJson),
): boolean {
  return [
    readString(fact.courseId),
    readString(fact.lessonId),
    readString(fact.moduleId),
    readString(asRecord(context.adaptiveAssessment).courseId),
    readString(asRecord(context.adaptiveAssessment).lessonId),
    readString(asRecord(context.adaptiveAssessment).moduleId),
    readString(asRecord(context.simulation).courseId),
    readString(asRecord(context.simulation).lessonId),
    readString(asRecord(context.simulation).taskId),
    readString(asRecord(asRecord(context.simulation).summary).sourceId),
    readString(asRecord(asRecord(context.simulation).summary).taskId),
    readString(asRecord(context.agentTool).courseId),
    readString(asRecord(context.agentTool).lessonId),
    readString(asRecord(context.agentTool).taskId),
  ].some((value) => value !== null && CONTROL_CORRECTION_COURSE_IDS.has(value))
    || [
      readString(asRecord(context.arena).taskId),
      readString(asRecord(context.simulation).taskId),
      readString(asRecord(asRecord(context.simulation).summary).taskId),
      readString(asRecord(context.agentTool).taskId),
    ].some((value) => value !== null && CONTROL_CORRECTION_ARENA_TASK_IDS.has(value));
}

export function isControlCorrectionFact(fact: Record<string, unknown>): boolean {
  const explicitGoalValues = explicitAdaptiveGoalValues(fact);
  if (explicitGoalValues.length > 0) {
    return explicitGoalValues.every((value) => value === CONTROL_CORRECTION_GOAL_ID);
  }
  return isLegacyControlCorrectionFact(fact);
}

export function controlCorrectionJsonPathWhere(
  paths: string[][],
  values: readonly string[],
) {
  return paths.flatMap((path) => values.map((value) => ({
    contextJson: { path, equals: value },
  })));
}

export function buildExplicitControlCorrectionLearningFactWhere(userId: string) {
  return {
    userId,
    OR: [
      { contextJson: { path: ['goalId'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['goal'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['targetGoal'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['learningGoal'], equals: CONTROL_CORRECTION_GOAL_ID } },
    ],
  };
}

export function buildLegacyControlCorrectionLearningFactWhere(userId: string) {
  const courseIds = [...CONTROL_CORRECTION_COURSE_IDS];
  const arenaTaskIds = [...CONTROL_CORRECTION_ARENA_TASK_IDS];
  return {
    userId,
    OR: [
      { courseId: { in: courseIds } },
      { lessonId: { in: courseIds } },
      { moduleId: { in: courseIds } },
      ...controlCorrectionJsonPathWhere(
        [
          ['adaptiveAssessment', 'courseId'],
          ['adaptiveAssessment', 'lessonId'],
          ['adaptiveAssessment', 'moduleId'],
          ['simulation', 'courseId'],
          ['simulation', 'lessonId'],
          ['simulation', 'taskId'],
          ['simulation', 'summary', 'sourceId'],
          ['simulation', 'summary', 'taskId'],
          ['agentTool', 'courseId'],
          ['agentTool', 'lessonId'],
          ['agentTool', 'taskId'],
        ],
        courseIds,
      ),
      ...controlCorrectionJsonPathWhere(
        [
          ['arena', 'taskId'],
          ['simulation', 'taskId'],
          ['simulation', 'summary', 'taskId'],
          ['agentTool', 'taskId'],
        ],
        arenaTaskIds,
      ),
    ],
  };
}
