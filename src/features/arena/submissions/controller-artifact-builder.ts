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

export type CodeControllerLanguage = 'javascript' | 'typescript' | 'python';

export interface CodeControllerManifest {
  language: CodeControllerLanguage;
  sourceHash: string;
  entryPoint: string;
  deterministicSeed: string;
  dependencyLockHash: string;
  runtimeLimitMs: number;
  memoryLimitMb: number;
  sourceCode?: string;
}

export interface BuildCodeControllerArtifactInput {
  task: ChallengeTask;
  manifest: CodeControllerManifest;
  now?: string;
}

const codeControllerLanguages: CodeControllerLanguage[] = ['javascript', 'typescript', 'python'];
const sha256Pattern = /^sha256:[a-f0-9]{64}$/;

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

function optionalNumberValue(values: Record<string, string>, key: string): number | undefined {
  const rawValue = values[key];
  if (rawValue === undefined || rawValue.trim() === '') {
    return undefined;
  }
  const value = Number(rawValue);
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
    const controlLimit = optionalNumberValue(input.values, 'controlLimit');
    params = {
      structure: 'prefilter-forward-local-feedback-disturbance',
      prefilterGain: numberValue(input.values, 'prefilterGain'),
      forwardGain: numberValue(input.values, 'forwardGain'),
      localFeedbackGain: numberValue(input.values, 'localFeedbackGain'),
      disturbanceCompensation: numberValue(input.values, 'disturbanceCompensation'),
      ...(controlLimit === undefined ? {} : { controlLimit }),
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

function requiredText(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new Error(`${key} 是必填沙箱元数据。`);
  }
  return value.trim();
}

function requiredHash(value: string | undefined, key: string): string {
  const hash = requiredText(value, key);
  if (!sha256Pattern.test(hash)) {
    throw new Error(`${key} 必须使用 sha256:<64位十六进制> 格式。`);
  }
  return hash;
}

function requiredLanguage(value: CodeControllerLanguage | undefined): CodeControllerLanguage {
  const language = requiredText(value, 'language') as CodeControllerLanguage;
  if (!codeControllerLanguages.includes(language)) {
    throw new Error('language 必须是 javascript、typescript 或 python。');
  }
  return language;
}

function boundedNumber(value: number, key: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} 必须在 ${min} 到 ${max} 之间。`);
  }
  return value;
}

export function normalizeCodeControllerManifest(manifest: CodeControllerManifest): ControllerArtifact['params'] {
  if (manifest.sourceCode !== undefined) {
    throw new Error('代码型控制器不能携带内联源码。');
  }
  return {
    language: requiredLanguage(manifest.language),
    sourceHash: requiredHash(manifest.sourceHash, 'sourceHash'),
    entryPoint: requiredText(manifest.entryPoint, 'entryPoint'),
    deterministicSeed: requiredText(manifest.deterministicSeed, 'deterministicSeed'),
    dependencyLockHash: requiredHash(manifest.dependencyLockHash, 'dependencyLockHash'),
    runtimeLimitMs: boundedNumber(manifest.runtimeLimitMs, 'runtimeLimitMs', 1, 1000),
    memoryLimitMb: boundedNumber(manifest.memoryLimitMb, 'memoryLimitMb', 1, 256),
  };
}

export function buildCodeControllerArtifactFromManifest(input: BuildCodeControllerArtifactInput): ControllerArtifact {
  if (!input.task.allowedMethods.includes('code-controller')) {
    throw new Error(`Task ${input.task.id} does not allow code-controller artifacts.`);
  }
  const createdAt = input.now ?? new Date().toISOString();

  return {
    id: `artifact-${input.task.id}-code-controller-${Date.parse(createdAt) || Date.now()}`,
    taskId: input.task.id,
    method: 'code-controller',
    params: normalizeCodeControllerManifest(input.manifest),
    createdAt,
  };
}
