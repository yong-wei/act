import type { ChallengeObject, ChallengeTask } from '../types';
import type { ArenaPlantAdapter } from './types';

export const whiteBoxTransferFunctionAdapter: ArenaPlantAdapter = {
  id: 'whitebox-transfer-function',

  canRunPublicExperiment() {
    return false;
  },

  async runPublicExperiment() {
    throw new Error('White-box transfer-function objects do not support Arena black-box public experiments.');
  },

  canRunVirtualPreview() {
    return false;
  },

  async runVirtualPreview() {
    throw new Error('White-box transfer-function objects do not support Arena virtual simulation previews.');
  },
};

export function supportsWhiteBoxTransferFunction(task: ChallengeTask, object: ChallengeObject): boolean {
  return task.objectId === object.id &&
    object.visibility === 'white-box' &&
    object.adapterType === 'transfer-function';
}
