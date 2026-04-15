import type { ControlAnalysisRequest } from './types';

export function buildUnit36PureGainFailureRequest(gain: number): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: 'unit-3-6-pure-gain-failure',
    plant: {
      numerator: [4],
      denominator: [1, 0.8, 0],
      coefficientOrder: 'descending',
      label: '3-6 统一对象',
    },
    structures: [
      {
        kind: 'gain',
        enabled: true,
        params: { k: gain },
        label: 'K',
      },
    ],
    outputs: ['root_locus'],
    timeRange: { start: 0, end: 10, samples: 320 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
    rootLocus: {
      minGain: 0,
      maxGain: 0.35,
      samples: 120,
      currentGain: gain,
    },
    feasibleRegion: {
      zetaMin: 0.4559498107691261,
      sigmaMin: 1,
      mpRatio: 0.2,
      settlingTime: 4,
    },
  };
}
