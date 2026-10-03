import { buildRuntimeTierConfig, getLevelConfigById, getTierConfig, getTransferFunctionModel, type ControllerId, type LevelTier } from '../level-data';
import { computeReferenceY, LevelGenerator, SEGMENT_WIDTH, SHIP_X_OFFSET, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, type LevelSegment } from './level-generator';
import { buildRustSimulationRequest, createInitialRustSimulationState, type RustSimulationRequest, type RustSimulationResult } from './rust-runtime-adapter';
import { ODYSSEY_DT, MAX_INPUT_CHANGES, type OdysseyRunConfig, type OdysseyInputTrace, type OdysseyMetrics } from './input-trace';
const SETTLING_DWELL_SECONDS = 0.5;
const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface StepInfo {
  at: number;
  amplitude: number;
  target: number;
}

interface MetricsState {
  maxOvershoot: number;
  avgRelativeErrorSum: number;
  avgRelativeErrorTime: number;
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

/** Odyssey progression and metrics only; the supplied Rust executor owns all physics. */
export class OdysseyExecution {
  readonly tierConfig;
  readonly levelConfig;
  readonly plantModel;
  state = createInitialRustSimulationState(VIEWPORT_HEIGHT / 2);
  scrollX = 0;
  autoOffset = 0;
  displayR = VIEWPORT_HEIGHT / 2;
  terminal: 'VICTORY' | 'GAME_OVER' | null = null;
  segments: LevelSegment[] = [];
  trace: OdysseyInputTrace = { version: 1, totalSteps: 0, changes: [] };
  private inputKey = '';
  private traceOverflow = false;
  private levelGenerator = new LevelGenerator();
  private difficultyScale: number | null = null;
  private disturbance = 0;
  private lastControlMode: OdysseyRunConfig['controlMode'] | null = null;
  private metrics: MetricsState = {
    maxOvershoot: 0, avgRelativeErrorSum: 0, avgRelativeErrorTime: 0,
    steadySumY: 0, steadySumR: 0, steadyTime: 0, elapsedTime: 0,
    controlEnergySum: 0, controlVariationSum: 0, previousControlU: 0,
    settlingCandidateAt: null, settlingTime: null,
  };
  private step: StepState;

  constructor(levelId: string, tier: LevelTier, private levels: Record<ControllerId, number>) {
    this.levelConfig = getLevelConfigById(levelId);
    this.tierConfig = buildRuntimeTierConfig(getTierConfig(levelId, tier));
    this.plantModel = getTransferFunctionModel(this.levelConfig.model);
    const { base, steps } = buildStepTimeline(this.tierConfig.reference);
    this.step = { base, steps, currentIndex: -1, currentAmplitude: 0, currentTarget: base, currentStartTime: null, direction: 0, peak: null };
  }

  prepareTerrain(difficultyScale: number) {
    if (this.difficultyScale !== difficultyScale) {
      this.levelGenerator.reset();
      this.segments = [];
      this.difficultyScale = difficultyScale;
    }
    this.segments.push(...this.levelGenerator.generateSegments(
      this.scrollX + VIEWPORT_WIDTH, this.tierConfig.distance, this.tierConfig.reference,
      { ...this.tierConfig.envelope, margin: Math.max(20, this.tierConfig.envelope.margin * difficultyScale) },
      this.tierConfig.disturbance,
    ));
    this.segments = this.segments.filter(segment => segment.x + SEGMENT_WIDTH > this.scrollX - 100);
  }

  advance(config: OdysseyRunConfig, command: number, execute: (request: RustSimulationRequest) => RustSimulationResult): boolean {
    if (this.terminal) return false;
    const key = JSON.stringify([command, config]);
    if (key !== this.inputKey) {
      if (this.trace.changes.length < MAX_INPUT_CHANGES) {
        this.trace.changes.push({ step: this.trace.totalSteps, command, config: structuredClone(config) });
      } else {
        this.traceOverflow = true;
      }
      this.inputKey = key;
    }
    this.trace.totalSteps += 1;
    if (this.lastControlMode !== config.controlMode) {
      this.autoOffset = 0;
      this.lastControlMode = config.controlMode;
    }
    const dt = ODYSSEY_DT;
    this.scrollX += 150 * dt;
    const worldX = this.scrollX + SHIP_X_OFFSET;
    const referenceY = computeReferenceY(this.tierConfig.reference, worldX);
    const raw = this.tierConfig.disturbance.type === 'output-step'
      ? this.tierConfig.disturbance.events.reduce((sum, event) => worldX >= event.at && worldX <= event.at + (event.duration ?? 160) ? sum + event.amplitude : sum, 0)
      : 0;
    const tau = Math.max(this.levelConfig.disturbanceTau ?? 0.6, 0.2);
    this.disturbance += (raw - this.disturbance) * Math.min(dt / (tau + dt), 1);
    if (config.controlMode === 'AUTO') {
      this.autoOffset = clampValue(this.autoOffset + command * 120 * dt, -160, 160);
      this.state.r = clampValue(referenceY + this.autoOffset, 0, VIEWPORT_HEIGHT);
    }
    const hasI = config.controllerId === 'PI' || config.controllerId === 'PID';
    const hasD = config.controllerId === 'PD' || config.controllerId === 'PID';
    const auto = config.controlMode === 'AUTO';
    const outputLevels = config.outputLevels ?? this.levels;
    this.state = execute(buildRustSimulationRequest({
      dt, inputCommand: auto ? 0 : command, disturbance: this.disturbance, state: this.state,
      plantModel: this.plantModel, mode: config.controlMode,
      pid: { kp: config.pidParams.kp, ki: hasI ? config.pidParams.ki : 0, kd: hasD ? config.pidParams.kd : 0 },
      speedFeedback: { enabled: config.enableSpeedFeedback, tau: config.extraParams.speedFeedbackTau },
      feedforward: { enabled: config.enableFeedforward, gain: config.extraParams.feedforwardGain, base: VIEWPORT_HEIGHT / 2 },
      smithPredictor: { enabled: config.enableSmithPredictor, delay: config.extraParams.smithDelay },
      outputLimits: {
        manual: Math.max(1, outputLevels.P ?? 1),
        p: auto ? Math.max(1, outputLevels.P ?? 1) : 0,
        i: auto && hasI ? Math.max(0, outputLevels.PI ?? 0) : 0,
        d: auto && hasD ? Math.max(0, outputLevels.PD ?? 0) : 0,
        vfb: auto && config.enableSpeedFeedback ? Math.max(0, outputLevels.VFB ?? 0) : 0,
        ff: auto && config.enableFeedforward ? Math.max(0, outputLevels.FF ?? 0) : 0,
      },
    })).state;
    // Match the playable viewport clamp before the next Rust input and collision test.
    this.state.y = clampValue(this.state.y, 0, VIEWPORT_HEIGHT);
    const metrics = this.metrics;
    const step = this.step;
    metrics.elapsedTime += dt;
    metrics.controlEnergySum += this.state.u * this.state.u * dt;
    metrics.controlVariationSum += Math.abs(this.state.u - metrics.previousControlU);
    metrics.previousControlU = this.state.u;
    while (step.currentIndex + 1 < step.steps.length && worldX >= step.steps[step.currentIndex + 1].at) {
      finalizeStepOvershoot(metrics, step);
      const current = step.steps[++step.currentIndex];
      step.currentAmplitude = current.amplitude;
      step.currentTarget = current.target;
      step.currentStartTime = metrics.elapsedTime;
      step.direction = Math.sign(current.amplitude);
      step.peak = this.state.y;
      metrics.settlingCandidateAt = null;
      metrics.settlingTime = null;
    }
    if (step.currentAmplitude !== 0 && step.peak !== null) step.peak = step.direction > 0 ? Math.max(step.peak, this.state.y) : Math.min(step.peak, this.state.y);
    const error = Math.abs(this.state.y - referenceY);
    const amplitude = Math.abs(step.currentAmplitude) || Math.abs(referenceY - step.base);
    if (amplitude > 0.001) {
      metrics.avgRelativeErrorSum += error / amplitude * dt;
      metrics.avgRelativeErrorTime += dt;
    }
    updateSettling(metrics, step, error);
    if (worldX >= this.tierConfig.distance - 500) {
      metrics.steadySumY += this.state.y * dt;
      metrics.steadySumR += referenceY * dt;
      metrics.steadyTime += dt;
    }
    this.prepareTerrain(config.difficultyScale);
    const segment = this.segments.find(item => item.x <= worldX && item.x + SEGMENT_WIDTH > worldX);
    this.displayR = auto ? this.state.r : segment?.gapCenter ?? VIEWPORT_HEIGHT / 2;
    if (!segment || this.state.y - 8 < segment.topY || this.state.y + 8 > segment.bottomY) {
      this.terminal = 'GAME_OVER';
    } else if (worldX >= this.tierConfig.distance) {
      this.terminal = 'VICTORY';
    }
    if (this.terminal) finalizeStepOvershoot(metrics, step);
    return this.terminal === null;
  }

  getInputTrace(): OdysseyInputTrace | null {
    return this.traceOverflow ? null : this.trace;
  }

  getMetrics(): OdysseyMetrics {
    const m = this.metrics;
    const avgR = m.steadyTime > 0 ? m.steadySumR / m.steadyTime : 0;
    const avgY = m.steadyTime > 0 ? m.steadySumY / m.steadyTime : 0;
    const time = Math.max(m.elapsedTime, 1);
    return {
      maxOvershoot: m.maxOvershoot,
      avgRelativeError: m.avgRelativeErrorTime > 0 ? m.avgRelativeErrorSum / m.avgRelativeErrorTime * 100 : 0,
      steadyError: m.steadyTime > 0 && Math.abs(avgR) > 0.001 ? Math.abs(avgY - avgR) / Math.abs(avgR) * 100 : 0,
      settlingTime: readSettlingTime(m, this.step),
      controlEnergy: m.controlEnergySum / time, controlSmoothness: m.controlVariationSum / time,
    };
  }
}
