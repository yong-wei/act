import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import type { ControllerMethod } from '../types';
import {
  BLACKBOX_PROTOCOL_VERSION,
  BLACKBOX_OFFICIAL_PROTOCOL_VERSION,
  CODE_SANDBOX_DISABLED_PROTOCOL_VERSION,
  TEMPLATE_WHITEBOX_PROTOCOL_VERSION,
} from './protocol-versions';
import { isTemplateWhiteBoxMethod, selectWhiteBoxMetricProvider } from './whitebox-metric-provider';

export {
  ANALYSIS_WHITEBOX_PROTOCOL_VERSION,
  TEMPLATE_WHITEBOX_PROTOCOL_VERSION,
  BLACKBOX_PROTOCOL_VERSION,
  BLACKBOX_OFFICIAL_PROTOCOL_VERSION,
  CODE_SANDBOX_DISABLED_PROTOCOL_VERSION,
} from './protocol-versions';

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
    return BLACKBOX_OFFICIAL_PROTOCOL_VERSION;
  }
  const method = input.method ?? task?.allowedMethods.find(isTemplateWhiteBoxMethod);
  if (method && isTemplateWhiteBoxMethod(method)) {
    return selectWhiteBoxMetricProvider(method).protocolVersion;
  }
  return TEMPLATE_WHITEBOX_PROTOCOL_VERSION;
}
