import type { ControlMode, PIDGains } from '@/resources/simulations/core/types';
import type { VesselSession, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';

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

/** 现有055场景消费常驻会话，角度和世界坐标在显示边界转换。 */
export function advanceDestroyerCourseSession(session: VesselSession, input: VesselSessionInput, request: {
  dtS: number; targetHeadingDeg: number; controlMode: VesselSessionInput['controlMode'];
  pid: PIDGains; manualRudderDeg: number; derivativeFilterTauS: number;
  headingIntegralTracking?: VesselSessionInput['headingIntegralTracking'];
  feedback?: VesselSessionInput['feedback'];
}): VesselSessionFrame {
  const command: VesselSessionInput = { ...input, controlMode: request.controlMode,
    pid: { kp:request.pid.kp,ki:request.controlMode === 'pid' ? request.pid.ki : 0,
      kd:request.controlMode === 'pd' || request.controlMode === 'pid' ? request.pid.kd : 0 },
    targetHeadingDeg: request.targetHeadingDeg, derivativeFilterTauS: request.derivativeFilterTauS,
    headingIntegralTracking: request.headingIntegralTracking, feedback: request.feedback ?? input.feedback,
    actuators: { ...input.actuators, surfaces: input.actuators.surfaces.map((surface) =>
      ({ ...surface, angle_rad: request.manualRudderDeg*Math.PI/180 })) } };
  return session.advance(request.dtS, command);
}
