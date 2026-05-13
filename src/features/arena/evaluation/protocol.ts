import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';

export const WHITEBOX_PROTOCOL_VERSION = 'whitebox-v1';
export const BLACKBOX_PROTOCOL_VERSION = 'blackbox-v1';

export function getArenaEvaluationProtocolVersion(taskId: string): string {
  const task = getArenaChallengeTask(taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  if (object?.visibility === 'black-box') {
    return BLACKBOX_PROTOCOL_VERSION;
  }
  return WHITEBOX_PROTOCOL_VERSION;
}
