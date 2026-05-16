import type { CruiseRollHiddenScenario, CruiseRollHiddenScenarioSet } from './blackbox-scenario-set';

export interface CruiseRollOfficialController {
  experimentCount: number;
  controllerGain: number;
  dampingCompensation: number;
  energyBudget: number;
}

export interface CruiseRollOfficialTracePoint {
  t: number;
  reference: number;
  output: number;
  control: number;
}

export interface CruiseRollOfficialScenarioReplay {
  scenarioId: string;
  trace: CruiseRollOfficialTracePoint[];
  summary: {
    trackingError: number;
    worstCaseDeviation: number;
    controlEnergy: number;
    constraintViolations: number;
    smoothness: number;
    disturbanceRecovery: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, scale = 1000): number {
  return Number.isFinite(value) ? Math.round(value * scale) / scale : 0;
}

function replayScenario(
  scenario: CruiseRollHiddenScenario,
  controller: CruiseRollOfficialController,
): CruiseRollOfficialScenarioReplay {
  const trace: CruiseRollOfficialTracePoint[] = [];
  const steps = Math.floor(scenario.duration / scenario.sampleTime);
  let roll = scenario.initialRoll;
  let rollRate = 0;
  let previousControl = 0;
  let controlEnergy = 0;
  let controlDelta = 0;
  let constraintViolations = 0;
  const controlLimit = Math.max(0.5, Math.min(scenario.controlLimit, controller.energyBudget / 2));

  for (let index = 0; index <= steps; index += 1) {
    const t = round(index * scenario.sampleTime);
    const reference = 0;
    const disturbance = scenario.disturbanceAmplitude *
      Math.sin(scenario.disturbanceFrequency * t + scenario.disturbancePhase) +
      scenario.secondaryDisturbanceAmplitude * Math.sin(2.2 * t + scenario.disturbancePhase / 2);
    const rawControl = -controller.controllerGain * (roll - reference) -
      controller.dampingCompensation * rollRate;
    const control = clamp(rawControl, -controlLimit, controlLimit);
    const acceleration = -scenario.model.damping * rollRate -
      scenario.model.stiffness * roll +
      scenario.model.controlEffectiveness * control +
      disturbance;

    rollRate += acceleration * scenario.sampleTime;
    roll += rollRate * scenario.sampleTime;
    controlEnergy += control * control * scenario.sampleTime;
    controlDelta += Math.abs(control - previousControl);
    previousControl = control;

    if (Math.abs(roll) > scenario.rollLimit || Math.abs(rawControl) > scenario.controlLimit * 1.15) {
      constraintViolations += 1;
    }

    trace.push({
      t,
      reference,
      output: round(roll),
      control: round(control),
    });
  }

  const trackingError = trace.reduce((sum, point) => sum + Math.abs(point.output - point.reference), 0) /
    trace.length;
  const worstCaseDeviation = Math.max(...trace.map((point) => Math.abs(point.output - point.reference)));
  const smoothness = clamp(1 - controlDelta / Math.max(1, trace.length * 2), 0, 1);
  const disturbanceRecovery = clamp(1 - Math.abs(trace[trace.length - 1]?.output ?? 0) / Math.max(worstCaseDeviation, 0.1), 0, 1);

  return {
    scenarioId: scenario.id,
    trace,
    summary: {
      trackingError: round(trackingError),
      worstCaseDeviation: round(worstCaseDeviation),
      controlEnergy: round(controlEnergy),
      constraintViolations,
      smoothness: round(smoothness),
      disturbanceRecovery: round(disturbanceRecovery),
    },
  };
}

export function evaluateCruiseRollOfficialMetrics({
  controller,
  scenarioSet,
}: {
  controller: CruiseRollOfficialController;
  scenarioSet: CruiseRollHiddenScenarioSet;
}): Record<string, number> {
  const replays = scenarioSet.scenarios.map((scenario) => replayScenario(scenario, controller));
  const summaries = replays.map((replay) => replay.summary);
  const trackingError = summaries.reduce((sum, summary) => sum + summary.trackingError, 0) / summaries.length;
  const worstCaseDeviation = Math.max(...summaries.map((summary) => summary.worstCaseDeviation));
  const controlEnergy = summaries.reduce((sum, summary) => sum + summary.controlEnergy, 0) / summaries.length;
  const constraintViolations = summaries.reduce((sum, summary) => sum + summary.constraintViolations, 0);
  const smoothness = summaries.reduce((sum, summary) => sum + summary.smoothness, 0) / summaries.length;
  const disturbanceRecovery = summaries.reduce((sum, summary) => sum + summary.disturbanceRecovery, 0) /
    summaries.length;
  const experimentCoverage = clamp(controller.experimentCount / 8, 0, 1);
  const scenarioFit = clamp(
    1 - trackingError * 0.7 - worstCaseDeviation * 0.12 - constraintViolations * 0.04,
    0,
    1,
  );
  const identificationFit = 0.35 * experimentCoverage + 0.65 * scenarioFit;

  return {
    trackingError: round(trackingError),
    worstCaseDeviation: round(worstCaseDeviation),
    controlEnergy: round(controlEnergy),
    constraintViolations,
    identificationFit: round(identificationFit),
    disturbanceRecovery: round(disturbanceRecovery),
    smoothness: round(smoothness),
  };
}
