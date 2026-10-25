import { DRILLING_DEFAULT_DP, toDegrees, toRadians } from '../core/constants';
import {
  ContainerShipEngine,
  CruiseShipEngine,
  LNGCarrierEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  DEFAULT_AZIPOD_3DOF_PARAMS,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
  DEFAULT_ICE_BREAKING_PARAMS,
  DredgingImpactModel,
  HIGH_PRECISION_DP_GAINS,
  allocateThrust,
  azipod3dofStepRK4,
  azipodCourseKeeperControl,
  azipodCourseKeeperControlIceMode,
  computeEnvironmentLoad,
  computeTotalEnvironmentalForces,
  computeTotalPower,
  createAzipod3DOFState,
  createAzipodCourseKeeperState,
  createCurrentEnvironment,
  createDPControllerConfig,
  createDPDecouplingState,
  createDPState,
  createIceBreakingState,
  createMMG3DOFState,
  createSemiSub3DOFState,
  createThrusterConfigs,
  createWindEnvironment,
  dpControlWithFeedforward,
  dpDecoupledControl,
  dpStandardControl,
  getTypicalEnvironment,
  iceBreakingStep,
  mmg3dofStep,
  semiSub3DOFStep,
  updateCurrentEnvironment,
  updateWindEnvironment,
  type Azipod3DOFInternalState,
  type AzipodCourseKeeperState,
  type CurrentEnvironment,
  type DPDecouplingState,
  type DPState,
  type IceBreakingState,
  type MMG3DOFState,
  type SemiSubmersible3DOFState,
  type WindEnvironment,
} from '../physics/simulation-engine-facade';
import { containerMscProfile } from '../profiles/container-msc';
import { cruiseAdoraProfile } from '../profiles/cruise-adora';
import { dredgerTianjingProfile } from '../profiles/dredger-tianjing';
import { lngChanghengProfile } from '../profiles/lng-changheng';
import { signedHeading, type VesselCommand, type VesselSample } from './vessel-experiment';

function sample(time: number, dt: number, values: Record<string, number>): VesselSample {
  const finite: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) finite[key] = Number.isFinite(value) ? value : 0;
  return { time: time + dt, values: finite };
}

export interface LngView {
  position: { x: number; z: number };
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  sloshingAngle: number;
  tankPressure: number;
}

export function createLngDrive() {
  const engine = createSimulationEngine(lngChanghengProfile) as LNGCarrierEngine;
  let view: LngView = {
    position: { x: -800, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: 0,
    sloshingAngle: 0,
    tankPressure: 100,
  };
  return {
    reset(command: VesselCommand) {
      engine.initialize(command.startX, command.startZ, command.startHeading);
      engine.setSmithPredictorEnabled(command.smith);
      const state = engine.getState(0);
      const slosh = engine.getSloshingMetrics();
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        sloshingAngle: slosh.angleDeg,
        tankPressure: slosh.pressure,
      };
    },
    view: () => view,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      engine.setSmithPredictorEnabled(command.smith);
      engine.step(command.targetHeading, null, command.mode, command.manualRudder, command.manualSpeed, dt, time);
      const state = engine.getState(time + dt);
      const slosh = engine.getSloshingMetrics();
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        sloshingAngle: slosh.angleDeg,
        tankPressure: slosh.pressure,
      };
      return sample(time, dt, {
        heading: signedHeading(state.heading),
        commandHeading: command.targetHeading,
        yaw: state.yawRate,
        rudder: state.rudder,
        commandRudder: command.manualRudder,
        speed: state.speed,
        distance: Math.max(0, -state.position.x),
        slosh: slosh.angleDeg,
      });
    },
  };
}

export interface SurfaceView {
  position: { x: number; z: number };
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  rollDeg: number;
}

export function createContainerDrive() {
  const engine = createSimulationEngine(containerMscProfile) as ContainerShipEngine;
  let view: SurfaceView & { currentK: number; currentT: number } = {
    position: { x: 0, z: 0 }, heading: 0, yawRate: 0, rudder: 0, speed: 0, rollDeg: 0, currentK: 0, currentT: 0,
  };
  return {
    reset(command: VesselCommand) {
      engine.initialize(command.startX, command.startZ, command.startHeading);
      engine.setGainSchedulingEnabled(false);
      engine.setLoadRatio(command.loadRatio);
      engine.setWindEnvironment(command.windSpeed, command.windDirection, false);
      const state = engine.getState(0);
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        rollDeg: engine.getContainerShipSummary().rollDeg,
        currentK: engine.getContainerShipSummary().currentK,
        currentT: engine.getContainerShipSummary().currentT,
      };
    },
    view: () => view,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      engine.setLoadRatio(command.loadRatio);
      engine.setWindEnvironment(command.windSpeed, command.windDirection, false);
      engine.step(command.targetHeading, null, command.mode, command.manualRudder, command.manualSpeed, dt, time);
      const state = engine.getState(time + dt);
      const summary = engine.getContainerShipSummary();
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        rollDeg: summary.rollDeg,
        currentK: summary.currentK,
        currentT: summary.currentT,
      };
      return sample(time, dt, {
        speed: state.speed,
        fuel: state.speed ** 3,
        range: state.position.x,
        heading: signedHeading(state.heading),
        rudder: state.rudder,
        load: command.loadRatio,
        timeConstant: summary.currentT,
      });
    },
  };
}

export interface CruiseView extends SurfaceView {
  msi: number;
  finPower: number;
  rollRad: number;
}

export function createCruiseDrive() {
  const engine = createSimulationEngine(cruiseAdoraProfile) as CruiseShipEngine;
  let view: CruiseView = {
    position: { x: 0, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: 0,
    rollDeg: 0,
    msi: 0,
    finPower: 0,
    rollRad: 0,
  };
  return {
    reset(command: VesselCommand) {
      engine.initialize(command.startX, command.startZ, command.startHeading);
      engine.setSeaState(command.seaState, 90);
      engine.setFinStabilizerEnabled(command.fin);
      engine.setNotchFilterEnabled(true);
      const state = engine.getState(0);
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        rollDeg: toDegrees(state.waveRoll),
        rollRad: state.waveRoll,
        msi: engine.getComfortMetrics().msi,
        finPower: engine.getFinStabilizerMetrics().powerKW,
      };
    },
    view: () => view,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      engine.setSeaState(command.seaState, 90);
      engine.setFinStabilizerEnabled(command.fin);
      engine.setNotchFilterEnabled(true);
      engine.step(command.targetHeading, null, command.mode, command.manualRudder, command.manualSpeed, dt, time);
      const state = engine.getState(time + dt);
      const comfort = engine.getComfortMetrics();
      const fin = engine.getFinStabilizerMetrics();
      view = {
        position: state.position,
        heading: state.heading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        rollDeg: toDegrees(state.waveRoll),
        rollRad: state.waveRoll,
        msi: comfort.msi,
        finPower: fin.powerKW,
      };
      return sample(time, dt, {
        heading: signedHeading(state.heading),
        roll: toDegrees(state.waveRoll),
        msi: comfort.msi,
        finPower: fin.powerKW,
        speed: state.speed,
        yaw: state.yawRate,
        sea: command.seaState,
      });
    },
  };
}

export function createDredgerDrive() {
  const profile = dredgerTianjingProfile;
  const sea = {
    currentSpeed: 0.5,
    currentDirection: 45,
    windSpeed: 8,
    windDirection: 45,
  };
  let mmg: MMG3DOFState = createMMG3DOFState(0, 0, 0, 0);
  let dp: DPState = createDPState();
  const dredging = new DredgingImpactModel();
  return {
    reset(command: VesselCommand) {
      mmg = createMMG3DOFState(command.startX, command.startZ, toRadians(command.startHeading), 0);
      dp = createDPState();
      dredging.reset();
      dredging.setEnabled(command.dredging);
    },
    mmg: () => mmg,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      const now = time + dt;
      dredging.setEnabled(command.dredging);
      const digging = command.dredging ? dredging.compute(now) : { forceX: 0, forceY: 0, momentN: 0 };
      const environment = computeEnvironmentLoad({
        currentSpeed: sea.currentSpeed,
        currentDirection: sea.currentDirection,
        windSpeed: sea.windSpeed,
        windDirection: sea.windDirection,
        shipLength: profile.dimensions.length,
        shipDraft: profile.dimensions.draft,
      });
      const disturbance = {
        forceX: digging.forceX + environment.forceX,
        forceY: digging.forceY + environment.forceY,
        momentN: digging.momentN + environment.momentN,
      };
      let position = 0;
      let headingError = 0;
      let thruster: { surgeKN: number; swayKN: number; yawMomentKNm: number } | undefined;
      let rudderCommand = 0;
      if (command.dp) {
        const result = dpControlWithFeedforward(
          { x: mmg.x, y: mmg.y, psi: mmg.psi, u: mmg.u, v: mmg.v, r: mmg.r },
          { x: command.targetX, y: command.targetZ, psi: toRadians(command.targetHeading) },
          dp,
          disturbance,
          HIGH_PRECISION_DP_GAINS,
          dt,
        );
        dp = result.newState;
        rudderCommand = result.output.rudderCommand;
        position = result.metrics.positionError;
        headingError = result.metrics.headingError;
        thruster = {
          surgeKN: result.output.surgeThrust / 1000,
          swayKN: result.output.swayThrust / 1000,
          yawMomentKNm: result.output.yawMoment / 1000,
        };
      }
      mmg = mmg3dofStep(
        mmg,
        rudderCommand,
        0,
        dt,
        profile.dynamics.mmg!,
        profile.dimensions.length,
        profile.dimensions.draft,
        disturbance,
        thruster,
        true,
      );
      const drift = Math.hypot(mmg.x - command.targetX, mmg.y - command.targetZ);
      if (!command.dp) {
        position = drift;
        headingError = Math.abs(signedHeading(toDegrees(mmg.psi) - command.targetHeading));
      }
      const speed = Math.hypot(mmg.u, mmg.v);
      return sample(time, dt, {
        position,
        headingError,
        speed,
        dredging: command.dredging ? 1 : 0,
        locating: command.dp ? 1 : 0,
        drift,
      });
    },
  };
}

export interface DrillingView {
  state: SemiSubmersible3DOFState;
  positionError: number;
  headingError: number;
  power: number;
}

export function createDrillingDrive() {
  let state: SemiSubmersible3DOFState = createSemiSub3DOFState(0, 0, 0);
  let controller: DPDecouplingState = createDPDecouplingState();
  let dpConfig = createDPControllerConfig(DRILLING_DEFAULT_DP, true);
  let currentEnv: CurrentEnvironment = createCurrentEnvironment(0.5, 45, 0.1);
  let windEnv: WindEnvironment = createWindEnvironment(10, 45, 1.2);
  let meanWind = 10;
  let waveHeight = 1.5;
  let view: DrillingView = { state, positionError: 0, headingError: 0, power: 0 };
  return {
    reset(command: VesselCommand) {
      state = createSemiSub3DOFState(command.startX, command.startZ, command.startHeading, command.targetX, command.targetZ, command.targetHeading);
      controller = createDPDecouplingState();
      dpConfig = createDPControllerConfig(DRILLING_DEFAULT_DP, command.decoupling);
      const env = getTypicalEnvironment(command.seaState);
      currentEnv = createCurrentEnvironment(env.currentSpeed, 45, 0.1);
      windEnv = createWindEnvironment(env.windSpeed, 45, 1.2);
      meanWind = env.windSpeed;
      waveHeight = env.waveHeight;
      view = { state, positionError: 0, headingError: 0, power: 0 };
    },
    view: () => view,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      // 阵风抽样会让同一步的终点时大时小。实验固定环境，每次看到同一条曲线。
      currentEnv = updateCurrentEnvironment(currentEnv, dt, () => 0.5);
      windEnv = updateWindEnvironment(windEnv, dt, meanWind, () => 0.5);
      const envForces = computeTotalEnvironmentalForces(currentEnv, windEnv, waveHeight, 0, state.psi);
      state.currentForceX = envForces.forceX;
      state.currentForceY = envForces.forceY;
      state.currentMomentN = envForces.momentN;
      state.targetX = command.targetX;
      state.targetY = command.targetZ;
      state.targetPsi = toRadians(command.targetHeading);
      state.decouplingEnabled = command.decoupling;
      dpConfig.decouplingEnabled = command.decoupling;
      const control = command.decoupling ? dpDecoupledControl : dpStandardControl;
      const [output, nextController] = control(state, controller, dpConfig, dt);
      controller = nextController;
      const allocation = allocateThrust(
        [output.decoupledTauX, output.decoupledTauY, output.decoupledTauN],
        state.thrusters,
        createThrusterConfigs(),
        dt,
      );
      state.thrusters = allocation.thrusters;
      state = semiSub3DOFStep(
        state,
        [allocation.totalForceX * 1000, allocation.totalForceY * 1000, allocation.totalMomentN * 1000],
        [envForces.forceX, envForces.forceY, envForces.momentN],
        dt,
      );
      const position = Math.hypot(output.errorX, output.errorY);
      const headingError = Math.abs(output.errorPsi);
      const power = computeTotalPower(state.thrusters);
      const thrusters = state.thrusters.filter((thruster) => thruster.enabled && !thruster.failed).length;
      view = { state, positionError: position, headingError, power };
      return sample(time, dt, {
        position,
        headingError,
        power,
        thrusters,
        decoupling: command.decoupling ? 1 : 0,
      });
    },
  };
}

export interface IceView {
  psi: number;
  speed: number;
  azimuthDeg: number;
  iceForce: number;
  x: number;
  y: number;
}

export function createIceDrive() {
  let state: Azipod3DOFInternalState = createAzipod3DOFState(0, 0, 0);
  let ice = createIceBreakingState();
  let keeper: AzipodCourseKeeperState = createAzipodCourseKeeperState();
  let view: IceView = { psi: 0, speed: 0, azimuthDeg: 0, iceForce: 0, x: 0, y: 0 };
  return {
    reset(command: VesselCommand) {
      state = createAzipod3DOFState(command.startX, command.startZ, toRadians(command.startHeading));
      ice = createIceBreakingState();
      keeper = createAzipodCourseKeeperState();
      view = { psi: state.psi, speed: 0, azimuthDeg: 0, iceForce: 0, x: state.x, y: state.y };
    },
    view: () => view,
    physics: () => state,
    iceState: () => ice,
    step(command: VesselCommand, dt: number, time: number): VesselSample {
      const heading = toDegrees(state.psi);
      const yaw = toDegrees(state.r);
      const speed = Math.hypot(state.u, state.v);
      let iceResistance = 0;
      let perturbedK = 1;
      if (command.ice && command.iceThickness > 0) {
        ice = iceBreakingStep(ice, { ...DEFAULT_ICE_BREAKING_PARAMS, enabled: true, iceThickness: command.iceThickness }, speed, dt);
        iceResistance = ice.resistanceForce;
        perturbedK = ice.currentK;
      }
      if (command.mode !== 'manual') {
        keeper = command.ice
          ? azipodCourseKeeperControlIceMode(keeper, heading, command.targetHeading, yaw, speed, command.mode, perturbedK, dt, time)
          : azipodCourseKeeperControl(keeper, heading, command.targetHeading, yaw, speed, command.mode, DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG, 1, dt, time);
        state.azipod1.azimuthCmd = keeper.azimuth1Cmd;
        state.azipod2.azimuthCmd = keeper.azimuth2Cmd;
        state.azipod1.thrustCmd = keeper.thrust1Cmd;
        state.azipod2.thrustCmd = keeper.thrust2Cmd;
      }
      state = azipod3dofStepRK4(state, DEFAULT_AZIPOD_3DOF_PARAMS, iceResistance, dt);
      const azimuth = toDegrees(state.azipod1.azimuth);
      view = {
        psi: state.psi,
        speed: Math.hypot(state.u, state.v),
        azimuthDeg: azimuth,
        iceForce: iceResistance / 1000,
        x: state.x,
        y: state.y,
      };
      return sample(time, dt, {
        heading: signedHeading(toDegrees(state.psi)),
        commandHeading: command.targetHeading,
        yaw: toDegrees(state.r),
        azimuth,
        iceForce: iceResistance / 1000,
        speed: view.speed,
      });
    },
  };
}
