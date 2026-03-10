import type { TransferFunctionModel } from '@/lib/simulation';
import { createLinearPlant } from '@/lib/simulation';

export interface ShipState {
  y: number;      // 垂直位置 (0-400)
  v: number;      // 垂直速度
  u: number;      // 当前控制输入 (控制量) 动态限幅
  r: number;      // 当前设定值 (仅自动模式有效)
}

export interface ControlParams {
  plantModel: TransferFunctionModel;
  controlRate?: number; // 手动控制量变化率
  
  // 控制器参数
  mode: 'MANUAL' | 'AUTO';
  pid: {
    kp: number;
    ki: number;
    kd: number;
  };
  speedFeedback?: {
    enabled: boolean;
    tau: number;
  };
  feedforward?: {
    enabled: boolean;
    gain: number;
    base?: number;
  };
  smithPredictor?: {
    enabled: boolean;
    delay: number;
  };
  outputLimits?: {
    manual?: number;
    p?: number;
    i?: number;
    d?: number;
    vfb?: number;
    ff?: number;
  };
}

/**
 * 物理引擎核心
 * 计算下一帧的飞船状态
 */
export class PhysicsEngine {
  private state: ShipState;
  private baseY: number = 200;
  private baseOffset: number = 200;
  private lastBaseY: number = 200;
  private plant: ReturnType<typeof createLinearPlant> | null = null;
  private plantKey: string = '';
  
  // PID 内部状态
  private integral: number = 0;
  private prevError: number = 0;
  private speedFeedbackState: number = 0;
  private lastMode: 'MANUAL' | 'AUTO' = 'MANUAL';
  private elapsedTime: number = 0;
  private predictorNoDelayPlant: ReturnType<typeof createLinearPlant> | null = null;
  private predictorDelayPlant: ReturnType<typeof createLinearPlant> | null = null;
  private predictorNoDelayY: number = 200;
  private predictorDelayY: number = 200;
  private predictorKey: string = '';
  private smithEnabled: boolean = false;
  
  constructor() {
    this.state = { y: 200, v: 0, u: 0, r: 200 };
  }

  reset(initialY: number = 200) {
    this.baseOffset = initialY;
    this.baseY = initialY;
    this.lastBaseY = initialY;
    this.state = { y: initialY, v: 0, u: 0, r: initialY };
    this.integral = 0;
    this.prevError = 0;
    this.speedFeedbackState = 0;
    this.elapsedTime = 0;
    this.plant = null;
    this.plantKey = '';
    this.predictorNoDelayPlant = null;
    this.predictorDelayPlant = null;
    this.predictorNoDelayY = initialY;
    this.predictorDelayY = initialY;
    this.predictorKey = '';
    this.smithEnabled = false;
  }

  getState() {
    return { ...this.state };
  }

  setAutoSetpoint(target: number) {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    this.state.r = clamp(target, 0, 400);
  }

  /**
   * 物理步进计算 (Euler Integration)
   * @param dt 时间步长 (秒)
   * @param inputCommand 用户输入的增量命令 (-1, 0, 1)
   * @param params 控制参数
   * @param disturbance 外部干扰值 (可选，直接叠加到速度或加速度上)
   */
  update(dt: number, inputCommand: number, params: ControlParams, disturbance: number = 0): ShipState {
    const { plantModel, mode, pid, controlRate } = params;
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    if (mode !== this.lastMode) {
      this.integral = 0;
      this.prevError = 0;
      if (mode === 'AUTO') {
        this.state.r = this.state.y;
      }
      this.lastMode = mode;
    }

    const smithEnabled = mode === 'AUTO' && (params.smithPredictor?.enabled ?? false);
    if (smithEnabled && !this.smithEnabled) {
      this.predictorKey = '';
    }
    this.smithEnabled = smithEnabled;

    const feedbackTau = params.speedFeedback?.tau ?? 0.6;
    const feedbackAlpha = feedbackTau > 0 ? Math.min(dt / (feedbackTau + dt), 1) : 1;
    this.speedFeedbackState += (this.state.v - this.speedFeedbackState) * feedbackAlpha;
    const speedFeedbackTerm = params.speedFeedback?.enabled ? -this.speedFeedbackState / 200 : 0;
    const feedforwardBase = params.feedforward?.base ?? 200;
    const feedforwardTerm = params.feedforward?.enabled
      ? (params.feedforward.gain * (this.state.r - feedforwardBase)) / 200
      : 0;
    const limits = params.outputLimits ?? {};
    const limitValue = (value: number, limit?: number) => {
      if (!limit || limit <= 0) return 0;
      return clamp(value, -limit, limit);
    };

    if (mode === 'MANUAL') {
      const rate = controlRate ?? 1.5;
      const manualLimit = limits.manual ?? 1;
      this.state.u = clamp(this.state.u + inputCommand * rate * dt, -manualLimit, manualLimit);
    } else {
      const setpointRate = 120;
      this.state.r = clamp(this.state.r + inputCommand * setpointRate * dt, 0, 400);

      const predictorDelayY = this.predictorDelayY;
      const predictorNoDelayY = this.predictorNoDelayY;
      const feedbackY = smithEnabled
        ? predictorNoDelayY + (this.state.y - predictorDelayY)
        : this.state.y;
      const normalizedError = (this.state.r - feedbackY) / 200;
      const iLimit = limits.i ?? 0;
      const iStateLimit =
        iLimit > 0 && Math.abs(pid.ki) > 0
          ? iLimit / Math.max(Math.abs(pid.ki), 0.0001)
          : 0;
      this.integral = iStateLimit > 0
        ? clamp(this.integral + normalizedError * dt, -iStateLimit, iStateLimit)
        : 0;
      const derivative = dt > 0 ? (normalizedError - this.prevError) / dt : 0;
      this.prevError = normalizedError;

      const pTerm = limitValue(pid.kp * normalizedError, limits.p);
      const iTerm = limitValue(pid.ki * this.integral, limits.i);
      const dTerm = limitValue(pid.kd * derivative, limits.d);
      const vfbTerm = limitValue(speedFeedbackTerm, limits.vfb);
      const ffTerm = limitValue(feedforwardTerm, limits.ff);
      this.state.u = pTerm + iTerm + dTerm + vfbTerm + ffTerm;
    }

    // ============ 对象层 (Plant) ============
    this.elapsedTime += dt;
    const u = this.state.u;
    const plantKey = `${dt}:${plantModel.numerator.join(',')}:${plantModel.denominator.join(',')}:${plantModel.delay ?? 0}`;
    if (!this.plant || this.plantKey !== plantKey) {
      this.plant = createLinearPlant(plantModel, dt);
      this.plantKey = plantKey;
    }
    const plantResult = this.plant.step([u]);
    const plantOutput = plantResult.output[0] ?? 0;
    this.baseY = this.baseOffset + plantOutput;
    this.state.v = dt > 0 ? (this.baseY - this.lastBaseY) / dt : 0;
    this.lastBaseY = this.baseY;

    // 输出端扰动（暗流/乱流）叠加到输出，不参与状态积分
    this.state.y = this.baseY + disturbance;

    if (smithEnabled) {
      const predictorDelay = Math.max(0, params.smithPredictor?.delay ?? 0);
      const predictorKey = `${plantKey}:${predictorDelay}`;
      if (!this.predictorNoDelayPlant || !this.predictorDelayPlant || this.predictorKey !== predictorKey) {
        const currentState = this.plant?.getState().state;
        const noDelayModel: TransferFunctionModel = { ...plantModel, delay: 0 };
        const delayModel: TransferFunctionModel = { ...plantModel, delay: predictorDelay };
        this.predictorNoDelayPlant = createLinearPlant(noDelayModel, dt, currentState);
        this.predictorDelayPlant = createLinearPlant(delayModel, dt, currentState);
        this.predictorKey = predictorKey;
        this.predictorNoDelayY = this.baseY;
        this.predictorDelayY = this.baseY;
      }

      const noDelayResult = this.predictorNoDelayPlant?.step([u]);
      const delayResult = this.predictorDelayPlant?.step([u]);
      if (noDelayResult) {
        this.predictorNoDelayY = this.baseOffset + (noDelayResult.output[0] ?? 0);
      }
      if (delayResult) {
        this.predictorDelayY = this.baseOffset + (delayResult.output[0] ?? 0);
      }
    } else {
      this.predictorNoDelayY = this.baseY;
      this.predictorDelayY = this.baseY;
    }

    return this.state;
  }
}
