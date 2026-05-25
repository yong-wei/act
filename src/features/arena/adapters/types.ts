import type {
  ArenaBlackBoxExperimentInput,
} from '../blackbox/experiment';
import type {
  ArenaBlackBoxExperimentStore,
  CreateArenaBlackBoxExperimentResult,
  ArenaIdentificationModelStore,
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
  identificationModelStore: ArenaIdentificationModelStore;
}

export interface ArenaPlantAdapterVirtualPreviewInput {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  now?: string;
  blackBoxExperimentStore: ArenaBlackBoxExperimentStore;
  identificationModelStore: ArenaIdentificationModelStore;
  runStore: ArenaVirtualSimulationRunStore;
}

export interface ArenaPlantAdapterModeSupport {
  supported: boolean;
  reason?: string;
}

export interface ArenaPlantAdapterSupport {
  publicExperiment: ArenaPlantAdapterModeSupport;
  virtualPreview: ArenaPlantAdapterModeSupport;
  officialEvaluation: ArenaPlantAdapterModeSupport;
}

export interface ArenaPlantAdapter {
  id: string;
  describeSupport(task: ChallengeTask, object: ChallengeObject): ArenaPlantAdapterSupport;
  canRunPublicExperiment(task: ChallengeTask, object: ChallengeObject): boolean;
  runPublicExperiment(input: ArenaPlantAdapterPublicExperimentInput): Promise<CreateArenaBlackBoxExperimentResult>;
  canRunVirtualPreview(task: ChallengeTask, object: ChallengeObject): boolean;
  runVirtualPreview(input: ArenaPlantAdapterVirtualPreviewInput): Promise<ArenaVirtualSimulationPreviewRun & { id: string }>;
  canRunOfficialEvaluation(task: ChallengeTask, object: ChallengeObject): boolean;
}
