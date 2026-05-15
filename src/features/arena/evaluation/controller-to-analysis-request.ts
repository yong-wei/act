import type { ChallengeObject, ChallengeTask, ControllerArtifact } from '../types';
import type { ControlAnalysisRequest, StructureSpec } from '@/resources/control-system/analysis/types';

export function buildArenaControlAnalysisRequest(input: {
  task: ChallengeTask;
  object: ChallengeObject;
  artifact: ControllerArtifact;
}): ControlAnalysisRequest {
  const { object, artifact } = input;
  if (!object.model) {
    throw new Error(`Object ${object.id} does not expose a transfer-function model.`);
  }

  const timeRange = object.timeRange ?? { start: 0, end: 20, samples: 401 };
  const frequencyRange = object.frequencyRange ?? { min: 0.1, max: 100, samples: 140 };

  let structures: StructureSpec[] = [];
  let rootLocusCurrentGain = 1;

  if (artifact.method === 'pid') {
    const params = artifact.params as Record<string, number>;
    structures = [{
      kind: 'pid',
      enabled: true,
      params: {
        kp: params.kp ?? 1,
        ki: params.ki ?? 0,
        kd: params.kd ?? 0,
      },
      label: 'C(s)',
    }];
  } else if (artifact.method === 'serial-compensator') {
    const params = artifact.params as Record<string, number>;
    const gain = params.gain ?? 1;
    const zero = params.zero ?? 1;
    const pole = params.pole ?? 4;
    if (pole <= 0) throw new Error('serial-compensator pole must be positive');
    if (zero <= 0) throw new Error('serial-compensator zero must be positive');
    rootLocusCurrentGain = gain;
    structures = [
      {
        kind: 'gain',
        enabled: true,
        params: { k: gain },
        label: 'K',
      },
      {
        kind: zero < pole ? 'lead' : 'lag',
        enabled: true,
        params: {
          k: 1,
          tau: 1 / zero,
          alpha: zero / pole,
          beta: zero / pole,
        },
        label: 'C(s)',
      },
    ];
  } else {
    throw new Error(`Controller method ${artifact.method} is not yet supported by the analysis-based evaluator. Use the heuristic evaluator or specify pid/serial-compensator.`);
  }

  return {
    runtimeMode: 'analysis',
    caseId: `arena-eval-${artifact.taskId}`,
    plant: {
      numerator: object.model.numerator,
      denominator: object.model.denominator,
      coefficientOrder: 'descending',
      label: object.name,
    },
    structures,
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'bode'],
    responseType: 'step',
    timeRange,
    frequencyRange,
    rootLocus: {
      minGain: 0,
      maxGain: Math.max(40, rootLocusCurrentGain * 2),
      samples: 48,
      currentGain: rootLocusCurrentGain,
    },
  };
}
