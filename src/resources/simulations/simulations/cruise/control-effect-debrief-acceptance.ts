import {
  buildCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeInput,
  type CruiseTelemetryBridgeSummary,
} from './telemetry-bridge';
import {
  resolveCruiseDebriefTaskContract,
  type ProjectCruiseControlEffectDebriefInput,
} from './control-effect-debrief';

export const CRUISE_DEBRIEF_ACCEPTANCE_QUERY = 'debriefAcceptance';

export const CRUISE_DEBRIEF_ACCEPTANCE_STATES = [
  'satisfied',
  'overshoot-unsatisfied',
  'settling-unsatisfied',
  'control-unavailable',
  'incomplete',
] as const;

export type CruiseDebriefAcceptanceState = (typeof CRUISE_DEBRIEF_ACCEPTANCE_STATES)[number];

const ACCEPTANCE_STATE_SET = new Set<string>(CRUISE_DEBRIEF_ACCEPTANCE_STATES);

export function isCruiseDebriefAcceptanceState(
  value: string | null,
): value is CruiseDebriefAcceptanceState {
  return Boolean(value && ACCEPTANCE_STATE_SET.has(value));
}

export function canUseCruiseDebriefAcceptanceFixture(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'production';
}

export function buildCruiseDebriefProjectionInput(args: {
  currentRunId: string;
  isCompleted: boolean;
  isPaused: boolean;
  liveSummary: CruiseTelemetryBridgeSummary | null;
  isBoundCourseTask: boolean;
  acceptanceFixtureId: string | null;
  nodeEnv?: string;
}): ProjectCruiseControlEffectDebriefInput {
  const fixture = resolveCruiseDebriefAcceptanceFixture(
    args.acceptanceFixtureId,
    args.currentRunId,
    args.nodeEnv,
  );
  return {
    currentRunId: args.currentRunId,
    isCompleted: fixture?.isCompleted ?? args.isCompleted,
    isPaused: fixture?.isPaused ?? args.isPaused,
    summary: fixture ? fixture.summary : args.liveSummary,
    taskContract: resolveCruiseDebriefTaskContract(args.isBoundCourseTask),
  };
}

export function resolveCruiseDebriefAcceptanceFixture(
  fixtureId: string | null,
  currentRunId: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Pick<ProjectCruiseControlEffectDebriefInput, 'isCompleted' | 'isPaused' | 'summary'> | null {
  if (!canUseCruiseDebriefAcceptanceFixture(nodeEnv) || !isCruiseDebriefAcceptanceState(fixtureId)) {
    return null;
  }
  if (fixtureId === 'incomplete') {
    return {
      isCompleted: false,
      isPaused: false,
      summary: null,
    };
  }
  return {
    isCompleted: true,
    isPaused: false,
    summary: buildAcceptanceSummary(currentRunId, fixtureId),
  };
}

function buildAcceptanceSummary(
  runId: string,
  fixtureId: Exclude<CruiseDebriefAcceptanceState, 'incomplete'>,
): CruiseTelemetryBridgeSummary {
  const performance = performanceFor(fixtureId);
  return buildCruiseTelemetryBridgeSummary(buildAcceptanceBridgeInput(runId, performance));
}

function performanceFor(
  fixtureId: Exclude<CruiseDebriefAcceptanceState, 'incomplete'>,
): CruiseTelemetryBridgeInput['performance'] {
  if (fixtureId === 'overshoot-unsatisfied') {
    return { overshoot: 18, settlingTime: 40, accel: 0.08, settled: true };
  }
  if (fixtureId === 'settling-unsatisfied') {
    return { overshoot: 8, settlingTime: 52, accel: 0.08, settled: true };
  }
  return { overshoot: 8, settlingTime: 40, accel: 0.082, settled: true };
}

function buildAcceptanceBridgeInput(
  runId: string,
  performance: CruiseTelemetryBridgeInput['performance'],
): CruiseTelemetryBridgeInput {
  return {
    runId,
    startedAt: '2026-05-25T08:00:00.000Z',
    completedAt: '2026-05-25T08:05:00.000Z',
    seed: runId,
    sampleFrameCount: 480,
    virtualModeEnabled: true,
    performance,
    consistencyScore: { score: 86 },
    state: {
      time: 300,
      heading: 30.8,
      targetHeading: 30,
      yawRate: 0.12,
      rudder: 3.5,
      speed: 9.3,
      rollAngle: 0.034,
      seaState: 3,
      waveDirection: 90,
      finStabilizerEnabled: true,
      notchFilterEnabled: true,
      finPower: 240,
      controlMode: 'pid',
      pidGains: { kp: 1.2, ki: 0.18, kd: 0.42 },
      targetForm: {
        overshoot: 12,
        settlingTime: 65,
        steadyError: 2,
        maxLateralAccel: 0.15,
      },
      comfort: {
        msi: 8.3,
        rollRms: 1.1,
        rollPeak: 3.4,
        comfortRating: 'good',
        vdv: 0.71,
        frequencyWeightedAccel: 0.032,
      },
    },
  };
}
