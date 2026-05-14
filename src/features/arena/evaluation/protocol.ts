import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import type { ControllerMethod } from '../types';

export const ANALYSIS_WHITEBOX_PROTOCOL_VERSION = 'analysis-whitebox-v1';
export const TEMPLATE_WHITEBOX_PROTOCOL_VERSION = 'template-whitebox-v1';
export const BLACKBOX_PROTOCOL_VERSION = 'blackbox-v1';
export const CODE_SANDBOX_DISABLED_PROTOCOL_VERSION = 'code-sandbox-disabled-v1';

export function getArenaEvaluationProtocolVersion(input: {
  taskId: string;
  method?: ControllerMethod;
}): string {
  if (input.method === 'code-controller') {
    return CODE_SANDBOX_DISABLED_PROTOCOL_VERSION;
  }
  const task = getArenaChallengeTask(input.taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  if (object?.visibility === 'black-box') {
    return BLACKBOX_PROTOCOL_VERSION;
  }
  return TEMPLATE_WHITEBOX_PROTOCOL_VERSION;
}
