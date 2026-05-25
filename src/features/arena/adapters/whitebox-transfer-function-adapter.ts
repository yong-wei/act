import type { ChallengeObject, ChallengeTask } from '../types';
import type { ArenaPlantAdapter } from './types';

export const whiteBoxTransferFunctionAdapter: ArenaPlantAdapter = {
  id: 'whitebox-transfer-function',

  describeSupport() {
    return {
      publicExperiment: {
        supported: false,
        reason: 'White-box transfer-function objects do not expose black-box public experiment datasets.',
      },
      virtualPreview: {
        supported: false,
        reason: 'White-box transfer-function objects use direct analytical previews instead of Arena virtual simulation preview runs.',
      },
      officialEvaluation: { supported: true },
    };
  },

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

  canRunOfficialEvaluation() {
    return true;
  },
};

export function supportsWhiteBoxTransferFunction(task: ChallengeTask, object: ChallengeObject): boolean {
  return task.objectId === object.id &&
    object.visibility === 'white-box' &&
    Boolean(object.model);
}
