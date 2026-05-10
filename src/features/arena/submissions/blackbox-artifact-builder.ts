import type { ControllerArtifact } from '../types';

export interface BuildBlackBoxControlArtifactInput {
  taskId: string;
  values: Record<string, string>;
  now?: string;
}

function numberValue(values: Record<string, string>, key: string): number {
  const value = Number(values[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} 必须是有限数字。`);
  }
  return value;
}

export function buildBlackBoxControlArtifactFromParams(
  input: BuildBlackBoxControlArtifactInput,
): ControllerArtifact {
  const createdAt = input.now ?? new Date().toISOString();
  const params: ControllerArtifact['params'] = {
    representation: 'identified-model-controller',
    identificationQuality: numberValue(input.values, 'identificationQuality'),
    experimentCount: numberValue(input.values, 'experimentCount'),
    controllerGain: numberValue(input.values, 'controllerGain'),
    dampingCompensation: numberValue(input.values, 'dampingCompensation'),
    energyBudget: numberValue(input.values, 'energyBudget'),
  };

  return {
    id: `artifact-${input.taskId}-black-box-control-${Date.parse(createdAt) || Date.now()}`,
    taskId: input.taskId,
    method: 'black-box-control',
    params,
    createdAt,
  };
}
