import type { ControlAnalysisRequest, StructureSpec } from './types';

type Unit41StepId = 'step-04' | 'step-05';
type Unit41CaseConfig = Omit<ControlAnalysisRequest, 'runtimeMode' | 'structures' | 'outputs' | 'rootLocus'> & {
  caseId: string;
  rootLocus: Omit<ControlAnalysisRequest['rootLocus'], 'currentGain'>;
};

interface BuildUnit41AnalysisRequestInput {
  gain: number;
  structures: StructureSpec[];
}

const CASE_CONFIG = {
  'step-04': {
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
    feasibleRegion: { zetaMin: 0.5169308662051556, sigmaMin: 4 / 45, mpRatio: 0.15, settlingTime: 45 },
  },
  'step-05': {
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
    feasibleRegion: { zetaMin: 0.5911550337988976, sigmaMin: 20, mpRatio: 0.1, settlingTime: 0.2 },
  },
} satisfies Record<Unit41StepId, Unit41CaseConfig>;

export function buildUnit41AnalysisRequest(
  stepId: Unit41StepId,
  input: BuildUnit41AnalysisRequestInput,
): ControlAnalysisRequest {
  const config = CASE_CONFIG[stepId];
  return {
    runtimeMode: 'analysis',
    caseId: config.caseId,
    plant: config.plant,
    structures: input.structures,
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'],
    responseType: 'step',
    timeRange: config.timeRange,
    frequencyRange: config.frequencyRange,
    nyquist: { mode: 'full', samplingMode: 'adaptive' },
    rootLocus: {
      ...config.rootLocus,
      currentGain: input.gain,
    },
    feasibleRegion: config.feasibleRegion,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  };
}
