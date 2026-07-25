type OdysseyArenaAssignment = {
  taskId: string;
  levelId: string;
};

const ODYSSEY_ARENA_ASSIGNMENTS: readonly OdysseyArenaAssignment[] = [
  {
    taskId: 'task-odyssey-level-one-growth',
    levelId: 'level-1',
  },
];

const odysseyLevelByArenaTask = new Map(
  ODYSSEY_ARENA_ASSIGNMENTS.map(({ taskId, levelId }) => [taskId, levelId]),
);

const arenaTaskByOdysseyLevel = new Map(
  ODYSSEY_ARENA_ASSIGNMENTS.map(({ taskId, levelId }) => [levelId, taskId]),
);

export function getOdysseyLevelForArenaTask(taskId: string): string | undefined {
  return odysseyLevelByArenaTask.get(taskId);
}

export function getArenaTaskForOdysseyLevel(levelId: string): string | undefined {
  return arenaTaskByOdysseyLevel.get(levelId);
}

export function isArenaOdysseyAssignment(taskId: string | undefined, levelId: string): boolean {
  return Boolean(taskId && getOdysseyLevelForArenaTask(taskId) === levelId);
}
