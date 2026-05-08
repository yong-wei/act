import type { ControlAnalysisRequest } from './types';

export type Unit33AnalysisStepId = 'step-05' | 'step-06';

interface Unit33AnalysisInput {
  gain: number;
}

export function buildUnit33AnalysisRequest(
  stepId: Unit33AnalysisStepId,
  input: Unit33AnalysisInput,
): ControlAnalysisRequest {
  const currentGain = Number.isFinite(input.gain) ? input.gain : 1;

  switch (stepId) {
    case 'step-05':
      return {
        runtimeMode: 'analysis',
        caseId: 'unit-3-3-step-05-condition-workspace',
        plant: {
          numerator: [1, 3.5],
          denominator: [1, 2.9, 0.78],
          coefficientOrder: 'descending',
          label: 'G_0(s)=(s+3.5)/[(s+2.6)(s+0.3)]',
        },
        structures: [{ kind: 'gain', enabled: true, params: { k: currentGain }, label: 'K' }],
        outputs: ['root_locus'],
        timeRange: { start: 0, end: 8, samples: 240 },
        frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
        rootLocus: { minGain: 0, maxGain: 20, samples: 320, currentGain, samplingMode: 'adaptive' },
      };
    case 'step-06':
      return {
        runtimeMode: 'analysis',
        caseId: 'unit-3-3-step-06-skeleton-workspace',
        plant: {
          numerator: [1],
          denominator: [1, 6, 8, 0],
          coefficientOrder: 'descending',
          label: 'G(s)H(s)=K/[s(s+2)(s+4)]',
        },
        structures: [{ kind: 'gain', enabled: true, params: { k: currentGain }, label: 'K' }],
        outputs: ['root_locus'],
        timeRange: { start: 0, end: 8, samples: 240 },
        frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
        rootLocus: { minGain: 0, maxGain: 80, samples: 320, currentGain, samplingMode: 'adaptive' },
      };
  }
}
