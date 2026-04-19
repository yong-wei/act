import type { ControlAnalysisRequest, StructureSpec } from './types';

type Unit42CaseId = 'ship' | 'platform';
type Unit42CaseConfig = Omit<ControlAnalysisRequest, 'runtimeMode' | 'structures' | 'outputs' | 'rootLocus'> & {
  caseId: string;
  rootLocus: Omit<ControlAnalysisRequest['rootLocus'], 'currentGain'>;
};

interface BuildUnit42AnalysisRequestInput {
  gain: number;
  structures: StructureSpec[];
}

const CASE_CONFIG = {
  ship: {
    caseId: 'ship_heading',
    plant: {
      numerator: [0.01715],
      denominator: [1, 2.24375, 0.214375, 0],
      coefficientOrder: 'descending' as const,
      label: '客船航向控制对象',
    },
    timeRange: { start: 0, end: 160, samples: 540 },
    frequencyRange: { min: 1e-3, max: 1e1, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 12, samples: 96 },
  },
  platform: {
    caseId: 'platform_pitch',
    plant: {
      numerator: [197.33333333333334, 2960],
      denominator: [0.000002833333333333334, 0.0034101666666666664, 0.5788716666666666, 35.37266666666667, 101, 0],
      coefficientOrder: 'descending' as const,
      label: '船载稳定平台对象',
    },
    timeRange: { start: 0, end: 2, samples: 540 },
    frequencyRange: { min: 1e-1, max: 1e4, samples: 420 },
    rootLocus: { minGain: 0, maxGain: 24, samples: 120 },
  },
} satisfies Record<Unit42CaseId, Unit42CaseConfig>;

export function buildUnit42AnalysisRequest(
  caseId: Unit42CaseId,
  input: BuildUnit42AnalysisRequestInput,
): ControlAnalysisRequest {
  const config = CASE_CONFIG[caseId];
  return {
    runtimeMode: 'analysis',
    caseId: config.caseId,
    plant: config.plant,
    structures: input.structures,
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'],
    timeRange: config.timeRange,
    frequencyRange: config.frequencyRange,
    rootLocus: {
      ...config.rootLocus,
      currentGain: input.gain,
    },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  };
}
