import { CONTROL_BASE_CONTROLLERS, CONTROL_ODYSSEY_LEVELS, getTierConfig, type BaseControllerId, type ControllerId, type LevelTier } from '../level-data';

export const ODYSSEY_DT = 1 / 60;
export const MAX_INPUT_CHANGES = 4096;

export interface OdysseyRunConfig {
  controlMode: 'MANUAL' | 'AUTO';
  controllerId: BaseControllerId;
  pidParams: { kp: number; ki: number; kd: number };
  extraParams: { speedFeedbackTau: number; feedforwardGain: number; smithDelay: number };
  enableSpeedFeedback: boolean;
  enableFeedforward: boolean;
  enableSmithPredictor: boolean;
  difficultyScale: number;
  outputLevels?: Record<ControllerId, number>;
}
export interface OdysseyInputChange { step: number; command: number; config: OdysseyRunConfig }
export interface OdysseyInputTrace { version: 1; totalSteps: number; changes: OdysseyInputChange[] }
export interface OdysseyMetrics {
  maxOvershoot: number; avgRelativeError: number; steadyError: number;
  settlingTime: number; controlEnergy: number; controlSmoothness: number;
}

export const maximumOdysseySteps = (levelId: string, tier: LevelTier) =>
  Math.ceil((getTierConfig(levelId, tier).distance - 100) / (150 * ODYSSEY_DT));

export function validateOdysseyInputTrace(value: unknown, levelId: string, tier: unknown, levels: Record<ControllerId, number>): OdysseyInputTrace {
  const fail = (): never => { throw new Error('运行输入记录无效，请重新完成关卡。'); };
  if (!CONTROL_ODYSSEY_LEVELS.some(level => level.id === levelId) || !['bronze', 'silver', 'gold'].includes(String(tier))) fail();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const trace = value as OdysseyInputTrace;
  if (trace.version !== 1 || !Number.isInteger(trace.totalSteps) || trace.totalSteps < 1 || trace.totalSteps > maximumOdysseySteps(levelId, tier as LevelTier)
    || !Array.isArray(trace.changes) || !trace.changes.length || trace.changes.length > MAX_INPUT_CHANGES) fail();
  const inRange = (v: unknown, maximum: number, minimum = 0) => typeof v === 'number' && Number.isFinite(v) && v >= minimum && v <= maximum;
  const controllerIds: ControllerId[] = ['P', 'PI', 'PD', 'PID', 'VFB', 'FF', 'SMITH'];
  const cap = (id: ControllerId) => Math.max(0.1, 0.1 * 2 ** Math.max(0, (levels[id] ?? 0) - 1));
  let previous = -1;
  for (const change of trace.changes) {
    if (!change || !Number.isInteger(change.step) || change.step <= previous || change.step >= trace.totalSteps || ![-1, 0, 1].includes(change.command)) fail();
    previous = change.step;
    const c = change.config;
    if (!c || !['MANUAL', 'AUTO'].includes(c.controlMode) || !CONTROL_BASE_CONTROLLERS.includes(c.controllerId)
      || (levels[c.controllerId] ?? 0) < 1 || !c.pidParams || !c.extraParams
      || !inRange(c.difficultyScale, 1.3, 0.7)) fail();
    for (const key of ['enableSpeedFeedback', 'enableFeedforward', 'enableSmithPredictor'] as const) if (typeof c[key] !== 'boolean') fail();
    if (c.outputLevels) {
      for (const id of controllerIds) if (!Number.isInteger(c.outputLevels[id]) || c.outputLevels[id] < 0 || c.outputLevels[id] > (levels[id] ?? 0)) fail();
      if (c.outputLevels.P < 1) fail();
    }
    const hasI = c.controllerId === 'PI' || c.controllerId === 'PID';
    const hasD = c.controllerId === 'PD' || c.controllerId === 'PID';
    if (!inRange(c.pidParams.kp, cap('P')) || !inRange(c.pidParams.ki, cap('PI')) || !inRange(c.pidParams.kd, cap('PD'))
      || (hasI && (levels.PI ?? 0) < 1) || (hasD && (levels.PD ?? 0) < 1)) fail();
    for (const [enabled, key, id] of [
      ['enableSpeedFeedback', 'speedFeedbackTau', 'VFB'], ['enableFeedforward', 'feedforwardGain', 'FF'], ['enableSmithPredictor', 'smithDelay', 'SMITH'],
    ] as const) if (!inRange(c.extraParams[key], cap(id)) || (c[enabled] && (levels[id] ?? 0) < 1)) fail();
  }
  if (trace.changes[0].step !== 0) fail();
  return { version: 1, totalSteps: trace.totalSteps, changes: trace.changes.map(({ step, command, config }) => ({ step, command, config: {
    controlMode: config.controlMode, controllerId: config.controllerId, pidParams: { kp: config.pidParams.kp, ki: config.pidParams.ki, kd: config.pidParams.kd },
    extraParams: { speedFeedbackTau: config.extraParams.speedFeedbackTau, feedforwardGain: config.extraParams.feedforwardGain, smithDelay: config.extraParams.smithDelay },
    enableSpeedFeedback: config.enableSpeedFeedback, enableFeedforward: config.enableFeedforward, enableSmithPredictor: config.enableSmithPredictor, difficultyScale: config.difficultyScale,
    ...(config.outputLevels ? { outputLevels: Object.fromEntries(controllerIds.map(id => [id, config.outputLevels![id]])) as Record<ControllerId, number> } : {}),
  } })) };
}

export function calculateOdysseyScore(metrics: OdysseyMetrics, tier: LevelTier, difficultyScale: number) {
  const base = tier === 'gold' ? 15000 : tier === 'silver' ? 12000 : 10000;
  const penalty = metrics.maxOvershoot * 20 + metrics.steadyError * 50 + metrics.avgRelativeError * 30;
  return Math.max(0, Math.floor(Math.max(0, Math.floor(base - penalty)) * Math.max(0.7, Math.min(1.4, 1 / difficultyScale))));
}
