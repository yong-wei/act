import {
  createArenaBlackBoxExperiment,
} from '../blackbox/experiment-service';
import {
  createArenaVirtualSimulationPreviewRun,
} from '../blackbox/controller-preview';
import type { ChallengeObject, ChallengeTask } from '../types';
import type { ArenaPlantAdapter } from './types';

function supportsCruiseRollBlackBox(task: ChallengeTask, object: ChallengeObject): boolean {
  return object.id === 'plant-cruise-roll-blackbox' &&
    object.visibility === 'black-box' &&
    object.adapterType === 'virtual-simulation' &&
    task.objectId === object.id &&
    task.allowedMethods.includes('black-box-control');
}

export const cruiseRollBlackBoxAdapter: ArenaPlantAdapter = {
  id: 'cruise-roll-blackbox-production',

  describeSupport(task, object) {
    const supported = supportsCruiseRollBlackBox(task, object);
    const reason = supported
      ? undefined
      : 'Cruise-roll black-box adapter only supports the cruise-roll virtual simulation identification task.';
    return {
      publicExperiment: supported ? { supported: true } : { supported: false, reason },
      virtualPreview: supported ? { supported: true } : { supported: false, reason },
      officialEvaluation: supported ? { supported: true } : { supported: false, reason },
    };
  },

  canRunPublicExperiment(task, object) {
    return supportsCruiseRollBlackBox(task, object);
  },

  runPublicExperiment(input) {
    return createArenaBlackBoxExperiment(input);
  },

  canRunVirtualPreview(task, object) {
    return supportsCruiseRollBlackBox(task, object);
  },

  runVirtualPreview(input) {
    return createArenaVirtualSimulationPreviewRun(input);
  },

  canRunOfficialEvaluation(task, object) {
    return supportsCruiseRollBlackBox(task, object);
  },
};
