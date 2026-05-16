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
};
