import type {
  ChallengeObject,
  ChallengeObjectAdapterType,
  ChallengeObjectSource,
  ModelVisibility,
  RelatedKnowledgeRef,
  TransferFunctionModel,
} from '../../arena/types';

export type WorkbenchPlantTargetExposure = 'inspectable' | 'hidden';

export interface WorkbenchTransferFunction {
  display: string;
  latex?: string;
  numerator: number[];
  denominator: number[];
}

export interface WorkbenchRangeSpec {
  start?: number;
  end?: number;
  min?: number;
  max?: number;
  samples: number;
}

interface WorkbenchPlantTargetBase {
  id: string;
  name: string;
  source: ChallengeObjectSource;
  visibility: ModelVisibility;
  chapter: string;
  tags: string[];
  adapterType?: ChallengeObjectAdapterType;
  modelType?: ChallengeObject['modelType'];
  modelVersion?: string;
  publicInterface?: string;
  evaluationInterface?: string;
  scenarioSummary?: string;
  relatedKnowledge: RelatedKnowledgeRef[];
  timeRange?: WorkbenchRangeSpec;
  frequencyRange?: WorkbenchRangeSpec;
}

export interface WhiteBoxWorkbenchPlantTarget extends WorkbenchPlantTargetBase {
  exposure: 'inspectable';
  visibility: 'white-box';
  hiddenTarget: false;
  transferFunction: WorkbenchTransferFunction;
}

export interface HiddenWorkbenchPlantTarget extends WorkbenchPlantTargetBase {
  exposure: 'hidden';
  visibility: Exclude<ModelVisibility, 'white-box'> | 'white-box';
  hiddenTarget: true;
  transferFunction?: never;
}

export type WorkbenchPlantTarget = WhiteBoxWorkbenchPlantTarget | HiddenWorkbenchPlantTarget;

function copyTransferFunction(model: TransferFunctionModel): WorkbenchTransferFunction {
  return {
    display: model.display,
    latex: model.latex,
    numerator: [...model.numerator],
    denominator: [...model.denominator],
  };
}

function baseTargetFromArenaObject(object: ChallengeObject): WorkbenchPlantTargetBase {
  return {
    id: object.id,
    name: object.name,
    source: object.source,
    visibility: object.visibility,
    chapter: object.chapter,
    tags: [...object.tags],
    adapterType: object.adapterType,
    modelType: object.modelType,
    modelVersion: object.modelVersion,
    publicInterface: object.publicInterface,
    evaluationInterface: object.evaluationInterface,
    scenarioSummary: object.scenarioSummary,
    relatedKnowledge: object.relatedKnowledge.map((ref) => ({ ...ref })),
    timeRange: object.timeRange ? { ...object.timeRange } : undefined,
    frequencyRange: object.frequencyRange ? { ...object.frequencyRange } : undefined,
  };
}

export function buildWhiteBoxWorkbenchPlantTarget(object: ChallengeObject): WhiteBoxWorkbenchPlantTarget {
  if (object.visibility !== 'white-box' || !object.model) {
    throw new Error('白箱工作台对象必须提供可公开的传递函数模型。');
  }

  return {
    ...baseTargetFromArenaObject(object),
    exposure: 'inspectable',
    visibility: 'white-box',
    hiddenTarget: false,
    transferFunction: copyTransferFunction(object.model),
  };
}

export function buildHiddenWorkbenchPlantTarget(object: ChallengeObject): HiddenWorkbenchPlantTarget {
  return {
    ...baseTargetFromArenaObject(object),
    exposure: 'hidden',
    hiddenTarget: true,
  };
}

export function buildWorkbenchPlantTargetFromArenaObject(object: ChallengeObject): WorkbenchPlantTarget {
  if (object.visibility === 'white-box' && object.model) {
    return buildWhiteBoxWorkbenchPlantTarget(object);
  }

  return buildHiddenWorkbenchPlantTarget(object);
}
