export type ArenaBlackBoxSignalType = 'step' | 'impulse' | 'prbs' | 'sine';

export interface ArenaBlackBoxExperimentSample {
  t: number;
  input: number;
  output: number;
}

export interface ArenaBlackBoxExperimentDataset {
  taskId: string;
  objectId: string;
  datasetHash: string;
  scenarioId: string;
  signalType: ArenaBlackBoxSignalType;
  sampleTime: number;
  duration: number;
  budgetCost: number;
  samples: ArenaBlackBoxExperimentSample[];
  replay?: unknown;
  summary: {
    peakOutput: number;
    finalOutput: number;
    meanAbsOutput: number;
    inputEnergy: number;
    dataQuality: number;
  };
  createdAt: string;
}

export interface ArenaIdentificationModelValidationSummary {
  validationFit: number;
  dataQuality: number;
  sampleCount: number;
  signalType: string;
}

export interface StoredArenaIdentificationModel {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  sourceExperimentId: string;
  modelType: 'second-order-fit';
  validationSummary: ArenaIdentificationModelValidationSummary;
  protocolVersion: 'arena-identification-model-v1';
  createdAt: string;
}

export interface ArenaVirtualSimulationTracePoint {
  t: number;
  reference: number;
  output: number;
  control: number;
}

export interface ArenaVirtualSimulationPreviewRun {
  taskId: string;
  datasetHash: string;
  controllerHash: string;
  scenarioId: string;
  trace: ArenaVirtualSimulationTracePoint[];
  summary: {
    trackingError: number;
    maxDeviation: number;
    controlEnergy: number;
    safetyViolations: number;
    smoothness: number;
  };
  replay?: unknown;
  replaySource?: unknown;
  metadata?: {
    evaluationVisibility: 'preview';
    officialEligible: false;
    modelRelation?: string;
    datasetHash: string;
    controllerHash: string;
    identificationModelId?: string;
    sourceExperimentId?: string;
  };
  createdAt: string;
}
