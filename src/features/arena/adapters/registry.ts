import {
  getArenaChallengeObject,
  getArenaChallengeTask,
} from '../data/seed-challenges';
import type { ChallengeObject, ChallengeTask } from '../types';
import { cruiseRollBlackBoxAdapter } from './cruise-roll-blackbox-adapter';
import type { ArenaPlantAdapter } from './types';
import {
  supportsWhiteBoxTransferFunction,
  whiteBoxTransferFunctionAdapter,
} from './whitebox-transfer-function-adapter';

export class ArenaPlantAdapterSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaPlantAdapterSelectionError';
  }
}

export function getArenaPlantAdapterForObject(
  object: ChallengeObject,
  task: ChallengeTask,
): ArenaPlantAdapter {
  if (cruiseRollBlackBoxAdapter.canRunPublicExperiment(task, object) ||
    cruiseRollBlackBoxAdapter.canRunVirtualPreview(task, object)) {
    return cruiseRollBlackBoxAdapter;
  }

  if (supportsWhiteBoxTransferFunction(task, object)) {
    return whiteBoxTransferFunctionAdapter;
  }

  throw new ArenaPlantAdapterSelectionError(
    `No production Arena plant adapter supports task ${task.id} and object ${object.id}.`,
  );
}

function getArenaTaskAndObject(taskId: string): { task: ChallengeTask; object: ChallengeObject } {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new ArenaPlantAdapterSelectionError(`No production Arena plant adapter supports task ${taskId}.`);
  }

  const object = getArenaChallengeObject(task.objectId);
  if (!object) {
    throw new ArenaPlantAdapterSelectionError(
      `No production Arena plant adapter supports task ${task.id}: object ${task.objectId} is missing.`,
    );
  }

  return { task, object };
}

export function getArenaPlantAdapterForTaskId(taskId: string): ArenaPlantAdapter {
  const { task, object } = getArenaTaskAndObject(taskId);
  return getArenaPlantAdapterForObject(object, task);
}

export function getArenaPlantAdapterForPublicExperimentTaskId(taskId: string): ArenaPlantAdapter {
  const { task, object } = getArenaTaskAndObject(taskId);
  const adapter = getArenaPlantAdapterForObject(object, task);
  if (!adapter.canRunPublicExperiment(task, object)) {
    throw new ArenaPlantAdapterSelectionError(
      `No production Arena plant adapter supports public experiments for task ${task.id}.`,
    );
  }
  return adapter;
}

export function getArenaPlantAdapterForVirtualPreviewTaskId(taskId: string): ArenaPlantAdapter {
  const { task, object } = getArenaTaskAndObject(taskId);
  const adapter = getArenaPlantAdapterForObject(object, task);
  if (!adapter.canRunVirtualPreview(task, object)) {
    throw new ArenaPlantAdapterSelectionError(
      `No production Arena plant adapter supports virtual previews for task ${task.id}.`,
    );
  }
  return adapter;
}

export type { ArenaPlantAdapter };
