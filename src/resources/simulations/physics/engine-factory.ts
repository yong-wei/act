/**
 * 仿真引擎工厂
 * 根据船舶配置创建对应的物理引擎
 */

import type {
  PhysicsModelType,
  SimulationState,
  SimulationMetrics,
  ControlMode,
  DisturbanceVector,
  PIDGains,
  DPGains,
  EthicalViolation,
  Vector2,
} from '../core/types';
import {
  createSimulationRng,
  type RandomNumberGenerator,
  type SimulationRunContext,
} from '../core/seeded-rng';
import type { ShipProfile } from '../core/ship-profile';
import {
  nomotoStepRK4,
  createNomotoState,
  nomotoToSimulationState,
  type NomotoState,
} from './simulation-engine-facade';
import {
  mmg3dofStep,
  type MmgThrusterCommand,
  createMMG3DOFState,
  mmgToSimulationState,
  type MMG3DOFState,
  DEFAULT_MMG_PARAMS,
} from './simulation-engine-facade';
import type { PIDControllerState } from './controllers/pid-controller';
import { createPIDControllerState } from './controllers/pid-controller';
import {
  dpControlWithFeedforward,
  createDPState,
  type DPTarget,
  type DPCurrentState,
  type DPState,
} from './simulation-engine-facade';
import {
  DredgingImpactModel,
} from './simulation-engine-facade';
import {
  nomoto2ndOrderDelayStep,
  createNomoto2ndOrderDelayState,
  pidControl2ndOrder,
  DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
  type Nomoto2ndOrderDelayState,
} from './simulation-engine-facade';
import {
  sloshingStep,
  computeSloshingMoment,
  type SloshingState,
} from './simulation-engine-facade';
import { createSloshingState, getSloshingMetrics, shouldTriggerSloshingAlarm, DEFAULT_SLOSHING_PARAMS } from './disturbances/sloshing-model';
import {
  smithPredictorControl,
} from './simulation-engine-facade';
import {
  createSmithPredictorFullState,
  type SmithPredictorFullState,
  type SmithPredictorConfig,
} from './controllers/smith-predictor';
import {
  createContainerShipState,
  nomotoVariableMassStep,
  updateLoadRatio,
  rollStep,
  getContainerShipSummary,
  shouldTriggerRollAlarm,
  type ContainerShipState,
} from './simulation-engine-facade';
import {
  windLoadStep,
} from './simulation-engine-facade';
import { createWindEnvironment, shouldTriggerWindAlarm, getWindLoadMetrics, type WindEnvironment } from './disturbances/wind-load';
import {
  computePracticeGainScheduleStep,
} from './simulation-engine-facade';
import type { SchedulerDiagnostics } from './controllers/gain-scheduler';
import {
  DEFAULT_NOMOTO_PARAMS,
  ETHICAL_THRESHOLDS,
  DEFAULT_PID_GAINS,
  LNG_CHANGHENG_PARAMS,
  LNG_SLOSHING_PARAMS,
  LNG_DEFAULT_PID,
  LNG_ETHICAL_THRESHOLDS,
  CONTAINER_MSC_PARAMS,
  CONTAINER_GAIN_SCHEDULE,
  CONTAINER_DEFAULT_PID,
  CONTAINER_ETHICAL_THRESHOLDS,
  CRUISE_ADORA_PARAMS,
  CRUISE_DEFAULT_PID,
  CRUISE_ETHICAL_THRESHOLDS,
  CRUISE_COMFORT_THRESHOLDS,
  FIN_STABILIZER_PARAMS,
  NOTCH_FILTER_DEFAULTS,
  clamp,
  toDegrees,
  toRadians,
} from '../core/constants';
import {
  computePracticeCruiseLiveStep,
  computePracticeCruiseComfortRealtime,
  computePracticePidControl,
  createRollCoupledState,
  DEFAULT_ROLL_COUPLED_PARAMS,
  type RollCoupledState,
} from './simulation-engine-facade';
import {
  createFinStabilizerState,
  getFinStabilizerMetrics,
  isFinPowerExceeded,
  type FinStabilizerState,
} from './disturbances/fin-stabilizer';
import {
  createNotchFilterState,
  generateBodePlot,
  getNotchFilterMetrics,
  DEFAULT_NOTCH_PARAMS,
  type NotchFilterState,
} from './controllers/notch-filter';
import {
  createComfortMetrics,
  getComfortRatingDescription,
  isComfortExceeded,
  type ComfortMetrics,
} from '../lib/comfort-metrics';
import {
  createSemiSub3DOFState,
  semiSub3DOFStep,
  semiSubToSimulationState,
  type SemiSubmersible3DOFState as SemiSub3DOFInternalState,
} from './simulation-engine-facade';
import {
  createCurrentEnvironment,
  createWindEnvironment as createCurrentWindEnvironment,
  updateCurrentEnvironment,
  updateWindEnvironment as updateCurrentWindEnvironment,
  computeTotalEnvironmentalForces,
  getTypicalEnvironment,
  type CurrentEnvironment,
  type WindEnvironment as CurrentWindEnvironment,
} from './simulation-engine-facade';
import {
  allocateThrust,
  createThrusterConfigs,
  simulateThrusterFailure,
  computeTotalPower,
  getThrusterSummary,
} from './simulation-engine-facade';
import {
  dpDecoupledControl,
  dpStandardControl,
  createDPControllerConfig,
  createDPDecouplingState,
} from './simulation-engine-facade';
import {
  createPerformanceTracker,
  updatePerformanceTracker,
  computePerformanceMetrics,
  formatDPControlOutput,
  getDecouplingMatrixDescription,
  type DPControllerConfig,
  type DPControlOutput,
  type DPState as DPDecouplingState,
} from './controllers/dp-decoupling-controller';
import {
  HYSY981_PLATFORM_PARAMS,
  HYSY981_THRUSTER_LAYOUT,
  DRILLING_DEFAULT_DP,
  DRILLING_ETHICAL_THRESHOLDS,
  XUELONG_ICEBREAKER_PARAMS,
  XUELONG_AZIPOD_PARAMS,
  XUELONG_ICE_PARAMS,
  XUELONG_ETHICAL_THRESHOLDS,
  XUELONG_DEFAULT_GAINS,
} from '../core/constants';
import {
  createAzipod3DOFState,
  azipod3dofStepRK4,
  azipodToSimulationState,
  setAzipodCommands,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
} from './simulation-engine-facade';
import {
  createIceBreakingState,
  iceBreakingStep,
  getIceBreakingSummary,
  shouldTriggerIceAlarm,
  computePropellerStress,
  type IceBreakingState,
  DEFAULT_ICE_BREAKING_PARAMS,
} from './simulation-engine-facade';
import {
  createAzipodCourseKeeperState,
  azipodCourseKeeperControl,
  azipodCourseKeeperControlIceMode,
  getAzipodControllerDiagnostics,
  type AzipodCourseKeeperState,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
} from './simulation-engine-facade';
import type { IcebreakerProfile } from '../profiles/icebreaker-xuelong';

// ============ 引擎接口 ============

/** 仿真引擎接口 */
export interface SimulationEngine {
  /** 初始化引擎 */
  initialize(startX: number, startZ: number, startHeading: number): void;

  /** 执行一步仿真 */
  step(
    targetHeading: number,
    targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void;

  /** 获取当前仿真状态 */
  getState(time: number): SimulationState;

  /** 获取当前指标 */
  getMetrics(): SimulationMetrics;

  /** 检测伦理违规 */
  checkViolations(): EthicalViolation[];

  /** 重置引擎 */
  reset(): void;

  /** 更新 PID 增益 */
  setPIDGains(gains: PIDGains): void;

  /** 更新 DP 增益 */
  setDPGains?(gains: DPGains): void;

  /** 启用/禁用扰动 */
  setDisturbanceEnabled?(enabled: boolean): void;
}

export interface SimulationEngineOptions {
  runContext?: SimulationRunContext;
}

// ============ Nomoto 引擎实现 ============

/** Nomoto 一阶模型引擎 */
export class Nomoto1stOrderEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: NomotoState;
  private pidState: PIDControllerState;
  private pidMode: ControlMode = 'pid';
  private pidGains: PIDGains;
  private prevRudder: number = 0;
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxRudderRate: number = 0;
  private violations: EthicalViolation[] = [];

  constructor(profile: ShipProfile) {
    this.profile = profile;
    this.state = createNomotoState();
    this.pidState = createPIDControllerState();
    this.pidGains = profile.control.defaultPID ?? DEFAULT_PID_GAINS;
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    const speed = this.profile.dynamics.nomoto?.speedMps ??
      DEFAULT_NOMOTO_PARAMS.speedMps;
    this.state = createNomotoState(startX, startZ, startHeading, speed);
    this.pidState = createPIDControllerState();
    this.prevRudder = 0;
    this.totalError = 0;
    this.errorCount = 0;
    this.maxRudderRate = 0;
    this.violations = [];
  }

  step(
    targetHeading: number,
    _targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    _time: number
  ): void {
    // 获取舵角
    let rudderDeg: number;
    if (controlMode === 'manual') {
      rudderDeg = manualRudder;
      this.state.speedMps = manualSpeed;
    } else {
      this.pidMode = controlMode;
      const currentHeading = toDegrees(this.state.headingRad);
      const result = computePracticePidControl({
        dt,
        targetHeading,
        currentHeading,
        controlMode: this.pidMode,
        gains: this.pidGains,
        maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
        state: this.pidState,
      });
      this.pidState = result.newState;
      rudderDeg = result.output.rudderDeg;
    }

    // 计算舵角速率
    const rudderRate = Math.abs(rudderDeg - this.prevRudder) / dt;
    if (rudderRate > this.maxRudderRate) {
      this.maxRudderRate = rudderRate;
    }
    this.prevRudder = rudderDeg;

    // 检测舵角速率违规
    if (rudderRate > ETHICAL_THRESHOLDS.MAX_RUDDER_RATE) {
      this.violations.push({
        type: 'EXCESSIVE_RUDDER_RATE',
        thresholdValue: ETHICAL_THRESHOLDS.MAX_RUDDER_RATE,
        actualValue: rudderRate,
        timestamp: _time,
        description: `舵角变化速度过快: ${rudderRate.toFixed(2)}°/s`,
        severity: rudderRate > ETHICAL_THRESHOLDS.MAX_RUDDER_RATE * 1.5 ? 'critical' : 'warning',
      });
    }

    // Nomoto 参数
    const params = {
      ...DEFAULT_NOMOTO_PARAMS,
      ...this.profile.dynamics.nomoto,
    };

    // 步进
    this.state = nomotoStepRK4(this.state, rudderDeg, dt, params);

    // 累计误差
    const headingError = Math.abs(toDegrees(this.state.headingRad) - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const base = nomotoToSimulationState(this.state, time);
    return {
      position: base.position,
      heading: base.heading,
      headingRad: base.headingRad,
      yawRate: base.yawRate,
      yawRateRad: base.yawRateRad,
      rudder: base.rudder,
      speed: base.speed,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: this.maxRudderRate,
      currentError: 0,
      energyConsumption: 0,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    this.pidGains = { ...this.pidGains, ...gains };
  }
}

// ============ MMG 3-DOF 引擎实现 ============

/** MMG 三自由度模型引擎 (用于挖泥船等) */
export class MMG3DOFEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: MMG3DOFState;
  private pidState: PIDControllerState;
  private pidMode: ControlMode = 'pid';
  private pidGains: PIDGains;
  private dpState: DPState;
  private dpGains: DPGains;
  private dredgingModel: DredgingImpactModel | null = null;
  private prevRudder: number = 0;
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxRudderRate: number = 0;
  private maxPositionError: number = 0;
  private violations: EthicalViolation[] = [];
  private dpThruster?: MmgThrusterCommand;
  private positionAlarmSince: number | null = null;
  private positionAlarmActive = false;
  private runContext?: SimulationRunContext;

  constructor(profile: ShipProfile, options: SimulationEngineOptions = {}) {
    this.profile = profile;
    this.runContext = options.runContext;
    this.state = createMMG3DOFState();
    this.pidState = createPIDControllerState();
    this.pidGains = profile.control.defaultPID ?? DEFAULT_PID_GAINS;
    this.dpState = createDPState();
    this.dpGains = profile.control.defaultDP ?? {
      surge: { kp: 50000, ki: 2000, kd: 30000 },
      sway: { kp: 80000, ki: 3000, kd: 40000 },
      yaw: { kp: 5e8, ki: 1e7, kd: 2e8 },
    };

    // 如果配置了挖掘扰动模式，创建扰动模型
    if (profile.dynamics.modifications.disturbancePattern === 'step_impulse_mixed') {
      this.dredgingModel = new DredgingImpactModel({}, () => this.createDredgingRng());
    }
  }

  private createDredgingRng(): RandomNumberGenerator {
    return this.runContext
      ? createSimulationRng(this.runContext, 'engine/mmg-dredging').next
      : Math.random;
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    const speed = this.profile.dynamics.speed.cruise;
    this.state = createMMG3DOFState(
      startX,
      startZ,
      toRadians(startHeading),
      speed
    );
    this.pidState = createPIDControllerState();
    this.dpState = createDPState();
    this.prevRudder = 0;
    this.totalError = 0;
    this.errorCount = 0;
    this.maxRudderRate = 0;
    this.maxPositionError = 0;
    this.violations = [];
    this.dredgingModel?.reset();
  }

  step(
    targetHeading: number,
    targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void {
    // 计算扰动
    let disturbance: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 };
    if (this.dredgingModel) {
      disturbance = this.dredgingModel.compute(time);
    }

    // 控制计算
    let rudderCommand: number;
    let propellerRPM = 80;

    if (controlMode === 'manual') {
      rudderCommand = toRadians(manualRudder);
      // 根据手动速度调整转速
      propellerRPM = (manualSpeed / this.profile.dynamics.speed.max) * 120;
    } else if (controlMode === 'dp' && targetPosition) {
      // 动力定位控制
      const target: DPTarget = {
        x: targetPosition.x,
        y: targetPosition.z,
        psi: toRadians(targetHeading),
      };
      const current: DPCurrentState = {
        x: this.state.x,
        y: this.state.y,
        psi: this.state.psi,
        u: this.state.u,
        v: this.state.v,
        r: this.state.r,
      };

      const dpResult = dpControlWithFeedforward(
        current,
        target,
        this.dpState,
        disturbance,
        this.dpGains,
        dt
      );

      this.dpState = dpResult.newState;
      rudderCommand = dpResult.output.rudderCommand;
      // 四通道执行（#1944 同步修复）：DP 推力直接驱动 mmg3dof，rpm 置零避免重复推力
      propellerRPM = 0;
      this.dpThruster = {
        surgeKN: dpResult.output.surgeThrust / 1000,
        swayKN: dpResult.output.swayThrust / 1000,
        yawMomentKNm: dpResult.output.yawMoment / 1000,
      };

      // 记录位置误差
      if (dpResult.metrics.positionError > this.maxPositionError) {
        this.maxPositionError = dpResult.metrics.positionError;
      }

      // 定位精度告警滞回（#1944 解耦：持续超限 10s 记录一次，恢复后清除）
      if (dpResult.metrics.positionError > 0.1) {
        this.positionAlarmSince ??= time;
        if (
          !this.positionAlarmActive
          && time - this.positionAlarmSince >= 10
        ) {
          this.positionAlarmActive = true;
          this.violations.push({
            type: 'SAFETY_VIOLATION',
            thresholdValue: 0.1,
            actualValue: dpResult.metrics.positionError,
            timestamp: time,
            description: `定位误差持续超限 10 秒: ${dpResult.metrics.positionError.toFixed(3)}m`,
            severity: dpResult.metrics.positionError > 0.5 ? 'critical' : 'warning',
          });
        }
      } else if (!this.positionAlarmActive || dpResult.metrics.positionError < 0.05) {
        this.positionAlarmSince = null;
        if (this.positionAlarmActive && dpResult.metrics.positionError < 0.05) {
          this.positionAlarmActive = false;
        }
      }
    } else {
      this.dpThruster = undefined;
      // 航向控制
      this.pidMode = controlMode;
      const currentHeading = toDegrees(this.state.psi);
      const result = computePracticePidControl({
        dt,
        targetHeading,
        currentHeading,
        controlMode: this.pidMode,
        gains: this.pidGains,
        maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
        state: this.pidState,
      });
      this.pidState = result.newState;
      rudderCommand = toRadians(result.output.rudderDeg);
    }

    // 计算舵角速率
    const currentRudderDeg = toDegrees(this.state.rudderAngle);
    const newRudderDeg = toDegrees(rudderCommand);
    const rudderRate = Math.abs(newRudderDeg - currentRudderDeg) / dt;
    if (rudderRate > this.maxRudderRate) {
      this.maxRudderRate = rudderRate;
    }

    // MMG 参数
    const mmgParams = this.profile.dynamics.mmg ?? DEFAULT_MMG_PARAMS;
    const shipLength = this.profile.dimensions.length;
    const shipDraft = this.profile.dimensions.draft;

    // 步进
    this.state = mmg3dofStep(
      this.state,
      rudderCommand,
      propellerRPM,
      dt,
      mmgParams,
      shipLength,
      shipDraft,
      disturbance,
      this.dpThruster
    );

    // 累计误差
    const headingError = Math.abs(toDegrees(this.state.psi) - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const base = mmgToSimulationState(this.state, time);
    return {
      position: base.position,
      heading: base.heading,
      headingRad: base.headingRad,
      yawRate: base.yawRate,
      yawRateRad: base.yawRateRad,
      rudder: base.rudder,
      speed: base.speed,
      surgeVelocity: base.surgeVelocity,
      swayVelocity: base.swayVelocity,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: this.maxRudderRate,
      currentError: 0,
      energyConsumption: 0,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
      positionError: this.maxPositionError,
      maxPositionError: this.maxPositionError,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    this.pidGains = { ...this.pidGains, ...gains };
  }

  setDPGains(gains: DPGains): void {
    this.dpGains = gains;
  }

  setDisturbanceEnabled(enabled: boolean): void {
    this.dredgingModel?.setEnabled(enabled);
  }
}

// ============ LNG 引擎实现 ============

/** LNG 船引擎 (带时滞和晃荡) */
export class LNGCarrierEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: Nomoto2ndOrderDelayState;
  private sloshingState: SloshingState;
  private pidState: { integral: number; prevError: number };
  private smithState: SmithPredictorFullState | null = null;
  private smithEnabled: boolean = false;
  private smithConfig: SmithPredictorConfig;
  private prevRudder: number = 0;
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxRudderRate: number = 0;
  private maxSloshingAngle: number = 0;
  private violations: EthicalViolation[] = [];

  constructor(profile: ShipProfile) {
    this.profile = profile;

    // 获取时滞参数
    const timeDelay = profile.dynamics.modifications.timeDelay ??
      LNG_CHANGHENG_PARAMS.TIME_DELAY;

    const nomotoParams = {
      ...DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
      K: profile.dynamics.nomoto?.K ?? LNG_CHANGHENG_PARAMS.K,
      T1: profile.dynamics.nomoto?.T1 ?? LNG_CHANGHENG_PARAMS.T1,
      T2: profile.dynamics.nomoto?.T2 ?? LNG_CHANGHENG_PARAMS.T2,
      timeDelay,
      maxRudderDeg: profile.dynamics.rudder.maxAngle,
      speedMps: profile.dynamics.speed.cruise,
    };

    // 初始化状态
    this.state = createNomoto2ndOrderDelayState(nomotoParams, 0.5);
    this.sloshingState = createSloshingState(LNG_SLOSHING_PARAMS.BASE_PRESSURE);
    this.pidState = { integral: 0, prevError: 0 };

    // Smith 预估器配置
    this.smithConfig = {
      modelK: nomotoParams.K,
      modelT: nomotoParams.T1,
      modelDelay: timeDelay,
      dt: 0.5,
    };
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    const timeDelay = this.profile.dynamics.modifications.timeDelay ??
      LNG_CHANGHENG_PARAMS.TIME_DELAY;

    const nomotoParams = {
      ...DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
      K: this.profile.dynamics.nomoto?.K ?? LNG_CHANGHENG_PARAMS.K,
      T1: this.profile.dynamics.nomoto?.T1 ?? LNG_CHANGHENG_PARAMS.T1,
      T2: this.profile.dynamics.nomoto?.T2 ?? LNG_CHANGHENG_PARAMS.T2,
      timeDelay,
      maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
      speedMps: this.profile.dynamics.speed.cruise,
    };

    this.state = createNomoto2ndOrderDelayState(
      nomotoParams,
      0.5,
      startX,
      startZ,
      startHeading
    );
    this.sloshingState = createSloshingState(LNG_SLOSHING_PARAMS.BASE_PRESSURE);
    this.pidState = { integral: 0, prevError: 0 };

    if (this.smithEnabled) {
      this.smithState = createSmithPredictorFullState(this.smithConfig);
    }

    this.prevRudder = 0;
    this.totalError = 0;
    this.errorCount = 0;
    this.maxRudderRate = 0;
    this.maxSloshingAngle = 0;
    this.violations = [];
  }

  step(
    targetHeading: number,
    _targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void {
    // 获取 Nomoto 参数
    const timeDelay = this.profile.dynamics.modifications.timeDelay ??
      LNG_CHANGHENG_PARAMS.TIME_DELAY;

    const nomotoParams = {
      ...DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
      K: this.profile.dynamics.nomoto?.K ?? LNG_CHANGHENG_PARAMS.K,
      T1: this.profile.dynamics.nomoto?.T1 ?? LNG_CHANGHENG_PARAMS.T1,
      T2: this.profile.dynamics.nomoto?.T2 ?? LNG_CHANGHENG_PARAMS.T2,
      timeDelay,
      maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
      speedMps: this.profile.dynamics.speed.cruise,
    };

    // 控制计算
    let rudderDeg: number;
    const currentHeading = toDegrees(this.state.headingRad);
    const currentYawRate = toDegrees(this.state.yawRateRad);

    if (controlMode === 'manual') {
      rudderDeg = manualRudder;
      this.state.speedMps = manualSpeed;
    } else if (this.smithEnabled && this.smithState) {
      // Smith 预估器控制
      const gains = this.profile.control.defaultPID ?? LNG_DEFAULT_PID;
      const result = smithPredictorControl(
        targetHeading,
        currentHeading,
        this.smithState,
        gains,
        this.smithConfig,
        nomotoParams.maxRudderDeg
      );
      rudderDeg = result.rudderDeg;
      this.smithState = result.newState;
    } else {
      // 常规 PID 控制
      const gains = this.profile.control.defaultPID ?? LNG_DEFAULT_PID;
      const pidMode = controlMode === 'autopilot' ? 'pid' : controlMode;
      const result = pidControl2ndOrder(
        targetHeading,
        currentHeading,
        currentYawRate,
        this.pidState,
        gains,
        pidMode as 'manual' | 'p' | 'pd' | 'pid',
        dt,
        nomotoParams.maxRudderDeg
      );
      rudderDeg = result.rudderDeg;
      this.pidState = result.newState;
    }

    // 计算舵角速率
    const rudderRate = Math.abs(rudderDeg - this.prevRudder) / dt;
    if (rudderRate > this.maxRudderRate) {
      this.maxRudderRate = rudderRate;
    }
    this.prevRudder = rudderDeg;

    // 舵角速率违规检测
    const maxRudderRate = LNG_ETHICAL_THRESHOLDS.MAX_RUDDER_RATE;
    if (rudderRate > maxRudderRate) {
      this.violations.push({
        type: 'EXCESSIVE_RUDDER_RATE',
        thresholdValue: maxRudderRate,
        actualValue: rudderRate,
        timestamp: time,
        description: `舵角变化速度过快: ${rudderRate.toFixed(2)}°/s`,
        severity: rudderRate > maxRudderRate * 1.5 ? 'critical' : 'warning',
      });
    }

    // Nomoto 二阶模型步进
    this.state = nomoto2ndOrderDelayStep(this.state, rudderDeg, dt, nomotoParams);

    // 液货晃荡步进 (如果启用)
    if (this.profile.dynamics.modifications.sloshingEffect) {
      const sloshingParams = {
        ...DEFAULT_SLOSHING_PARAMS,
        naturalFreq: LNG_SLOSHING_PARAMS.NATURAL_FREQ,
        damping: LNG_SLOSHING_PARAMS.DAMPING,
        coupling: LNG_SLOSHING_PARAMS.COUPLING,
        inertia: LNG_SLOSHING_PARAMS.INERTIA,
        basePressure: LNG_SLOSHING_PARAMS.BASE_PRESSURE,
        pressureSensitivity: LNG_SLOSHING_PARAMS.PRESSURE_SENSITIVITY,
      };

      this.sloshingState = sloshingStep(
        this.sloshingState,
        this.state.yawRateRad,
        dt,
        sloshingParams
      );

      // 晃荡力矩反作用于船体
      const sloshingMoment = computeSloshingMoment(this.sloshingState, sloshingParams);
      // 简化处理: 晃荡影响航向角速度
      this.state.yawRateRad += sloshingMoment * dt / LNG_CHANGHENG_PARAMS.MOMENT_OF_INERTIA * 1e-10;

      // 记录最大晃荡角
      const sloshingAngleDeg = toDegrees(Math.abs(this.sloshingState.angle));
      if (sloshingAngleDeg > this.maxSloshingAngle) {
        this.maxSloshingAngle = sloshingAngleDeg;
      }

      // 晃荡违规检测
      const alarm = shouldTriggerSloshingAlarm(
        this.sloshingState,
        LNG_ETHICAL_THRESHOLDS.MAX_SLOSHING_ANGLE,
        LNG_ETHICAL_THRESHOLDS.MAX_TANK_PRESSURE
      );

      if (alarm.angleAlarm) {
        this.violations.push({
          type: 'SLOSHING_EXCEEDED',
          thresholdValue: LNG_ETHICAL_THRESHOLDS.MAX_SLOSHING_ANGLE,
          actualValue: sloshingAngleDeg,
          timestamp: time,
          description: alarm.message ?? '液货晃荡过大',
          severity: sloshingAngleDeg > LNG_ETHICAL_THRESHOLDS.MAX_SLOSHING_ANGLE * 1.5 ? 'critical' : 'warning',
        });
      }

      if (alarm.pressureAlarm) {
        this.violations.push({
          type: 'TANK_PRESSURE_EXCEEDED',
          thresholdValue: LNG_ETHICAL_THRESHOLDS.MAX_TANK_PRESSURE,
          actualValue: this.sloshingState.tankPressure,
          timestamp: time,
          description: alarm.message ?? '货舱压力超限',
          severity: 'critical',
        });
      }
    }

    // 累计误差
    const headingError = Math.abs(currentHeading - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const heading = toDegrees(this.state.headingRad);
    const yawRate = toDegrees(this.state.yawRateRad);

    return {
      position: { x: this.state.positionX, z: this.state.positionZ },
      heading: ((heading % 360) + 360) % 360,
      headingRad: this.state.headingRad,
      yawRate,
      yawRateRad: this.state.yawRateRad,
      rudder: this.state.rudderDeg,
      speed: this.state.speedMps,
      waveY: 0,
      wavePitch: 0,
      waveRoll: this.sloshingState.angle * 0.1, // 晃荡影响船体横摇
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: this.maxRudderRate,
      currentError: 0,
      energyConsumption: 0,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    // PID 增益存储在 profile 中
    if (this.profile.control.defaultPID) {
      Object.assign(this.profile.control.defaultPID, gains);
    }
  }

  /** 启用/禁用 Smith 预估器 */
  setSmithPredictorEnabled(enabled: boolean): void {
    this.smithEnabled = enabled;
    if (enabled && !this.smithState) {
      this.smithState = createSmithPredictorFullState(this.smithConfig);
    }
  }

  /** 获取晃荡状态 */
  getSloshingState(): SloshingState {
    return { ...this.sloshingState };
  }

  /** 获取晃荡指标 */
  getSloshingMetrics() {
    return getSloshingMetrics(this.sloshingState);
  }
}

// ============ 集装箱船引擎实现 ============

/** 集装箱船引擎 (变质量 + 风载荷 + 增益调度) */
export class ContainerShipEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: ContainerShipState;
  private pidState: PIDControllerState;
  private currentGains: PIDGains;
  private targetGains: PIDGains;
  private schedulingEnabled: boolean;
  private controlMode: ControlMode;
  private windEnvironment: WindEnvironment;
  private prevRudder: number = 0;
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxRudderRate: number = 0;
  private maxRollAngle: number = 0;
  private violations: EthicalViolation[] = [];

  constructor(profile: ShipProfile) {
    this.profile = profile;

    // 初始化状态
    this.state = createContainerShipState(0.5, 0, 0, 0);
    const schedule = profile.control.gainSchedule ?? CONTAINER_GAIN_SCHEDULE;
    this.currentGains = {
      kp: schedule.empty.kp + (schedule.full.kp - schedule.empty.kp) * 0.5,
      ki: schedule.empty.ki + (schedule.full.ki - schedule.empty.ki) * 0.5,
      kd: schedule.empty.kd + (schedule.full.kd - schedule.empty.kd) * 0.5,
    };
    this.targetGains = { ...this.currentGains };
    this.pidState = createPIDControllerState();
    this.schedulingEnabled = profile.control.defaultMode === 'pid_scheduled';
    this.controlMode = this.schedulingEnabled ? 'pid_scheduled' : 'pid';

    // 初始化风环境
    this.windEnvironment = createWindEnvironment(10, 45, false);
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    const initialLoadRatio = 0.5;  // 默认半载
    this.state = createContainerShipState(
      initialLoadRatio,
      startHeading,
      startX,
      startZ
    );
    this.state.speedMps = this.profile.dynamics.speed.cruise;

    this.pidState = createPIDControllerState();
    this.schedulingEnabled = this.profile.control.defaultMode === 'pid_scheduled';
    this.controlMode = this.schedulingEnabled ? 'pid_scheduled' : 'pid';
    const schedule = this.profile.control.gainSchedule ?? CONTAINER_GAIN_SCHEDULE;
    this.currentGains = {
      kp: schedule.empty.kp + (schedule.full.kp - schedule.empty.kp) * initialLoadRatio,
      ki: schedule.empty.ki + (schedule.full.ki - schedule.empty.ki) * initialLoadRatio,
      kd: schedule.empty.kd + (schedule.full.kd - schedule.empty.kd) * initialLoadRatio,
    };
    this.targetGains = { ...this.currentGains };

    this.windEnvironment = createWindEnvironment(10, 45, false);

    this.prevRudder = 0;
    this.totalError = 0;
    this.errorCount = 0;
    this.maxRudderRate = 0;
    this.maxRollAngle = 0;
    this.violations = [];
  }

  step(
    targetHeading: number,
    _targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void {
    this.schedulingEnabled = controlMode === 'pid_scheduled';
    this.controlMode = controlMode;

    let rudderDeg: number;
    const currentHeading = toDegrees(this.state.headingRad);

    if (controlMode === 'manual') {
      rudderDeg = manualRudder;
      this.state.speedMps = manualSpeed;
    } else {
      const scheduled = computePracticeGainScheduleStep({
        dt,
        targetHeading,
        currentHeading,
        controlMode,
        schedulingVariable: this.state.loadRatio,
        schedulingEnabled: this.schedulingEnabled,
        currentGains: this.currentGains,
        targetGains: this.targetGains,
        schedule: this.profile.control.gainSchedule ?? CONTAINER_GAIN_SCHEDULE,
        smoothingFactor: 0.1,
        pidState: this.pidState,
        maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
        derivativeFilter: 0.1,
        rateLimit: this.profile.dynamics.rudder.maxRate,
      });
      this.pidState = scheduled.pidState;
      this.currentGains = scheduled.currentGains;
      this.targetGains = scheduled.targetGains;
      rudderDeg = scheduled.output.rudderDeg;
    }

    // 计算舵角速率
    const rudderRate = Math.abs(rudderDeg - this.prevRudder) / dt;
    if (rudderRate > this.maxRudderRate) {
      this.maxRudderRate = rudderRate;
    }
    this.prevRudder = rudderDeg;

    // 舵角速率违规检测
    const maxRudderRate = CONTAINER_ETHICAL_THRESHOLDS.MAX_RUDDER_RATE;
    if (rudderRate > maxRudderRate) {
      this.violations.push({
        type: 'EXCESSIVE_RUDDER_RATE',
        thresholdValue: maxRudderRate,
        actualValue: rudderRate,
        timestamp: time,
        description: `舵角变化速度过快: ${rudderRate.toFixed(2)}°/s`,
        severity: rudderRate > maxRudderRate * 1.5 ? 'critical' : 'warning',
      });
    }

    // 更新风载荷
    if (this.profile.dynamics.modifications.windLoadEffect) {
      this.state.windLoad = windLoadStep(
        this.state.headingRad,
        this.state.loadRatio,
        this.windEnvironment,
        time
      );

      // 风速违规检测
      const windAlarm = shouldTriggerWindAlarm(this.windEnvironment, this.state.windLoad, {
        maxSpeed: CONTAINER_ETHICAL_THRESHOLDS.MAX_WIND_SPEED,
      });

      if (windAlarm.speedAlarm && !this.violations.some(v => v.type === 'WIND_SPEED_EXCEEDED' && time - v.timestamp < 10)) {
        this.violations.push({
          type: 'WIND_SPEED_EXCEEDED',
          thresholdValue: CONTAINER_ETHICAL_THRESHOLDS.MAX_WIND_SPEED,
          actualValue: this.windEnvironment.speed,
          timestamp: time,
          description: windAlarm.message ?? '风速超限',
          severity: 'critical',
        });
      }
    }

    // 变质量 Nomoto 模型步进
    const externalMoment = this.state.windLoad.moment;
    this.state = nomotoVariableMassStep(this.state, rudderDeg, dt, externalMoment);

    // 横摇动力学步进
    if (this.profile.dynamics.modifications.rollDynamics) {
      this.state.roll = rollStep(
        this.state.roll,
        this.state.windLoad.moment,
        this.state.yawRateRad,
        this.state.loadRatio,
        dt
      );

      // 记录最大横摇角
      const rollAngleDeg = toDegrees(Math.abs(this.state.roll.angle));
      if (rollAngleDeg > this.maxRollAngle) {
        this.maxRollAngle = rollAngleDeg;
      }

      // 横摇违规检测
      const rollAlarm = shouldTriggerRollAlarm(
        this.state,
        CONTAINER_ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE,
        CONTAINER_ETHICAL_THRESHOLDS.CARGO_SHIFT_ROLL
      );

      if (rollAlarm.cargoShiftAlarm) {
        this.violations.push({
          type: 'CARGO_SHIFT_RISK',
          thresholdValue: CONTAINER_ETHICAL_THRESHOLDS.CARGO_SHIFT_ROLL,
          actualValue: rollAngleDeg,
          timestamp: time,
          description: rollAlarm.message ?? '货物移位风险',
          severity: 'warning',
        });
      }

      if (rollAlarm.rollAlarm) {
        this.violations.push({
          type: 'EXCESSIVE_ROLL_ANGLE',
          thresholdValue: CONTAINER_ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE,
          actualValue: rollAngleDeg,
          timestamp: time,
          description: rollAlarm.message ?? '横摇超限',
          severity: 'critical',
        });
      }
    }

    // 累计误差
    const headingError = Math.abs(currentHeading - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const heading = toDegrees(this.state.headingRad);
    const yawRate = toDegrees(this.state.yawRateRad);

    return {
      position: { x: this.state.positionX, z: this.state.positionZ },
      heading: ((heading % 360) + 360) % 360,
      headingRad: this.state.headingRad,
      yawRate,
      yawRateRad: this.state.yawRateRad,
      rudder: this.state.rudderDeg,
      speed: this.state.speedMps,
      waveY: 0,
      wavePitch: 0,
      waveRoll: this.state.roll.angle,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: this.maxRudderRate,
      currentError: 0,
      energyConsumption: 0,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    this.schedulingEnabled = false;
    this.currentGains = { ...gains };
    this.targetGains = { ...gains };
  }

  // ========== 集装箱船特有方法 ==========

  /** 更新装载率 */
  setLoadRatio(loadRatio: number): void {
    this.state = updateLoadRatio(this.state, loadRatio);
  }

  /** 获取装载率 */
  getLoadRatio(): number {
    return this.state.loadRatio;
  }

  /** 设置风环境 */
  setWindEnvironment(speedMps: number, directionDeg: number, gustEnabled: boolean = false): void {
    this.windEnvironment = createWindEnvironment(speedMps, directionDeg, gustEnabled);
  }

  /** 获取风环境 */
  getWindEnvironment(): WindEnvironment {
    return { ...this.windEnvironment };
  }

  /** 启用/禁用增益调度 */
  setGainSchedulingEnabled(enabled: boolean): void {
    this.schedulingEnabled = enabled;
    this.controlMode = enabled ? 'pid_scheduled' : 'pid';
  }

  /** 获取调度诊断信息 */
  getSchedulerDiagnostics(): SchedulerDiagnostics {
    return {
      schedulingVariable: this.state.loadRatio,
      currentGains: { ...this.currentGains },
      targetGains: { ...this.targetGains },
      gainsConverged:
        Math.abs(this.currentGains.kp - this.targetGains.kp) < 0.01 &&
        Math.abs(this.currentGains.ki - this.targetGains.ki) < 0.001 &&
        Math.abs(this.currentGains.kd - this.targetGains.kd) < 0.01,
      isSchedulingActive: this.schedulingEnabled,
    };
  }

  /** 获取集装箱船状态摘要 */
  getContainerShipSummary() {
    return getContainerShipSummary(this.state);
  }

  /** 获取风载荷指标 */
  getWindLoadMetrics() {
    return getWindLoadMetrics(this.state.windLoad, this.windEnvironment);
  }

  /** 获取内部状态 (用于调试) */
  getInternalState(): ContainerShipState {
    return { ...this.state };
  }
}

// ============ 邮轮引擎实现 ============

/** 邮轮引擎 (横摇耦合 + 减摇鳍 + 陷波滤波器) */
export class CruiseShipEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: RollCoupledState;
  private finState: FinStabilizerState;
  private notchState: NotchFilterState;
  private comfortMetrics: ComfortMetrics;
  private pidState: { integral: number; prevError: number };

  // 控制配置
  private finStabilizerEnabled: boolean = true;
  private notchFilterEnabled: boolean = true;
  private seaStateLevel: number = 3;
  private waveDirection: number = 90;  // 相对波向 (°)

  // 指标跟踪
  private prevRudder: number = 0;
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxRudderRate: number = 0;
  private maxRollAngle: number = 0;
  private simulationTime: number = 0;
  private violations: EthicalViolation[] = [];

  // 历史数据 (用于频谱分析)
  private rollHistory: number[] = [];
  private maxHistoryLength: number = 1000;

  constructor(profile: ShipProfile) {
    this.profile = profile;

    // 初始化状态
    this.state = createRollCoupledState(
      0, 0, 0,
      profile.dynamics.speed.cruise
    );
    this.finState = createFinStabilizerState(true);
    this.notchState = createNotchFilterState(true);
    this.comfortMetrics = createComfortMetrics();
    this.pidState = { integral: 0, prevError: 0 };
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    const speed = this.profile.dynamics.speed.cruise;
    this.state = createRollCoupledState(startX, startZ, startHeading, speed);
    this.finState = createFinStabilizerState(this.finStabilizerEnabled);
    this.notchState = createNotchFilterState(this.notchFilterEnabled);
    this.comfortMetrics = createComfortMetrics();
    this.pidState = { integral: 0, prevError: 0 };

    this.prevRudder = 0;
    this.totalError = 0;
    this.errorCount = 0;
    this.maxRudderRate = 0;
    this.maxRollAngle = 0;
    this.simulationTime = 0;
    this.violations = [];
    this.rollHistory = [];
  }

  step(
    targetHeading: number,
    _targetPosition: Vector2 | null,
    controlMode: ControlMode,
    manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void {
    this.simulationTime = time;

    const currentHeading = toDegrees(this.state.headingRad);
    const gains = this.profile.control.defaultPID ?? CRUISE_DEFAULT_PID;
    const result = computePracticeCruiseLiveStep({
      dt,
      time,
      targetHeading,
      controlMode,
      manualRudder,
      manualSpeed,
      maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
      kp: gains.kp,
      ki: gains.ki,
      kd: gains.kd,
      seaState: this.seaStateLevel,
      waveDirection: this.waveDirection,
      prevRudder: this.prevRudder,
      finStabilizerEnabled: this.finStabilizerEnabled,
      notchFilterEnabled: this.notchFilterEnabled,
      state: this.state,
      pidState: this.pidState,
      finState: this.finState,
      notchState: this.notchState,
      rollCoupledParams: {
        ...DEFAULT_ROLL_COUPLED_PARAMS,
        K: this.profile.dynamics.nomoto?.K ?? CRUISE_ADORA_PARAMS.K,
        T1: this.profile.dynamics.nomoto?.T1 ?? CRUISE_ADORA_PARAMS.T1,
        T2: this.profile.dynamics.nomoto?.T2 ?? CRUISE_ADORA_PARAMS.T2,
        K_phi: CRUISE_ADORA_PARAMS.K_PHI,
        T_phi1: CRUISE_ADORA_PARAMS.T_PHI1,
        T_phi2: CRUISE_ADORA_PARAMS.T_PHI2,
        maxRudderDeg: this.profile.dynamics.rudder.maxAngle,
        speedMps: this.state.speedMps,
      },
    });

    const rudderDeg = result.rudderDeg;
    const rudderRate = result.rudderRate;
    this.state = result.state;
    this.pidState = result.pidState;
    this.finState = result.finState;
    this.notchState = result.notchState;
    if (rudderRate > this.maxRudderRate) {
      this.maxRudderRate = rudderRate;
    }
    this.prevRudder = rudderDeg;

    // 舵角速率违规检测
    const maxRudderRate = CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_RUDDER_RATE;
    if (rudderRate > maxRudderRate) {
      this.violations.push({
        type: 'EXCESSIVE_RUDDER_RATE',
        thresholdValue: maxRudderRate,
        actualValue: rudderRate,
        timestamp: time,
        description: `舵角变化速度过快: ${rudderRate.toFixed(2)}°/s`,
        severity: rudderRate > maxRudderRate * 1.5 ? 'critical' : 'warning',
      });
    }

    if (this.finStabilizerEnabled && isFinPowerExceeded(this.finState.powerConsumption)) {
      this.violations.push({
        type: 'FIN_ENERGY_EXCEEDED',
        thresholdValue: FIN_STABILIZER_PARAMS.MAX_POWER,
        actualValue: this.finState.powerConsumption,
        timestamp: time,
        description: `减摇鳍功率超限: ${this.finState.powerConsumption.toFixed(0)} kW`,
        severity: 'warning',
      });
    }

    const currentYawRateDeg = toDegrees(this.state.yawRateRad);
    const centripetalAccelG = Math.abs((this.state.speedMps * this.state.yawRateRad) / 9.81);
    const rollInducedAccelG = Math.abs(Math.sin(this.state.rollRad)) * 1.2;
    const lateralAccelGCurrent = centripetalAccelG + rollInducedAccelG;

    // ========== 5. 舒适度评估 ==========
    const currentRollDeg = toDegrees(Math.abs(this.state.rollRad));

    // 记录横摇历史
    this.rollHistory.push(currentRollDeg);
    if (this.rollHistory.length > this.maxHistoryLength) {
      this.rollHistory.shift();
    }

    // 更新舒适度指标
    this.comfortMetrics = computePracticeCruiseComfortRealtime(
      this.comfortMetrics,
      currentRollDeg,
      CRUISE_ADORA_PARAMS.NATURAL_ROLL_PERIOD,
      CRUISE_ADORA_PARAMS.BEAM,
      0.02,
      dt,
      lateralAccelGCurrent,
      Math.abs(currentYawRateDeg)
    );

    // 记录最大横摇角
    if (currentRollDeg > this.maxRollAngle) {
      this.maxRollAngle = currentRollDeg;
    }

    // 横摇违规检测
    if (currentRollDeg > CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_ROLL_ANGLE) {
      this.violations.push({
        type: 'EXCESSIVE_ROLL_ANGLE',
        thresholdValue: CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_ROLL_ANGLE,
        actualValue: currentRollDeg,
        timestamp: time,
        description: `横摇角超限: ${currentRollDeg.toFixed(2)}°`,
        severity: currentRollDeg > CRUISE_ETHICAL_THRESHOLDS.EXCESSIVE_ROLL_ANGLE * 1.5 ? 'critical' : 'warning',
      });
    }

    // 舒适度违规检测
    if (isComfortExceeded(this.comfortMetrics, 'moderate')) {
      this.violations.push({
        type: 'COMFORT_VIOLATION',
        thresholdValue: CRUISE_COMFORT_THRESHOLDS.MODERATE_MSI,
        actualValue: this.comfortMetrics.msi,
        timestamp: time,
        description: `舒适度下降: MSI ${this.comfortMetrics.msi.toFixed(1)}%, 评级: ${getComfortRatingDescription(this.comfortMetrics.comfortRating).label}`,
        severity: 'warning',
      });
    }

    // ========== 6. 累计误差 ==========
    const headingError = Math.abs(currentHeading - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const heading = toDegrees(this.state.headingRad);
    const yawRate = toDegrees(this.state.yawRateRad);

    return {
      position: { x: this.state.positionX, z: this.state.positionZ },
      heading: ((heading % 360) + 360) % 360,
      headingRad: this.state.headingRad,
      yawRate,
      yawRateRad: this.state.yawRateRad,
      rudder: this.state.rudderDeg,
      speed: this.state.speedMps,
      waveY: 0,
      wavePitch: 0,
      waveRoll: this.state.rollRad,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: this.maxRudderRate,
      currentError: 0,
      energyConsumption: this.finState.powerConsumption,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    if (this.profile.control.defaultPID) {
      Object.assign(this.profile.control.defaultPID, gains);
    }
  }

  // ========== 邮轮特有方法 ==========

  /** 启用/禁用减摇鳍 */
  setFinStabilizerEnabled(enabled: boolean): void {
    this.finStabilizerEnabled = enabled;
    this.finState.enabled = enabled;
  }

  /** 获取减摇鳍状态 */
  getFinStabilizerEnabled(): boolean {
    return this.finStabilizerEnabled;
  }

  /** 获取减摇鳍指标 */
  getFinStabilizerMetrics() {
    return getFinStabilizerMetrics(this.finState);
  }

  /** 启用/禁用陷波滤波器 */
  setNotchFilterEnabled(enabled: boolean): void {
    this.notchFilterEnabled = enabled;
    this.notchState.enabled = enabled;
  }

  /** 获取陷波滤波器状态 */
  getNotchFilterEnabled(): boolean {
    return this.notchFilterEnabled;
  }

  /** 获取陷波滤波器指标 */
  getNotchFilterMetrics() {
    return getNotchFilterMetrics(this.notchState, DEFAULT_NOTCH_PARAMS);
  }

  /** 设置海况等级 */
  setSeaState(level: number, waveDirection: number = 90): void {
    this.seaStateLevel = clamp(level, 1, 9);
    this.waveDirection = waveDirection;
  }

  /** 获取海况等级 */
  getSeaState(): { level: number; waveDirection: number } {
    return { level: this.seaStateLevel, waveDirection: this.waveDirection };
  }

  /** 获取舒适度指标 */
  getComfortMetrics(): ComfortMetrics {
    return { ...this.comfortMetrics };
  }

  /** 获取舒适度评级描述 */
  getComfortRatingDescription() {
    return getComfortRatingDescription(this.comfortMetrics.comfortRating);
  }

  /** 生成 Bode 图数据 */
  getBodePlotData() {
    return generateBodePlot(DEFAULT_NOTCH_PARAMS, 0.01, 1.0, 200);
  }

  /** 获取横摇历史 */
  getRollHistory(): number[] {
    return [...this.rollHistory];
  }

  /** 获取最大横摇角 */
  getMaxRollAngle(): number {
    return this.maxRollAngle;
  }

  /** 获取内部状态 (用于调试) */
  getInternalState(): {
    rollCoupled: RollCoupledState;
    fin: FinStabilizerState;
    notch: NotchFilterState;
    comfort: ComfortMetrics;
  } {
    return {
      rollCoupled: { ...this.state },
      fin: { ...this.finState },
      notch: { ...this.notchState },
      comfort: { ...this.comfortMetrics },
    };
  }
}

// ============ 钻井平台引擎实现 ============

/** 深水半潜式钻井平台引擎 (3DOF 动力定位 + 解耦控制) */
export class DrillingPlatformEngine implements SimulationEngine {
  private profile: ShipProfile;
  private state: SemiSub3DOFInternalState;
  private dpControllerConfig: DPControllerConfig;
  private dpState: DPDecouplingState;
  private currentEnv!: CurrentEnvironment;
  private windEnv!: CurrentWindEnvironment;
  private meanWindSpeed: number = 0;
  private performanceTracker: ReturnType<typeof createPerformanceTracker>;

  // 配置选项
  private decouplingEnabled: boolean = true;
  private disturbanceEnabled: boolean = true;
  private seaStateLevel: number = 3;
  private waveHeight: number = 1.5;
  private waveDirection: number = 0;

  // 指标跟踪
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxPositionError: number = 0;
  private maxHeadingError: number = 0;
  private violations: EthicalViolation[] = [];

  // 推进器故障列表
  private thrusterFailures: Array<{ thrusterId: number; failureTime: number; type: string }> = [];
  private runContext?: SimulationRunContext;
  private currentRng: RandomNumberGenerator;
  private windRng: RandomNumberGenerator;

  constructor(profile: ShipProfile, options: SimulationEngineOptions = {}) {
    this.profile = profile;
    this.runContext = options.runContext;
    this.currentRng = this.createCurrentRng();
    this.windRng = this.createWindRng();

    // 初始化平台状态
    this.state = createSemiSub3DOFState(0, 0, 0);

    // 初始化 DP 控制器配置
    this.dpControllerConfig = createDPControllerConfig(DRILLING_DEFAULT_DP, true);
    this.dpState = createDPDecouplingState();

    // 初始化环境
    this.resetEnvironmentState();

    // 初始化性能跟踪器
    this.performanceTracker = createPerformanceTracker();
  }

  private createCurrentRng(): RandomNumberGenerator {
    return this.runContext
      ? createSimulationRng(this.runContext, 'engine/drilling-current').next
      : Math.random;
  }

  private createWindRng(): RandomNumberGenerator {
    return this.runContext
      ? createSimulationRng(this.runContext, 'engine/drilling-wind').next
      : Math.random;
  }

  private resetEnvironmentState(): void {
    if (!this.disturbanceEnabled) {
      this.currentEnv = createCurrentEnvironment(0, 0, 0);
      this.windEnv = createCurrentWindEnvironment(0, 0, 1.0);
      this.meanWindSpeed = 0;
      this.waveHeight = 0;
      return;
    }

    const env = getTypicalEnvironment(this.seaStateLevel);
    this.currentEnv = createCurrentEnvironment(env.currentSpeed, 45, 0.1);
    this.windEnv = createCurrentWindEnvironment(env.windSpeed, 45, 1.2);
    this.meanWindSpeed = env.windSpeed;
    this.waveHeight = env.waveHeight;
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    this.currentRng = this.createCurrentRng();
    this.windRng = this.createWindRng();
    this.resetEnvironmentState();
    this.state = createSemiSub3DOFState(startX, startZ, toRadians(startHeading));

    // 设置目标位置
    this.state.targetX = startX;
    this.state.targetY = startZ;
    this.state.targetPsi = toRadians(startHeading);

    // 重置控制器状态
    this.dpState = createDPDecouplingState();
    this.performanceTracker = createPerformanceTracker();

    // 重置指标
    this.totalError = 0;
    this.errorCount = 0;
    this.maxPositionError = 0;
    this.maxHeadingError = 0;
    this.violations = [];
  }

  step(
    targetHeading: number,
    targetPosition: Vector2 | null,
    controlMode: ControlMode,
    _manualRudder: number,
    _manualSpeed: number,
    dt: number,
    time: number
  ): void {
    // 更新目标
    if (targetPosition) {
      this.state.targetX = targetPosition.x;
      this.state.targetY = targetPosition.z;
    }
    this.state.targetPsi = toRadians(targetHeading);

    // 更新环境
    this.currentEnv = updateCurrentEnvironment(this.currentEnv, dt, this.currentRng);
    this.windEnv = updateCurrentWindEnvironment(this.windEnv, dt, this.meanWindSpeed, this.windRng);

    // 计算环境力
    const envForces = computeTotalEnvironmentalForces(
      this.currentEnv,
      this.windEnv,
      this.waveHeight,
      this.waveDirection,
      this.state.psi
    );

    // 更新平台状态中的环境力
    this.state.currentForceX = envForces.forceX;
    this.state.currentForceY = envForces.forceY;
    this.state.currentMomentN = envForces.momentN;

    // 检查推进器故障
    for (const failure of this.thrusterFailures) {
      if (time >= failure.failureTime) {
        const thrusterIndex = this.state.thrusters.findIndex(t => t.id === failure.thrusterId);
        if (thrusterIndex >= 0 && !this.state.thrusters[thrusterIndex].failed) {
          this.state.thrusters[thrusterIndex] = simulateThrusterFailure(
            this.state.thrusters[thrusterIndex],
            failure.type as 'complete' | 'partial' | 'stuck'
          );
        }
      }
    }

    // DP 控制计算
    let controlOutput: DPControlOutput;
    let newDPState: DPDecouplingState;

    if (controlMode === 'dp' || controlMode === 'manual') {
      // 更新解耦开关
      this.dpControllerConfig.decouplingEnabled = this.decouplingEnabled;
      this.state.decouplingEnabled = this.decouplingEnabled;

      // 使用解耦或标准控制
      const controlFunc = this.decouplingEnabled ? dpDecoupledControl : dpStandardControl;
      [controlOutput, newDPState] = controlFunc(
        this.state,
        this.dpState,
        this.dpControllerConfig,
        dt
      );
      this.dpState = newDPState;

      // 推力分配
      const thrusterConfigs = createThrusterConfigs();

      const tauCmd: [number, number, number] = [
        controlOutput.decoupledTauX,
        controlOutput.decoupledTauY,
        controlOutput.decoupledTauN,
      ];

      const allocationResult = allocateThrust(
        tauCmd,
        this.state.thrusters,
        thrusterConfigs,
        dt
      );

      this.state.thrusters = allocationResult.thrusters;

      // 实际推力 kN → N：semisub3dof 契约为 SI 单位（N、N·m），内核不再换算（#1943）
      const thrusterForce: [number, number, number] = [
        allocationResult.totalForceX * 1000,
        allocationResult.totalForceY * 1000,
        allocationResult.totalMomentN * 1000,
      ];

      // 环境力转为元组格式
      const envForceTuple: [number, number, number] = [
        envForces.forceX,
        envForces.forceY,
        envForces.momentN,
      ];

      // 平台动力学步进
      this.state = semiSub3DOFStep(
        this.state,
        thrusterForce,
        envForceTuple,
        dt
      );

      // 更新误差指标
      const posError = Math.sqrt(controlOutput.errorX ** 2 + controlOutput.errorY ** 2);
      const headError = Math.abs(controlOutput.errorPsi);

      if (posError > this.maxPositionError) {
        this.maxPositionError = posError;
      }
      if (headError > this.maxHeadingError) {
        this.maxHeadingError = headError;
      }

      this.state.positionError = posError;
      this.state.headingError = headError;

      // 更新性能跟踪器
      const totalPower = computeTotalPower(this.state.thrusters);
      updatePerformanceTracker(
        this.performanceTracker,
        posError,
        headError,
        totalPower,
        time
      );

      // 累计误差
      this.totalError += posError;
      this.errorCount++;

      // ========== 伦理违规检测 ==========

      // 位置违规
      if (posError > DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT) {
        this.violations.push({
          type: 'EMERGENCY_DISCONNECT',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT,
          actualValue: posError,
          timestamp: time,
          description: `紧急解脱触发: 位置偏差 ${posError.toFixed(2)}m > ${DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT}m`,
          severity: 'critical',
        });
      } else if (posError > DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION) {
        this.violations.push({
          type: 'RED_ALERT_POSITION',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION,
          actualValue: posError,
          timestamp: time,
          description: `红色警报: 位置偏差 ${posError.toFixed(2)}m > ${DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION}m`,
          severity: 'critical',
        });
      } else if (posError > DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION) {
        this.violations.push({
          type: 'YELLOW_ALERT_POSITION',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION,
          actualValue: posError,
          timestamp: time,
          description: `黄色警报: 位置偏差 ${posError.toFixed(2)}m > ${DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION}m`,
          severity: 'warning',
        });
      }

      // 航向违规
      if (headError > DRILLING_ETHICAL_THRESHOLDS.MAX_HEADING_DEVIATION) {
        this.violations.push({
          type: 'HEADING_DEVIATION',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.MAX_HEADING_DEVIATION,
          actualValue: headError,
          timestamp: time,
          description: `航向偏差过大: ${headError.toFixed(1)}° > ${DRILLING_ETHICAL_THRESHOLDS.MAX_HEADING_DEVIATION}°`,
          severity: 'warning',
        });
      }

      // 功率违规
      if (totalPower > DRILLING_ETHICAL_THRESHOLDS.MAX_TOTAL_POWER) {
        this.violations.push({
          type: 'TOTAL_POWER_EXCEEDED',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.MAX_TOTAL_POWER,
          actualValue: totalPower,
          timestamp: time,
          description: `总功率超限: ${totalPower.toFixed(0)} kW > ${DRILLING_ETHICAL_THRESHOLDS.MAX_TOTAL_POWER} kW`,
          severity: 'warning',
        });
      }

      // 单台推进器功率违规
      for (const thruster of this.state.thrusters) {
        if (thruster.power > DRILLING_ETHICAL_THRESHOLDS.MAX_THRUSTER_POWER) {
          this.violations.push({
            type: 'THRUSTER_POWER_EXCEEDED',
            thresholdValue: DRILLING_ETHICAL_THRESHOLDS.MAX_THRUSTER_POWER,
            actualValue: thruster.power,
            timestamp: time,
            description: `推进器 ${thruster.id} 功率超限: ${thruster.power.toFixed(0)} kW`,
            severity: 'warning',
          });
        }
      }
    }
  }

  getState(time: number): SimulationState {
    const base = semiSubToSimulationState(this.state, time);
    return {
      position: base.position,
      heading: base.heading,
      headingRad: base.headingRad,
      yawRate: base.yawRate,
      yawRateRad: base.yawRateRad,
      rudder: 0, // 半潜式平台无舵
      speed: Math.sqrt(this.state.u ** 2 + this.state.v ** 2),
      surgeVelocity: this.state.u,
      swayVelocity: this.state.v,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    const perfMetrics = computePerformanceMetrics(this.performanceTracker);
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: 0, // 无舵
      currentError: this.state.positionError,
      energyConsumption: computeTotalPower(this.state.thrusters),
      settlingTime: perfMetrics.settlingTime,
      overshoot: 0,
      crossTrackError: 0,
      positionError: this.state.positionError,
      maxPositionError: this.maxPositionError,
      headingError: this.state.headingError,
      maxHeadingError: this.maxHeadingError,
      positionRMS: perfMetrics.positionRMS,
      headingRMS: perfMetrics.headingRMS,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(_gains: PIDGains): void {
    // 钻井平台使用 DP 增益，不使用 PID 增益
  }

  setDPGains(gains: DPGains): void {
    this.dpControllerConfig.gains = {
      surge: gains.surge,
      sway: gains.sway,
      yaw: gains.yaw,
    };
  }

  setDisturbanceEnabled(enabled: boolean): void {
    this.disturbanceEnabled = enabled;
    this.resetEnvironmentState();
  }

  // ========== 钻井平台特有方法 ==========

  /** 启用/禁用解耦控制 */
  setDecouplingEnabled(enabled: boolean): void {
    this.decouplingEnabled = enabled;
  }

  /** 获取解耦控制状态 */
  getDecouplingEnabled(): boolean {
    return this.decouplingEnabled;
  }

  /** 设置海况等级 */
  setSeaState(level: number, waveDirection: number = 0): void {
    this.disturbanceEnabled = true;
    this.seaStateLevel = level;
    this.waveDirection = waveDirection;
    this.resetEnvironmentState();
  }

  /** 获取推进器状态 */
  getThrusterStates() {
    return [...this.state.thrusters];
  }

  /** 获取推进器摘要 */
  getThrusterSummary() {
    return getThrusterSummary(this.state.thrusters);
  }

  /** 设置推进器故障 */
  setThrusterFailures(failures: Array<{ thrusterId: number; failureTime: number; type: string }>): void {
    this.thrusterFailures = failures;
  }

  /** 获取环境状态 */
  getEnvironmentState(): {
    current: CurrentEnvironment;
    wind: CurrentWindEnvironment;
    waveHeight: number;
    waveDirection: number;
  } {
    return {
      current: { ...this.currentEnv },
      wind: { ...this.windEnv },
      waveHeight: this.waveHeight,
      waveDirection: this.waveDirection,
    };
  }

  /** 获取性能指标 */
  getPerformanceMetrics() {
    return computePerformanceMetrics(this.performanceTracker);
  }

  /** 获取解耦矩阵描述 */
  getDecouplingMatrixDescription(): string {
    return getDecouplingMatrixDescription();
  }

  /** 获取目标位置 */
  getTargetPosition(): { x: number; y: number; psi: number } {
    return {
      x: this.state.targetX,
      y: this.state.targetY,
      psi: toDegrees(this.state.targetPsi),
    };
  }

  /** 获取内部状态 (用于调试) */
  getInternalState(): SemiSub3DOFInternalState {
    return { ...this.state };
  }
}

// ============ 破冰船引擎实现 ============

/** 破冰船引擎 (Azipod 3DOF + 冰阻力模型) */
export class IcebreakerEngine implements SimulationEngine {
  private profile: IcebreakerProfile;
  private state: Azipod3DOFInternalState;
  private iceState: IceBreakingState;
  private controllerState: AzipodCourseKeeperState;
  private azipodParams: Azipod3DOFParams;

  // 冰区模式配置
  private iceModeEnabled: boolean = false;
  private iceThickness: number = 0;

  // 指标跟踪
  private totalError: number = 0;
  private errorCount: number = 0;
  private maxAzipodSlewRate: number = 0;
  private maxIceResistance: number = 0;
  private maxPropellerStress: number = 0;
  private violations: EthicalViolation[] = [];

  // 诊断数据
  private lastAzipodDiagnostics: ReturnType<typeof getAzipodControllerDiagnostics> | null = null;
  private lastIceSummary: ReturnType<typeof getIceBreakingSummary> | null = null;
  private runContext?: SimulationRunContext;
  private iceRng: RandomNumberGenerator;

  constructor(profile: ShipProfile, options: SimulationEngineOptions = {}) {
    this.profile = profile as IcebreakerProfile;
    this.runContext = options.runContext;
    this.iceRng = this.createIceRng();

    // 使用默认 Azipod 3DOF 参数
    this.azipodParams = DEFAULT_AZIPOD_3DOF_PARAMS;

    // 初始化状态
    this.state = createAzipod3DOFState(0, 0, 0, this.azipodParams);
    this.iceState = createIceBreakingState(this.iceRng);
    this.controllerState = createAzipodCourseKeeperState();
  }

  private createIceRng(): RandomNumberGenerator {
    return this.runContext
      ? createSimulationRng(this.runContext, 'engine/ice-breaking').next
      : Math.random;
  }

  initialize(startX: number, startZ: number, startHeading: number): void {
    this.iceRng = this.createIceRng();
    this.state = createAzipod3DOFState(startX, startZ, toRadians(startHeading), this.azipodParams);
    this.iceState = createIceBreakingState(this.iceRng);
    this.controllerState = createAzipodCourseKeeperState();

    this.totalError = 0;
    this.errorCount = 0;
    this.maxAzipodSlewRate = 0;
    this.maxIceResistance = 0;
    this.maxPropellerStress = 0;
    this.violations = [];
  }

  step(
    targetHeading: number,
    _targetPosition: Vector2 | null,
    controlMode: ControlMode,
    _manualRudder: number,
    manualSpeed: number,
    dt: number,
    time: number
  ): void {
    const currentHeading = toDegrees(this.state.psi);
    const currentYawRate = toDegrees(this.state.r);
    const speed = Math.sqrt(this.state.u ** 2 + this.state.v ** 2);

    // ========== 1. 冰阻力模型更新 ==========
    let iceResistance = 0;
    let perturbedK = 1.0;

    if (this.iceModeEnabled && this.iceThickness > 0) {
      // 更新冰阻力状态
      const iceParams = {
        ...DEFAULT_ICE_BREAKING_PARAMS,
        enabled: true,
        iceThickness: this.iceThickness,
      };

      this.iceState = iceBreakingStep(this.iceState, iceParams, speed, dt, this.iceRng);
      iceResistance = this.iceState.resistanceForce;
      perturbedK = this.iceState.currentK;

      // 记录最大冰阻力
      if (iceResistance > this.maxIceResistance) {
        this.maxIceResistance = iceResistance;
      }

      // 冰厚警报检测
      const iceAlarm = shouldTriggerIceAlarm(this.iceThickness);
      if (iceAlarm === 'exceeded') {
        this.violations.push({
          type: 'ICE_THICKNESS_EXCEEDED',
          thresholdValue: XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS,
          actualValue: this.iceThickness,
          timestamp: time,
          description: `冰厚超过破冰能力: ${this.iceThickness.toFixed(2)}m > ${XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS}m`,
          severity: 'critical',
        });
      } else if (iceAlarm === 'warning') {
        this.violations.push({
          type: 'ICE_THICKNESS_WARNING',
          thresholdValue: XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS * 0.8,
          actualValue: this.iceThickness,
          timestamp: time,
          description: `冰厚接近破冰极限: ${this.iceThickness.toFixed(2)}m`,
          severity: 'warning',
        });
      }

      // 螺旋桨应力检测
      const thrustRatio = (this.state.azipod1.thrust + this.state.azipod2.thrust) / (2 * this.azipodParams.maxThrust);
      const propellerStress = computePropellerStress(this.iceThickness, speed, thrustRatio);
      if (propellerStress > this.maxPropellerStress) {
        this.maxPropellerStress = propellerStress;
      }

      if (propellerStress > XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_EXCEEDED) {
        this.violations.push({
          type: 'PROPELLER_STRESS_EXCEEDED',
          thresholdValue: XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_EXCEEDED,
          actualValue: propellerStress,
          timestamp: time,
          description: `螺旋桨应力超限: ${(propellerStress * 100).toFixed(0)}%`,
          severity: 'critical',
        });
      } else if (propellerStress > XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_WARNING) {
        this.violations.push({
          type: 'PROPELLER_STRESS_WARNING',
          thresholdValue: XUELONG_ETHICAL_THRESHOLDS.PROPELLER_STRESS_WARNING,
          actualValue: propellerStress,
          timestamp: time,
          description: `螺旋桨应力警告: ${(propellerStress * 100).toFixed(0)}%`,
          severity: 'warning',
        });
      }

      // 保存冰区状态摘要
      this.lastIceSummary = getIceBreakingSummary(this.iceState);
    }

    // ========== 2. 航向控制计算 ==========
    if (controlMode === 'manual') {
      // 手动模式: 直接设置推力和角度
      this.state.u = manualSpeed;
    } else {
      // 自动控制模式: 使用 Azipod 航向保持控制器
      const config = {
        ...DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
        gains: XUELONG_DEFAULT_GAINS.heading,
      };

      if (this.iceModeEnabled) {
        // 冰区模式: 使用专用控制器（内置 config）
        this.controllerState = azipodCourseKeeperControlIceMode(
          this.controllerState,
          currentHeading,
          targetHeading,
          currentYawRate,
          speed,
          controlMode as 'manual' | 'p' | 'pd' | 'pid',
          perturbedK,
          dt,
          time
        );
      } else {
        // 开阔水域模式: 使用标准控制器
        this.controllerState = azipodCourseKeeperControl(
          this.controllerState,
          currentHeading,
          targetHeading,
          currentYawRate,
          speed,
          controlMode as 'manual' | 'p' | 'pd' | 'pid',
          config,
          1.0,  // 无摄动
          dt,
          time
        );
      }

      // 将控制器输出应用到 Azipod 状态
      this.state = setAzipodCommands(
        this.state,
        this.controllerState.azimuth1Cmd,
        this.controllerState.azimuth2Cmd,
        this.controllerState.thrust1Cmd,
        this.controllerState.thrust2Cmd
      );

      // 保存诊断信息
      this.lastAzipodDiagnostics = getAzipodControllerDiagnostics(this.controllerState);
    }

    // ========== 3. Azipod 回转速率限制检测 ==========
    const slewRate1 = Math.abs(this.state.azipod1.azimuthCmd - this.state.azipod1.azimuth) / dt;
    const slewRate2 = Math.abs(this.state.azipod2.azimuthCmd - this.state.azipod2.azimuth) / dt;
    const maxCurrentSlewRate = Math.max(slewRate1, slewRate2);

    if (maxCurrentSlewRate > this.maxAzipodSlewRate) {
      this.maxAzipodSlewRate = maxCurrentSlewRate;
    }

    // 回转速率警告
    const slewRateDegPerSec = toDegrees(maxCurrentSlewRate);
    if (slewRateDegPerSec > XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_EXCEEDED) {
      this.violations.push({
        type: 'AZIPOD_SLEW_RATE_EXCEEDED',
        thresholdValue: XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_EXCEEDED,
        actualValue: slewRateDegPerSec,
        timestamp: time,
        description: `Azipod 回转速率超限: ${slewRateDegPerSec.toFixed(1)}°/s > ${XUELONG_AZIPOD_PARAMS.MAX_SLEW_RATE}°/s`,
        severity: 'critical',
      });
    } else if (slewRateDegPerSec > XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_WARNING) {
      this.violations.push({
        type: 'AZIPOD_SLEW_RATE_WARNING',
        thresholdValue: XUELONG_ETHICAL_THRESHOLDS.AZIPOD_SLEW_RATE_WARNING,
        actualValue: slewRateDegPerSec,
        timestamp: time,
        description: `Azipod 回转速率警告: ${slewRateDegPerSec.toFixed(1)}°/s`,
        severity: 'warning',
      });
    }

    // ========== 4. 物理模型步进 ==========
    this.state = azipod3dofStepRK4(
      this.state,
      this.azipodParams,
      iceResistance,
      dt
    );

    // ========== 5. 累计误差 ==========
    const headingError = Math.abs(currentHeading - targetHeading);
    this.totalError += headingError;
    this.errorCount++;
  }

  getState(time: number): SimulationState {
    const base = azipodToSimulationState(this.state, time);
    return {
      position: base.position,
      heading: base.heading,
      headingRad: base.headingRad,
      yawRate: base.yawRate,
      yawRateRad: base.yawRateRad,
      rudder: 0, // 无传统舵
      speed: base.speed,
      surgeVelocity: base.surgeVelocity,
      swayVelocity: base.swayVelocity,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      time,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };
  }

  getMetrics(): SimulationMetrics {
    return {
      avgError: this.errorCount > 0 ? this.totalError / this.errorCount : 0,
      maxRudderRate: 0, // 无舵
      currentError: 0,
      energyConsumption: 0,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: 0,
    };
  }

  checkViolations(): EthicalViolation[] {
    return [...this.violations];
  }

  reset(): void {
    this.initialize(0, 0, 0);
  }

  setPIDGains(gains: PIDGains): void {
    // 更新航向控制器增益
    // 需要通过 config 传递
  }

  // ========== 破冰船特有方法 ==========

  /** 启用/禁用冰区模式 */
  setIceModeEnabled(enabled: boolean, iceThickness: number = 1.0): void {
    this.iceModeEnabled = enabled;
    this.iceThickness = enabled ? iceThickness : 0;
    if (!enabled) {
      this.iceState = createIceBreakingState(this.iceRng);
    }
  }

  /** 获取冰区模式状态 */
  getIceModeEnabled(): boolean {
    return this.iceModeEnabled;
  }

  /** 获取冰厚 */
  getIceThickness(): number {
    return this.iceThickness;
  }

  /** 设置冰厚 */
  setIceThickness(thickness: number): void {
    this.iceThickness = thickness;
    if (thickness > 0 && !this.iceModeEnabled) {
      this.iceModeEnabled = true;
    }
  }

  /** 获取冰区状态 */
  getIceState(): IceBreakingState {
    return { ...this.iceState };
  }

  /** 获取冰区状态摘要 */
  getIceBreakingSummary() {
    return this.lastIceSummary;
  }

  /** 获取 Azipod 状态 */
  getAzipodState(): {
    azimuth1Deg: number;
    azimuth2Deg: number;
    thrust1KN: number;
    thrust2KN: number;
    slewRate1DegPerSec: number;
    slewRate2DegPerSec: number;
  } {
    return {
      azimuth1Deg: toDegrees(this.state.azipod1.azimuth),
      azimuth2Deg: toDegrees(this.state.azipod2.azimuth),
      thrust1KN: this.state.azipod1.thrust / 1000,
      thrust2KN: this.state.azipod2.thrust / 1000,
      slewRate1DegPerSec: toDegrees(this.state.azipod1.slewRate),
      slewRate2DegPerSec: toDegrees(this.state.azipod2.slewRate),
    };
  }

  /** 获取 Azipod 控制器诊断 */
  getAzipodDiagnostics() {
    return this.lastAzipodDiagnostics;
  }

  /** 获取最大 Azipod 回转速率 */
  getMaxAzipodSlewRate(): number {
    return toDegrees(this.maxAzipodSlewRate);
  }

  /** 获取最大冰阻力 */
  getMaxIceResistance(): number {
    return this.maxIceResistance / 1000; // N → kN
  }

  /** 获取最大螺旋桨应力 */
  getMaxPropellerStress(): number {
    return this.maxPropellerStress;
  }

  /** 获取内部状态 (用于调试) */
  getInternalState(): {
    azipod: Azipod3DOFInternalState;
    ice: IceBreakingState;
    controller: AzipodCourseKeeperState;
  } {
    return {
      azipod: { ...this.state },
      ice: { ...this.iceState },
      controller: { ...this.controllerState },
    };
  }
}

// ============ 工厂函数 ============

/**
 * 根据船舶配置创建仿真引擎
 */
export function createSimulationEngine(
  profile: ShipProfile,
  options: SimulationEngineOptions = {}
): SimulationEngine {
  const modelType = profile.dynamics.modelType;

  // 检查是否是破冰船 (通过 ID 或模型类型)
  if (profile.id === 'fleet-icebreaker-xuelong2' ||
      modelType === 'Azipod3DOF') {
    return new IcebreakerEngine(profile, options);
  }

  // 检查是否是钻井平台 (通过 ID 或模型类型)
  if (profile.id === 'fleet-drill-hysy981' ||
      modelType === 'SemiSubmersible3DOF') {
    return new DrillingPlatformEngine(profile, options);
  }

  // 检查是否是邮轮 (通过 ID 或配置特征)
  if (profile.id === 'fleet-cruise-adora' ||
      (profile.dynamics.modifications.finStabilizer &&
       profile.dynamics.modifications.rollDynamics)) {
    return new CruiseShipEngine(profile);
  }

  // 检查是否是集装箱船 (通过 ID 或配置特征)
  if (profile.id === 'fleet-container-msc' ||
      modelType === 'NomotoVariableMass' ||
      (profile.dynamics.modifications.variableMass &&
       profile.dynamics.modifications.windLoadEffect)) {
    return new ContainerShipEngine(profile);
  }

  // 检查是否是 LNG 船 (通过 ID 或配置特征)
  if (profile.id === 'fleet-lng-changheng' ||
      (modelType === 'Nomoto2ndOrder' &&
       profile.dynamics.modifications.sloshingEffect)) {
    return new LNGCarrierEngine(profile);
  }

  // 基于模型类型创建引擎
  if (modelType === 'Nomoto1stOrder' || modelType === 'Nomoto2ndOrder') {
    return new Nomoto1stOrderEngine(profile);
  }

  if (modelType === 'MMG3DOF' || modelType === '3DOF_Coupled') {
    return new MMG3DOFEngine(profile, options);
  }

  throw new Error(`Unknown physics model type: ${modelType}`);
}

/**
 * 根据船舶 ID 创建仿真引擎
 * 需要先加载船舶配置
 */
export async function createSimulationEngineById(
  shipId: string,
  options: SimulationEngineOptions = {}
): Promise<SimulationEngine> {
  // 动态加载船舶配置
  let profile: ShipProfile;

  switch (shipId) {
    case 'destroyer-055':
      const destroyerModule = await import('../profiles/destroyer-055');
      profile = destroyerModule.destroyer055Profile;
      break;

    case 'fleet-dredger-tianjing':
      const dredgerModule = await import('../profiles/dredger-tianjing');
      profile = dredgerModule.dredgerTianjingProfile;
      break;

    case 'fleet-lng-changheng':
      const lngModule = await import('../profiles/lng-changheng');
      profile = lngModule.lngChanghengProfile;
      break;

    case 'fleet-container-msc':
      const containerModule = await import('../profiles/container-msc');
      profile = containerModule.containerMscProfile;
      break;

    case 'fleet-cruise-adora':
      const cruiseModule = await import('../profiles/cruise-adora');
      profile = cruiseModule.cruiseAdoraProfile;
      break;

    case 'fleet-drill-hysy981':
      const drillingModule = await import('../profiles/drilling-hysy981');
      profile = drillingModule.drillingHYSY981Profile;
      break;

    case 'fleet-icebreaker-xuelong2':
      const icebreakerModule = await import('../profiles/icebreaker-xuelong');
      profile = icebreakerModule.icebreakerXuelongProfile;
      break;

    default:
      throw new Error(`Unknown ship ID: ${shipId}`);
  }

  return createSimulationEngine(profile, options);
}
