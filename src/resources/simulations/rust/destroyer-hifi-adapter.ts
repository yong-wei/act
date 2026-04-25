import type { ControlMode, PIDGains } from '@/resources/simulations/core/types';

export interface DestroyerHifiState {
  timeS: number;
  headingDeg: number;
  yawRateDegS: number;
  positionXM: number;
  positionYM: number;
  rudderDeg: number;
  speedMps: number;
  surgeMps?: number;
  swayMps?: number;
  integralDegS?: number;
  prevErrorDeg?: number;
}

export interface DestroyerHifiStepRequest {
  modelId: 'destroyer_hifi';
  dtS: number;
  targetHeadingDeg: number;
  controlMode: Extract<ControlMode, 'manual' | 'p' | 'pd' | 'pid'>;
  pid: PIDGains;
  manualRudderDeg: number;
  disturbanceEnabled: boolean;
  state: DestroyerHifiState;
}

export interface DestroyerHifiStepResult extends DestroyerHifiState {
  targetHeadingDeg: number;
}

export interface SimulationSnapshot {
  timeS: number;
  headingDeg: number;
  yawRateDegS: number;
  positionX: number;
  positionZ: number;
  rudderDeg: number;
  speedMps: number;
  surgeMps?: number;
  swayMps?: number;
  integralDegS?: number;
  prevErrorDeg?: number;
}

export const createDestroyerHifiStateFromSimulation = ({
  timeS,
  headingDeg,
  yawRateDegS,
  positionX,
  positionZ,
  rudderDeg,
  speedMps,
  surgeMps,
  swayMps,
  integralDegS,
  prevErrorDeg,
}: SimulationSnapshot): DestroyerHifiState => ({
  timeS,
  headingDeg,
  yawRateDegS,
  positionXM: positionX,
  positionYM: positionZ,
  rudderDeg,
  speedMps,
  surgeMps,
  swayMps,
  integralDegS,
  prevErrorDeg,
});

export const buildDestroyerHifiStepRequest = ({
  dtS,
  targetHeadingDeg,
  controlMode,
  pid,
  manualRudderDeg,
  disturbanceEnabled,
  state,
}: Omit<DestroyerHifiStepRequest, 'modelId'>): DestroyerHifiStepRequest => ({
  modelId: 'destroyer_hifi',
  dtS,
  targetHeadingDeg,
  controlMode,
  pid,
  manualRudderDeg,
  disturbanceEnabled,
  state,
});

export const mapDestroyerHifiStepResult = (result: DestroyerHifiStepResult) => ({
  timeS: result.timeS,
  targetHeadingDeg: result.targetHeadingDeg,
  position: {
    x: result.positionXM,
    z: result.positionYM,
  },
  headingRad: (result.headingDeg * Math.PI) / 180,
  yawRateRad: (result.yawRateDegS * Math.PI) / 180,
  rudderDeg: result.rudderDeg,
  speedMps: result.speedMps,
  state: result,
});
