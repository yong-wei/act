import type {
  AzipodConfig,
  ContainerShipState,
  DisturbanceVector,
  MMG3DOFParams,
  Nomoto2ndOrderParams,
  Nomoto2ndOrderDelayState,
  NomotoState,
  PIDGains,
  PIDState,
  RollCoupledNomotoParams,
  RollCoupledState,
  RollState,
  SemiSubmersible3DOFState,
  ThrusterState,
  Vector2,
} from '../core/types';
import {
  CONTAINER_MSC_PARAMS,
  CRUISE_ADORA_PARAMS,
  DEFAULT_NOMOTO_PARAMS,
  DEG_TO_RAD,
  HYSY981_PLATFORM_PARAMS,
  RAD_TO_DEG,
  XUELONG_AZIPOD_PARAMS,
  XUELONG_ICEBREAKER_PARAMS,
  clamp,
  lerp,
  toDegrees,
  toRadians,
} from '../core/constants';

export type { ContainerShipState, Nomoto2ndOrderDelayState, NomotoState, RollCoupledState, SemiSubmersible3DOFState };

export interface MMG3DOFState {
  x: number;
  y: number;
  psi: number;
  u: number;
  v: number;
  r: number;
  rudderAngle: number;
  propellerRPM: number;
}

interface AzipodInternalState {
  id: number;
  azimuth: number;
  azimuthCmd: number;
  thrust: number;
  thrustCmd: number;
  power: number;
  slewRate: number;
  enabled: boolean;
}

export interface Azipod3DOFInternalState {
  x: number;
  y: number;
  psi: number;
  u: number;
  v: number;
  r: number;
  azipod1: AzipodInternalState;
  azipod2: AzipodInternalState;
  iceResistanceForce: number;
  perturbedK: number;
  perturbedT: number;
  time: number;
}

export interface Azipod3DOFParams {
  mass: number;
  addedMassX: number;
  addedMassY: number;
  inertiaZ: number;
  addedInertiaZ: number;
  dampingU: number;
  dampingV: number;
  dampingR: number;
  azipods: AzipodConfig[];
  maxSlewRate: number;
  maxThrust: number;
}

export const DEFAULT_NOMOTO_2ND_ORDER_PARAMS: Nomoto2ndOrderParams = {
  K: 0.03,
  T1: 80,
  T2: 20,
  T3: 0,
  timeDelay: 2.5,
  maxRudderDeg: 35,
  speedMps: 9.8,
};

export const DEFAULT_ROLL_COUPLED_PARAMS: RollCoupledNomotoParams = {
  K: CRUISE_ADORA_PARAMS.K,
  T1: CRUISE_ADORA_PARAMS.T1,
  T2: CRUISE_ADORA_PARAMS.T2,
  K_phi: CRUISE_ADORA_PARAMS.K_PHI,
  T_phi1: CRUISE_ADORA_PARAMS.T_PHI1,
  T_phi2: CRUISE_ADORA_PARAMS.T_PHI2,
  naturalRollPeriod: CRUISE_ADORA_PARAMS.NATURAL_ROLL_PERIOD,
  rollDamping: CRUISE_ADORA_PARAMS.ROLL_DAMPING,
  maxRudderDeg: CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE,
  speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
};

export const DEFAULT_MMG_PARAMS: MMG3DOFParams = {
  massInertia: {
    m: 17000000,
    Iz: 2.5e9,
    xG: -2.5,
    mx: 0.05,
    my: 0.9,
    Jz: 0.15,
  },
  hydro: {
    Xuu: -0.022,
    Xvv: -0.04,
    Xrr: 0.002,
    Xvr: 0.002,
    Yv: -0.315,
    Yr: 0.083,
    Yvvv: -1.607,
    Yrrr: 0.008,
    Yvvr: 0.379,
    Yvrr: -0.391,
    Nv: -0.137,
    Nr: -0.049,
    Nvvv: -0.03,
    Nrrr: -0.013,
    Nvvr: -0.294,
    Nvrr: 0.055,
  },
  rudder: {
    maxAngle: 35 * DEG_TO_RAD,
    maxRate: 2.5 * DEG_TO_RAD,
    tR: 0.4,
    aH: 0.3,
    xR: -63.75,
  },
  propeller: {
    Dp: 4.5,
    wp: 0.25,
    tp: 0.15,
  },
};

export const DEFAULT_AZIPOD_3DOF_PARAMS: Azipod3DOFParams = {
  mass: XUELONG_ICEBREAKER_PARAMS.MASS,
  addedMassX: XUELONG_ICEBREAKER_PARAMS.ADDED_MASS_X,
  addedMassY: XUELONG_ICEBREAKER_PARAMS.ADDED_MASS_Y,
  inertiaZ: XUELONG_ICEBREAKER_PARAMS.INERTIA_Z,
  addedInertiaZ: XUELONG_ICEBREAKER_PARAMS.ADDED_INERTIA_Z,
  dampingU: XUELONG_ICEBREAKER_PARAMS.DAMPING_U,
  dampingV: XUELONG_ICEBREAKER_PARAMS.DAMPING_V,
  dampingR: XUELONG_ICEBREAKER_PARAMS.DAMPING_R,
  azipods: [
    {
      id: 1,
      positionX: -55,
      positionY: 5,
      maxThrust: 7500000,
      maxPower: 7500000,
      maxSlewRate: 12 * DEG_TO_RAD,
    },
    {
      id: 2,
      positionX: -55,
      positionY: -5,
      maxThrust: 7500000,
      maxPower: 7500000,
      maxSlewRate: 12 * DEG_TO_RAD,
    },
  ],
  maxSlewRate: XUELONG_AZIPOD_PARAMS.MAX_SLEW_RATE * DEG_TO_RAD,
  maxThrust: XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST * 1000,
};

export function createNomotoState(
  positionX = 0,
  positionZ = 0,
  headingDeg = 0,
  speedMps = DEFAULT_NOMOTO_PARAMS.speedMps,
): NomotoState {
  return {
    headingRad: toRadians(headingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX,
    positionZ,
    speedMps,
  };
}

export function nomotoToSimulationState(nomoto: NomotoState, time: number) {
  return {
    position: { x: nomoto.positionX, z: nomoto.positionZ },
    heading: ((toDegrees(nomoto.headingRad) % 360) + 360) % 360,
    headingRad: nomoto.headingRad,
    yawRate: toDegrees(nomoto.yawRateRad),
    yawRateRad: nomoto.yawRateRad,
    rudder: nomoto.rudderDeg,
    speed: nomoto.speedMps,
    time,
  };
}

export function createNomoto2ndOrderDelayState(
  params: Nomoto2ndOrderParams,
  dt: number,
  startX = 0,
  startZ = 0,
  startHeadingDeg = 0,
): Nomoto2ndOrderDelayState {
  return {
    headingRad: toRadians(startHeadingDeg),
    yawRateRad: 0,
    yawRateDerivative: 0,
    rudderDeg: 0,
    positionX: startX,
    positionZ: startZ,
    speedMps: params.speedMps,
    rudderHistory: new Array(Math.ceil(params.timeDelay / dt)).fill(0),
    historyIndex: 0,
  };
}

export function createPIDStateForLNG(): PIDState {
  return { integral: 0, prevError: 0 };
}

export function pidControl2ndOrder(
  targetHeadingDeg: number,
  currentHeadingDeg: number,
  currentYawRateDeg: number,
  pidState: PIDState,
  gains: PIDGains,
  mode: 'manual' | 'p' | 'pd' | 'pid',
  dt: number,
  maxRudderDeg = 35,
  integralLimit = 30,
): { rudderDeg: number; newState: PIDState } {
  if (mode === 'manual') {
    return { rudderDeg: 0, newState: pidState };
  }
  let error = targetHeadingDeg - currentHeadingDeg;
  while (error > 180) error -= 360;
  while (error < -180) error += 360;
  let rudder = gains.kp * error;
  if (mode === 'pd' || mode === 'pid') {
    rudder -= gains.kd * currentYawRateDeg;
  }
  let newIntegral = pidState.integral;
  if (mode === 'pid') {
    newIntegral = clamp(newIntegral + error * dt, -integralLimit, integralLimit);
    rudder += gains.ki * newIntegral;
  }
  return {
    rudderDeg: clamp(rudder, -maxRudderDeg, maxRudderDeg),
    newState: { integral: newIntegral, prevError: error },
  };
}

const getVariableParams = (loadRatio: number) => {
  const ratio = clamp(loadRatio, 0, 1);
  return {
    K: lerp(CONTAINER_MSC_PARAMS.K_EMPTY, CONTAINER_MSC_PARAMS.K_FULL, ratio),
    T: lerp(CONTAINER_MSC_PARAMS.T_EMPTY, CONTAINER_MSC_PARAMS.T_FULL, ratio),
  };
};

const getCargoMass = (loadRatio: number) =>
  lerp(CONTAINER_MSC_PARAMS.MASS_EMPTY, CONTAINER_MSC_PARAMS.MASS_FULL, clamp(loadRatio, 0, 1));

export function createContainerShipState(
  loadRatio = 0.5,
  initialHeadingDeg = 0,
  initialX = 0,
  initialZ = 0,
): ContainerShipState {
  const { K, T } = getVariableParams(loadRatio);
  return {
    headingRad: toRadians(initialHeadingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX: initialX,
    positionZ: initialZ,
    speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
    loadRatio,
    cargoMass: getCargoMass(loadRatio),
    currentK: K,
    currentT: T,
    windLoad: { force: 0, moment: 0, relativeDirection: 0 },
    roll: { angle: 0, rate: 0 },
  };
}

export function updateLoadRatio(state: ContainerShipState, newLoadRatio: number): ContainerShipState {
  const loadRatio = clamp(newLoadRatio, 0, 1);
  const { K, T } = getVariableParams(loadRatio);
  return {
    ...state,
    loadRatio,
    cargoMass: getCargoMass(loadRatio),
    currentK: K,
    currentT: T,
  };
}

export function getContainerShipSummary(state: ContainerShipState) {
  return {
    loadPercent: Math.round(state.loadRatio * 100),
    cargoMass: state.cargoMass,
    currentK: state.currentK,
    currentT: state.currentT,
    rollDeg: toDegrees(state.roll.angle),
    rollRateDeg: toDegrees(state.roll.rate),
  };
}

export function shouldTriggerRollAlarm(
  state: RollState | ContainerShipState,
  thresholdDeg = 10,
  cargoShiftThresholdDeg = thresholdDeg * 0.8,
) {
  const roll = 'roll' in state ? state.roll : state;
  const rollAngleDeg = Math.abs(toDegrees(roll.angle));
  const cargoShiftAlarm = rollAngleDeg > cargoShiftThresholdDeg;
  const rollAlarm = rollAngleDeg > thresholdDeg;
  const messages: string[] = [];

  if (cargoShiftAlarm) {
    messages.push('货物移位风险');
  }
  if (rollAlarm) {
    messages.push('横摇超限');
  }

  return {
    cargoShiftAlarm,
    rollAlarm,
    message: messages.join('，') || undefined,
  };
}

export function createRollCoupledState(
  startX = 0,
  startZ = 0,
  startHeadingDeg = 0,
  speedMps = DEFAULT_ROLL_COUPLED_PARAMS.speedMps,
): RollCoupledState {
  return {
    headingRad: toRadians(startHeadingDeg),
    yawRateRad: 0,
    yawAccelRad: 0,
    rollRad: 0,
    rollRateRad: 0,
    positionX: startX,
    positionZ: startZ,
    speedMps,
    rudderDeg: 0,
    finAngleDeg: 0,
  };
}

export function computeWaveExcitation(
  time: number,
  seaStateLevel: number,
  waveDirection = 90,
  vesselHeadingDeg = 0,
): number {
  const baseAmplitude = 0.2 * Math.pow(seaStateLevel, 1.35);
  const relativeDirection = waveDirection - vesselHeadingDeg;
  const directionFactor = 0.25 + 0.75 * Math.abs(Math.sin(toRadians(relativeDirection)));
  const omega1 = 2 * Math.PI * 0.12;
  const omega2 = 2 * Math.PI * 0.18;
  const omega3 = 2 * Math.PI * 0.25;
  return baseAmplitude * directionFactor * (
    0.5 * Math.sin(omega1 * time)
    + 0.3 * Math.sin(omega2 * time + 0.5)
    + 0.2 * Math.sin(omega3 * time + 1.2)
  );
}

export function createMMG3DOFState(x = 0, y = 0, psi = 0, u = 2.0, v = 0, r = 0): MMG3DOFState {
  return { x, y, psi, u, v, r, rudderAngle: 0, propellerRPM: 80 };
}

export function mmgToSimulationState(mmg: MMG3DOFState, time: number) {
  const headingDeg = mmg.psi * RAD_TO_DEG;
  const yawRateDeg = mmg.r * RAD_TO_DEG;
  const speed = Math.sqrt(mmg.u * mmg.u + mmg.v * mmg.v);
  return {
    position: { x: mmg.x, z: mmg.y },
    heading: ((headingDeg % 360) + 360) % 360,
    headingRad: mmg.psi,
    yawRate: yawRateDeg,
    yawRateRad: mmg.r,
    rudder: mmg.rudderAngle * RAD_TO_DEG,
    speed,
    surgeVelocity: mmg.u,
    swayVelocity: mmg.v,
    time,
  };
}

export function createSemiSub3DOFState(
  x = 0,
  y = 0,
  psiDeg = 0,
  targetX = 0,
  targetY = 0,
  targetPsiDeg = 0,
): SemiSubmersible3DOFState {
  const thrusters: ThrusterState[] = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    thrust: 0,
    azimuth: 0,
    power: 0,
    enabled: true,
    failed: false,
  }));
  return {
    x,
    y,
    psi: psiDeg * DEG_TO_RAD,
    u: 0,
    v: 0,
    r: 0,
    thrusters,
    currentForceX: 0,
    currentForceY: 0,
    currentMomentN: 0,
    windForceX: 0,
    windForceY: 0,
    windMomentN: 0,
    targetX,
    targetY,
    targetPsi: targetPsiDeg * DEG_TO_RAD,
    positionError: Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2),
    headingError: Math.abs(psiDeg - targetPsiDeg) > 180
      ? 360 - Math.abs(psiDeg - targetPsiDeg)
      : Math.abs(psiDeg - targetPsiDeg),
    decouplingEnabled: true,
  };
}

export function getDecouplingMatrix(): number[][] {
  const couplingVr = HYSY981_PLATFORM_PARAMS.DAMPING_VR / HYSY981_PLATFORM_PARAMS.DAMPING_V;
  const couplingRv = HYSY981_PLATFORM_PARAMS.DAMPING_RV / HYSY981_PLATFORM_PARAMS.DAMPING_R;
  const det = 1 - couplingVr * couplingRv;
  if (Math.abs(det) < 1e-10) {
    return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  }
  return [
    [1, 0, 0],
    [0, 1 / det, -couplingVr / det],
    [0, -couplingRv / det, 1 / det],
  ];
}

export function applyDecoupling(
  tauCmd: [number, number, number],
  decouplingEnabled: boolean,
): [number, number, number] {
  if (!decouplingEnabled) {
    return tauCmd;
  }
  const matrix = getDecouplingMatrix();
  return [
    matrix[0][0] * tauCmd[0] + matrix[0][1] * tauCmd[1] + matrix[0][2] * tauCmd[2],
    matrix[1][0] * tauCmd[0] + matrix[1][1] * tauCmd[1] + matrix[1][2] * tauCmd[2],
    matrix[2][0] * tauCmd[0] + matrix[2][1] * tauCmd[1] + matrix[2][2] * tauCmd[2],
  ];
}

export function semiSubToSimulationState(state: SemiSubmersible3DOFState, time: number) {
  const speed = Math.sqrt(state.u ** 2 + state.v ** 2);
  return {
    position: { x: state.x, z: state.y },
    heading: state.psi * RAD_TO_DEG,
    headingRad: state.psi,
    yawRate: state.r * RAD_TO_DEG,
    yawRateRad: state.r,
    rudder: 0,
    speed,
    surgeVelocity: state.u,
    swayVelocity: state.v,
    time,
  };
}

const createAzipodState = (config: AzipodConfig): AzipodInternalState => ({
  id: config.id,
  azimuth: 0,
  azimuthCmd: 0,
  thrust: 0,
  thrustCmd: 0,
  power: 0,
  slewRate: 0,
  enabled: true,
});

export function createAzipod3DOFState(
  x = 0,
  y = 0,
  psi = 0,
  params: Azipod3DOFParams = DEFAULT_AZIPOD_3DOF_PARAMS,
): Azipod3DOFInternalState {
  return {
    x,
    y,
    psi,
    u: 0,
    v: 0,
    r: 0,
    azipod1: createAzipodState(params.azipods[0]),
    azipod2: createAzipodState(params.azipods[1]),
    iceResistanceForce: 0,
    perturbedK: 1,
    perturbedT: 1,
    time: 0,
  };
}

export function setAzipodCommands(
  state: Azipod3DOFInternalState,
  azimuth1: number,
  thrust1: number,
  azimuth2: number,
  thrust2: number,
): Azipod3DOFInternalState {
  return {
    ...state,
    azipod1: { ...state.azipod1, azimuthCmd: azimuth1, thrustCmd: thrust1 },
    azipod2: { ...state.azipod2, azimuthCmd: azimuth2, thrustCmd: thrust2 },
  };
}

export function azipodToSimulationState(state: Azipod3DOFInternalState, _time: number) {
  const headingDeg = state.psi * RAD_TO_DEG;
  const speed = Math.sqrt(state.u * state.u + state.v * state.v);
  return {
    position: { x: state.x, z: state.y } satisfies Vector2,
    heading: ((headingDeg % 360) + 360) % 360,
    headingRad: state.psi,
    yawRate: state.r * RAD_TO_DEG,
    yawRateRad: state.r,
    rudder: 0,
    speed,
    surgeVelocity: state.u,
    swayVelocity: state.v,
  };
}

export type { DisturbanceVector };
