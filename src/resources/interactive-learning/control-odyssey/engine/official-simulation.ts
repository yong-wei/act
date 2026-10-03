import {
  CONTROL_BASE_CONTROLLERS,
  type BaseControllerId,
  type ControllerId,
  type LevelTier,
} from '../level-data';
import { createControlOdysseyReplayStep } from '@/lib/control-engine/server';
import { OdysseyExecution } from './run-execution';
import { maximumOdysseySteps, validateOdysseyInputTrace, type OdysseyRunConfig } from './input-trace';

export interface ComputeOfficialOdysseyTelemetryInput {
  levelId: string;
  tier?: string;
  controllerId?: ControllerId;
  controlMode?: string;
  pidParams?: { kp: number; ki: number; kd: number };
  extraParams?: { speedFeedbackTau: number; feedforwardGain: number; smithDelay?: number };
  enableSpeedFeedback?: boolean;
  enableFeedforward?: boolean;
  enableSmithPredictor?: boolean;
  difficultyScale?: number;
  controllerLevels: Record<ControllerId, number>;
}

export interface OfficialOdysseyTelemetry extends Record<string, unknown> {
  avgRelativeError: number;
  settlingTime: number;
  maxOvershoot: number;
  steadyError: number;
  controlEnergy: number;
  controlSmoothness: number;
  officialTelemetrySource: 'server-rust-simulation';
}




const CONTROLLER_PARAMETER_BASE_MAX = 0.1;

const finiteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isBaseControllerId = (controllerId: ControllerId | undefined): controllerId is BaseControllerId =>
  Boolean(controllerId && CONTROL_BASE_CONTROLLERS.includes(controllerId as BaseControllerId));

const readControllerLevel = (levels: Record<ControllerId, number>, controllerId: ControllerId) =>
  Math.max(0, Math.floor(finiteNumber(levels[controllerId], 0)));

const getParameterCap = (level: number) => {
  if (level <= 0) return 0;
  return Math.max(CONTROLLER_PARAMETER_BASE_MAX, CONTROLLER_PARAMETER_BASE_MAX * Math.pow(2, level - 1));
};

export const buildOfficialOdysseyReplayControllerConfig = (input: {
  controllerId?: ControllerId;
  pidParams?: { kp: number; ki: number; kd: number };
  extraParams?: { speedFeedbackTau: number; feedforwardGain: number; smithDelay?: number };
  enableSpeedFeedback?: boolean;
  enableFeedforward?: boolean;
  enableSmithPredictor?: boolean;
  controllerLevels: Record<ControllerId, number>;
}) => {
  const requestedControllerId = isBaseControllerId(input.controllerId) ? input.controllerId : 'P';
  const controllerId: BaseControllerId = requestedControllerId === 'P' || readControllerLevel(input.controllerLevels, requestedControllerId) > 0
    ? requestedControllerId
    : 'P';
  const pidParams = input.pidParams ?? { kp: 1, ki: 0, kd: 0 };
  const extraParams = input.extraParams ?? {
    speedFeedbackTau: 0.05,
    feedforwardGain: 0.05,
    smithDelay: 0.1,
  };
  const hasI = controllerId === 'PI' || controllerId === 'PID';
  const hasD = controllerId === 'PD' || controllerId === 'PID';
  const pCap = getParameterCap(readControllerLevel(input.controllerLevels, 'P'));
  const iCap = getParameterCap(readControllerLevel(input.controllerLevels, 'PI'));
  const dCap = getParameterCap(readControllerLevel(input.controllerLevels, 'PD'));
  const vfbCap = getParameterCap(readControllerLevel(input.controllerLevels, 'VFB'));
  const ffCap = getParameterCap(readControllerLevel(input.controllerLevels, 'FF'));
  const smithCap = getParameterCap(readControllerLevel(input.controllerLevels, 'SMITH'));

  return {
    controllerId,
    pid: {
      kp: clampValue(finiteNumber(pidParams.kp, 1), 0, pCap),
      ki: hasI ? clampValue(finiteNumber(pidParams.ki, 0), 0, iCap) : 0,
      kd: hasD ? clampValue(finiteNumber(pidParams.kd, 0), 0, dCap) : 0,
    },
    extraParams: {
      speedFeedbackTau: clampValue(finiteNumber(extraParams.speedFeedbackTau, 0.05), 0, vfbCap),
      feedforwardGain: clampValue(finiteNumber(extraParams.feedforwardGain, 0.05), 0, ffCap),
      smithDelay: clampValue(finiteNumber(extraParams.smithDelay, 0.1), 0, smithCap),
    },
    enableSpeedFeedback: Boolean(input.enableSpeedFeedback) && vfbCap > 0,
    enableFeedforward: Boolean(input.enableFeedforward) && ffCap > 0,
    enableSmithPredictor: Boolean(input.enableSmithPredictor) && smithCap > 0,
  };
};


export function replayOdysseyInput(input: { levelId: string; tier: string; controllerLevels: Record<ControllerId, number>; inputTrace: unknown }) {
  const trace = validateOdysseyInputTrace(input.inputTrace, input.levelId, input.tier, input.controllerLevels);
  const runtime = new OdysseyExecution(input.levelId, input.tier as LevelTier, input.controllerLevels);
  const execute = createControlOdysseyReplayStep();
  let changeIndex = 0;
  for (let index = 0; index < trace.totalSteps; index += 1) {
    if (trace.changes[changeIndex + 1]?.step === index) changeIndex += 1;
    const change = trace.changes[changeIndex];
    if (!runtime.advance(change.config, change.command, execute)) {
      if (runtime.terminal !== 'VICTORY' || index + 1 !== trace.totalSteps) throw new Error('运行未合法通关，请重新完成关卡。');
    }
  }
  if (runtime.terminal !== 'VICTORY') throw new Error('运行未合法通关，请重新完成关卡。');
  return { metrics: runtime.getMetrics(), trace };
}

export function computeOfficialOdysseyTelemetry(input: ComputeOfficialOdysseyTelemetryInput): OfficialOdysseyTelemetry {
  if (input.controlMode === 'MANUAL') throw new Error('Manual Odyssey runs require input trace replay before official Arena submission.');
  const tier = ['bronze', 'silver', 'gold'].includes(String(input.tier)) ? input.tier as LevelTier : 'bronze';
  const c = buildOfficialOdysseyReplayControllerConfig(input);
  const config: OdysseyRunConfig = {
    controlMode: 'AUTO', controllerId: c.controllerId, pidParams: c.pid,
    extraParams: { ...c.extraParams, smithDelay: c.extraParams.smithDelay },
    enableSpeedFeedback: c.enableSpeedFeedback, enableFeedforward: c.enableFeedforward,
    enableSmithPredictor: c.enableSmithPredictor, difficultyScale: input.difficultyScale ?? 1,
  };
  const runtime = new OdysseyExecution(input.levelId, tier, input.controllerLevels);
  const execute = createControlOdysseyReplayStep();
  for (let step = 0; step < maximumOdysseySteps(input.levelId, tier); step += 1) {
    if (!runtime.advance(config, 0, execute)) break;
  }
  if (runtime.terminal !== 'VICTORY') throw new Error('Server-side Odyssey replay did not complete without corridor collision.');
  return { ...runtime.getMetrics(), officialTelemetrySource: 'server-rust-simulation' };
}
