import {
  CONTROL_BASE_CONTROLLERS,
  buildRuntimeTierConfig,
  getLevelConfigById,
  getTierConfig,
  getTransferFunctionModel,
  type BaseControllerId,
  type ControllerId,
  type LevelTier,
} from '../level-data';
import {
  computeReferenceY,
  LevelGenerator,
  SEGMENT_WIDTH,
  SHIP_X_OFFSET,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  type LevelSegment,
} from './level-generator';
import { computeControlOdysseyServerStep } from './control-engine-server-runtime';
import {
  buildRustSimulationRequest,
  createInitialRustSimulationState,
  type RustSimulationState,
} from './rust-runtime-adapter';

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
  settlingTime: number;
  maxOvershoot: number;
  steadyError: number;
  controlEnergy: number;
  controlSmoothness: number;
  officialTelemetrySource: 'server-rust-simulation';
}

const DT = 1 / 60;
const SCROLL_SPEED = 150;
const SETTLING_DWELL_SECONDS = 0.5;
const CONTROLLER_PARAMETER_BASE_MAX = 0.1;

interface StepInfo {
  at: number;
  amplitude: number;
  target: number;
}

interface MetricsState {
  maxOvershoot: number;
  steadySumY: number;
  steadySumR: number;
  steadyTime: number;
  elapsedTime: number;
  controlEnergySum: number;
  controlVariationSum: number;
  previousControlU: number;
  settlingCandidateAt: number | null;
  settlingTime: number | null;
}

interface StepState {
  base: number;
  steps: StepInfo[];
  currentIndex: number;
  currentAmplitude: number;
  currentTarget: number;
  currentStartTime: number | null;
  direction: number;
  peak: number | null;
}

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

const buildStepTimeline = (reference: { type: string; base?: number; events: { at: number; amplitude: number }[] }) => {
  const base = reference.base ?? VIEWPORT_HEIGHT / 2;
  if (!['step', 'sequence', 'custom'].includes(reference.type)) {
    return { base, steps: [] as StepInfo[] };
  }
  const sorted = [...reference.events].sort((a, b) => a.at - b.at);
  let cumulative = 0;
  const steps = sorted.map((event) => {
    cumulative += event.amplitude;
    return { at: event.at, amplitude: event.amplitude, target: base + cumulative };
  });
  return { base, steps };
};

const finalizeStepOvershoot = (metrics: MetricsState, step: StepState) => {
  const amplitude = Math.abs(step.currentAmplitude);
  if (!amplitude || step.peak === null) return;

  let overshootRatio = 0;
  if (step.direction > 0) {
    overshootRatio = (step.peak - step.currentTarget) / amplitude;
  } else if (step.direction < 0) {
    overshootRatio = (step.currentTarget - step.peak) / amplitude;
  }
  if (overshootRatio > 0) {
    metrics.maxOvershoot = Math.max(metrics.maxOvershoot, overshootRatio * 100);
  }
};

const updateSettling = (metrics: MetricsState, step: StepState, error: number) => {
  const amplitude = Math.abs(step.currentAmplitude);
  if (!amplitude || step.currentStartTime === null) return;

  const tolerance = Math.max(4, amplitude * 0.05);
  if (error <= tolerance) {
    metrics.settlingCandidateAt ??= metrics.elapsedTime;
    if (metrics.elapsedTime - metrics.settlingCandidateAt >= SETTLING_DWELL_SECONDS) {
      metrics.settlingTime = Math.max(0, metrics.settlingCandidateAt - step.currentStartTime);
    }
    return;
  }

  metrics.settlingCandidateAt = null;
  metrics.settlingTime = null;
};

const readSettlingTime = (metrics: MetricsState, step: StepState) => {
  if (metrics.settlingTime !== null) return metrics.settlingTime;
  if (step.currentStartTime !== null) {
    return Math.max(0, metrics.elapsedTime - step.currentStartTime);
  }
  return metrics.elapsedTime;
};

export function computeOfficialOdysseyTelemetry(
  input: ComputeOfficialOdysseyTelemetryInput,
): OfficialOdysseyTelemetry {
  if (input.controlMode === 'MANUAL') {
    throw new Error('Manual Odyssey runs require input trace replay before official Arena submission.');
  }

  const levelConfig = getLevelConfigById(input.levelId);
  const tier = ['bronze', 'silver', 'gold'].includes(String(input.tier))
    ? input.tier as LevelTier
    : 'bronze';
  const tierConfig = buildRuntimeTierConfig(getTierConfig(input.levelId, tier));
  const plantModel = getTransferFunctionModel(levelConfig.model);
  const replayController = buildOfficialOdysseyReplayControllerConfig({
    controllerId: input.controllerId,
    pidParams: input.pidParams,
    extraParams: input.extraParams,
    enableSpeedFeedback: input.enableSpeedFeedback,
    enableFeedforward: input.enableFeedforward,
    enableSmithPredictor: input.enableSmithPredictor,
    controllerLevels: input.controllerLevels,
  });
  const controllerId = replayController.controllerId;
  const hasI = controllerId === 'PI' || controllerId === 'PID';
  const hasD = controllerId === 'PD' || controllerId === 'PID';
  const filteredPid = replayController.pid;
  const controllerLevels = input.controllerLevels;
  const outputLimits = {
    manual: Math.max(1, controllerLevels.P ?? 1),
    p: Math.max(1, controllerLevels.P ?? 1),
    i: hasI ? Math.max(0, controllerLevels.PI ?? 0) : 0,
    d: hasD ? Math.max(0, controllerLevels.PD ?? 0) : 0,
    vfb: replayController.enableSpeedFeedback ? Math.max(0, controllerLevels.VFB ?? 0) : 0,
    ff: replayController.enableFeedforward ? Math.max(0, controllerLevels.FF ?? 0) : 0,
  };
  const extraParams = replayController.extraParams;

  let runtimeState: RustSimulationState = createInitialRustSimulationState(VIEWPORT_HEIGHT / 2);
  const levelGenerator = new LevelGenerator();
  const scaledEnvelope = {
    ...tierConfig.envelope,
    margin: Math.max(20, tierConfig.envelope.margin * finiteNumber(input.difficultyScale, 1)),
  };
  let segments: LevelSegment[] = levelGenerator.generateSegments(
    VIEWPORT_WIDTH + 200,
    tierConfig.distance,
    tierConfig.reference,
    scaledEnvelope,
    tierConfig.disturbance,
  );
  let disturbance = 0;
  let scrollX = 0;
  const metrics: MetricsState = {
    maxOvershoot: 0,
    steadySumY: 0,
    steadySumR: 0,
    steadyTime: 0,
    elapsedTime: 0,
    controlEnergySum: 0,
    controlVariationSum: 0,
    previousControlU: 0,
    settlingCandidateAt: null,
    settlingTime: null,
  };
  const { base, steps } = buildStepTimeline(tierConfig.reference);
  const step: StepState = {
    base,
    steps,
    currentIndex: -1,
    currentAmplitude: 0,
    currentTarget: base,
    currentStartTime: null,
    direction: 0,
    peak: null,
  };

  const maxSteps = Math.ceil((tierConfig.distance / SCROLL_SPEED + 2) / DT);
  for (let index = 0; index < maxSteps; index += 1) {
    const nextScrollX = scrollX + SCROLL_SPEED * DT;
    scrollX = nextScrollX;
    const shipWorldX = nextScrollX + SHIP_X_OFFSET;
    const referenceY = computeReferenceY(tierConfig.reference, shipWorldX);

    const rawDisturbance = tierConfig.disturbance.type === 'output-step'
      ? tierConfig.disturbance.events.reduce((sum, event) => {
        const duration = event.duration ?? 160;
        return shipWorldX >= event.at && shipWorldX <= event.at + duration ? sum + event.amplitude : sum;
      }, 0)
      : 0;
    const disturbanceTau = Math.max(levelConfig.disturbanceTau ?? 0.6, 0.2);
    const alpha = Math.min(DT / (disturbanceTau + DT), 1);
    disturbance += (rawDisturbance - disturbance) * alpha;

    runtimeState.r = clampValue(referenceY, 0, VIEWPORT_HEIGHT);
    const result = computeControlOdysseyServerStep(buildRustSimulationRequest({
      dt: DT,
      inputCommand: 0,
      disturbance,
      state: runtimeState,
      plantModel,
      mode: 'AUTO',
      pid: filteredPid,
      speedFeedback: {
        enabled: replayController.enableSpeedFeedback,
        tau: finiteNumber(extraParams.speedFeedbackTau, 0.05),
      },
      feedforward: {
        enabled: replayController.enableFeedforward,
        gain: finiteNumber(extraParams.feedforwardGain, 0.05),
        base: VIEWPORT_HEIGHT / 2,
      },
      smithPredictor: {
        enabled: replayController.enableSmithPredictor,
        delay: finiteNumber(extraParams.smithDelay, 0.1),
      },
      outputLimits,
    }));
    runtimeState = result.state;

    metrics.elapsedTime += DT;
    metrics.controlEnergySum += runtimeState.u * runtimeState.u * DT;
    metrics.controlVariationSum += Math.abs(runtimeState.u - metrics.previousControlU);
    metrics.previousControlU = runtimeState.u;

    while (
      step.currentIndex + 1 < step.steps.length
      && shipWorldX >= step.steps[step.currentIndex + 1].at
    ) {
      finalizeStepOvershoot(metrics, step);
      step.currentIndex += 1;
      const currentStep = step.steps[step.currentIndex];
      step.currentAmplitude = currentStep.amplitude;
      step.currentTarget = currentStep.target;
      step.currentStartTime = metrics.elapsedTime;
      step.direction = Math.sign(currentStep.amplitude);
      step.peak = runtimeState.y;
      metrics.settlingCandidateAt = null;
      metrics.settlingTime = null;
    }

    if (step.currentAmplitude !== 0 && step.peak !== null) {
      if (step.direction > 0) {
        step.peak = Math.max(step.peak, runtimeState.y);
      } else if (step.direction < 0) {
        step.peak = Math.min(step.peak, runtimeState.y);
      }
    }

    const error = Math.abs(runtimeState.y - referenceY);
    updateSettling(metrics, step, error);
    const rightEdge = scrollX + VIEWPORT_WIDTH;
    segments = [
      ...segments,
      ...levelGenerator.generateSegments(
        rightEdge,
        tierConfig.distance,
        tierConfig.reference,
        scaledEnvelope,
        tierConfig.disturbance,
      ),
    ].filter((segment) => segment.x + SEGMENT_WIDTH > scrollX - 100);
    const currentSegment = segments.find(
      (segment) => segment.x <= shipWorldX && segment.x + SEGMENT_WIDTH > shipWorldX,
    );
    if (currentSegment && (runtimeState.y - 8 < currentSegment.topY || runtimeState.y + 8 > currentSegment.bottomY)) {
      throw new Error('Server-side Odyssey replay did not complete without corridor collision.');
    }
    if (shipWorldX >= tierConfig.distance - 500) {
      metrics.steadySumY += runtimeState.y * DT;
      metrics.steadySumR += referenceY * DT;
      metrics.steadyTime += DT;
    }

    if (shipWorldX >= tierConfig.distance) {
      break;
    }
  }

  finalizeStepOvershoot(metrics, step);
  const steadyAvgR = metrics.steadyTime > 0 ? metrics.steadySumR / metrics.steadyTime : 0;
  const steadyAvgY = metrics.steadyTime > 0 ? metrics.steadySumY / metrics.steadyTime : 0;
  const steadyError = metrics.steadyTime > 0 && Math.abs(steadyAvgR) > 0.001
    ? (Math.abs(steadyAvgY - steadyAvgR) / Math.abs(steadyAvgR)) * 100
    : 0;
  const normalizedTime = Math.max(metrics.elapsedTime, 1);

  return {
    settlingTime: readSettlingTime(metrics, step),
    maxOvershoot: metrics.maxOvershoot,
    steadyError,
    controlEnergy: metrics.controlEnergySum / normalizedTime,
    controlSmoothness: metrics.controlVariationSum / normalizedTime,
    officialTelemetrySource: 'server-rust-simulation',
  };
}
