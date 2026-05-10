import type { ChallengeTask, ControllerArtifact, ControllerMethod } from '../types';

export type EvaluableControllerMethod = Extract<
  ControllerMethod,
  'pid' | 'serial-compensator' | 'optimized-pid' | 'composite-compensation' | 'mpc'
>;

const evaluableMethods: EvaluableControllerMethod[] = [
  'pid',
  'serial-compensator',
  'optimized-pid',
  'composite-compensation',
  'mpc',
];

export interface BuildControllerArtifactInput {
  task: ChallengeTask;
  method: EvaluableControllerMethod;
  values: Record<string, string>;
  now?: string;
}

export function getEvaluableControllerMethods(task: ChallengeTask): EvaluableControllerMethod[] {
  return evaluableMethods.filter((method) => task.allowedMethods.includes(method));
}

function numberValue(values: Record<string, string>, key: string): number {
  const value = Number(values[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} 必须是有限数字。`);
  }
  return value;
}

export function buildControllerArtifactFromParams(input: BuildControllerArtifactInput): ControllerArtifact {
  const createdAt = input.now ?? new Date().toISOString();
  let params: ControllerArtifact['params'];

  if (input.method === 'pid') {
    params = {
      kp: numberValue(input.values, 'kp'),
      ki: numberValue(input.values, 'ki'),
      kd: numberValue(input.values, 'kd'),
    };
  } else if (input.method === 'serial-compensator') {
    params = {
      gain: numberValue(input.values, 'gain'),
      zero: numberValue(input.values, 'zero'),
      pole: numberValue(input.values, 'pole'),
    };
  } else if (input.method === 'optimized-pid') {
    params = {
      template: 'bounded-optimized-pid',
      speedWeight: numberValue(input.values, 'speedWeight'),
      energyWeight: numberValue(input.values, 'energyWeight'),
      robustnessWeight: numberValue(input.values, 'robustnessWeight'),
      overshootWeight: numberValue(input.values, 'overshootWeight'),
      searchBudget: numberValue(input.values, 'searchBudget'),
    };
  } else if (input.method === 'composite-compensation') {
    params = {
      structure: 'prefilter-forward-local-feedback-disturbance',
      prefilterGain: numberValue(input.values, 'prefilterGain'),
      forwardGain: numberValue(input.values, 'forwardGain'),
      localFeedbackGain: numberValue(input.values, 'localFeedbackGain'),
      disturbanceCompensation: numberValue(input.values, 'disturbanceCompensation'),
    };
  } else {
    params = {
      template: 'bounded-linear-mpc',
      predictionHorizon: numberValue(input.values, 'predictionHorizon'),
      controlHorizon: numberValue(input.values, 'controlHorizon'),
      outputWeight: numberValue(input.values, 'outputWeight'),
      controlWeight: numberValue(input.values, 'controlWeight'),
      terminalWeight: numberValue(input.values, 'terminalWeight'),
      inputLimit: numberValue(input.values, 'inputLimit'),
      sampleTime: numberValue(input.values, 'sampleTime'),
    };
  }

  return {
    id: `artifact-${input.task.id}-${input.method}-${Date.parse(createdAt) || Date.now()}`,
    taskId: input.task.id,
    method: input.method,
    params,
    createdAt,
  };
}
