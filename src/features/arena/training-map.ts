import {
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
} from './data/seed-challenges';
import type { ArenaTrainingCapabilityId, ArenaTrainingStageId, ChallengeTask } from './types';

const stageOrder = Object.keys(ARENA_TRAINING_STAGE_LABELS) as ArenaTrainingStageId[];

export interface ArenaTrainingStageGroup {
  stage: ArenaTrainingStageId;
  label: string;
  tasks: ChallengeTask[];
}
export interface ArenaTrainingCapabilityGroup {
  capability: ArenaTrainingCapabilityId;
  label: string;
  tasks: ChallengeTask[];
}

export function getArenaTrainingStageGroups(tasks: readonly ChallengeTask[]): ArenaTrainingStageGroup[] {
  return stageOrder
    .map((stage) => ({
      stage,
      label: ARENA_TRAINING_STAGE_LABELS[stage],
      tasks: tasks.filter((task) => task.training.stage === stage),
    }))
    .filter((group) => group.tasks.length > 0);
}

export function getArenaTrainingCapabilityGroups(tasks: readonly ChallengeTask[]): ArenaTrainingCapabilityGroup[] {
  const capabilityIds = Object.keys(ARENA_TRAINING_CAPABILITY_LABELS) as ArenaTrainingCapabilityId[];

  return capabilityIds
    .map((capability) => ({
      capability,
      label: ARENA_TRAINING_CAPABILITY_LABELS[capability],
      tasks: tasks.filter((task) => task.training.capabilityTags.includes(capability)),
    }))
    .filter((group) => group.tasks.length > 0);
}

export function getArenaNextChallengeCandidates(
  currentTask: ChallengeTask,
  tasks: readonly ChallengeTask[],
): ChallengeTask[] {
  const currentCapabilities = new Set(currentTask.training.capabilityTags);
  const currentStageIndex = stageOrder.indexOf(currentTask.training.stage);

  return tasks
    .filter((task) => task.id !== currentTask.id)
    .filter((task) => {
      const taskStageIndex = stageOrder.indexOf(task.training.stage);
      const hasPrerequisiteOverlap = task.training.prerequisiteCapabilityTags.some((capability) =>
        currentCapabilities.has(capability),
      );

      return taskStageIndex >= currentStageIndex && hasPrerequisiteOverlap;
    })
    .slice(0, 3);
}
