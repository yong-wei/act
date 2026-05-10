import type { ChallengeTask, ControllerArtifact, ControllerMethod } from '../types';

export type EvaluableControllerMethod = Extract<ControllerMethod, 'pid' | 'serial-compensator'>;

const evaluableMethods: EvaluableControllerMethod[] = ['pid', 'serial-compensator'];

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
  const params: ControllerArtifact['params'] = input.method === 'pid'
    ? {
      kp: numberValue(input.values, 'kp'),
      ki: numberValue(input.values, 'ki'),
      kd: numberValue(input.values, 'kd'),
    }
    : {
      gain: numberValue(input.values, 'gain'),
      zero: numberValue(input.values, 'zero'),
      pole: numberValue(input.values, 'pole'),
    };

  return {
    id: `artifact-${input.task.id}-${input.method}-${Date.parse(createdAt) || Date.now()}`,
    taskId: input.task.id,
    method: input.method,
    params,
    createdAt,
  };
}
