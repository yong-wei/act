import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import type { ControllerArtifact } from '../types';
import type { ArenaEvaluationResult } from './types';
import { evaluateBlackBoxSubmission } from './blackbox-evaluator';
import { evaluateWhiteBoxSubmission } from './whitebox-evaluator';

export function getArenaEvaluationProtocolVersion(taskId: string): string {
  const task = getArenaChallengeTask(taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  if (object?.visibility === 'black-box') {
    return 'blackbox-v1';
  }
  return 'whitebox-v1';
}

export function evaluateArenaSubmission({
  taskId,
  artifact,
}: {
  taskId: string;
  artifact: ControllerArtifact;
}): ArenaEvaluationResult {
  const task = getArenaChallengeTask(taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  if (object?.visibility === 'black-box') {
    return evaluateBlackBoxSubmission({ taskId, artifact });
  }
  return evaluateWhiteBoxSubmission({ taskId, artifact });
}
