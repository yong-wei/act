import type {
  ArenaBlackBoxExperimentInput,
} from '../blackbox/experiment';
import type {
  ArenaBlackBoxExperimentStore,
  CreateArenaBlackBoxExperimentResult,
} from '../blackbox/experiment-service';
import type {
  ArenaVirtualSimulationPreviewRun,
  ArenaVirtualSimulationRunStore,
} from '../blackbox/controller-preview';
import type { ChallengeObject, ChallengeTask, ControllerArtifact } from '../types';

export interface ArenaPlantAdapterPublicExperimentInput {
  userId: string;
  taskId: string;
  experimentInput: ArenaBlackBoxExperimentInput;
  now?: string;
  store: ArenaBlackBoxExperimentStore;
}

export interface ArenaPlantAdapterVirtualPreviewInput {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  now?: string;
  blackBoxExperimentStore: ArenaBlackBoxExperimentStore;
  runStore: ArenaVirtualSimulationRunStore;
}

export interface ArenaPlantAdapter {
  id: string;
  canRunPublicExperiment(task: ChallengeTask, object: ChallengeObject): boolean;
  runPublicExperiment(input: ArenaPlantAdapterPublicExperimentInput): Promise<CreateArenaBlackBoxExperimentResult>;
  canRunVirtualPreview(task: ChallengeTask, object: ChallengeObject): boolean;
  runVirtualPreview(input: ArenaPlantAdapterVirtualPreviewInput): Promise<ArenaVirtualSimulationPreviewRun & { id: string }>;
}
