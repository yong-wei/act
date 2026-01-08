export interface ShipState {
  y: number;      // 垂直位置 (0-400)
  v: number;      // 垂直速度
  u: number;      // 当前控制输入 (控制量) -1.0 到 1.0
  r: number;      // 当前设定值 (仅自动模式有效)
}

export interface ControlParams {
  type: 'PROPORTIONAL' | 'INTEGRAL' | 'INERTIAL'; // 被控对象模型类型
  gain: number;   // 对象增益 K
  timeConstant?: number; // 对象时间常数 T
  inputDelay?: number; // 输入纯延时（秒）
  controlRate?: number; // 手动控制量变化率
  
  // 控制器参数
  mode: 'MANUAL' | 'AUTO';
  pid: {
    kp: number;
    ki: number;
    kd: number;
  };
}

/**
 * 物理引擎核心
 * 计算下一帧的飞船状态
 */
export class PhysicsEngine {
  private state: ShipState;
  private baseY: number = 200;
  
  // PID 内部状态
  private integral: number = 0;
  private prevError: number = 0;
  private lastMode: 'MANUAL' | 'AUTO' = 'MANUAL';
  private elapsedTime: number = 0;
  private inputDelayQueue: { time: number; value: number }[] = [];
  
  constructor() {
    this.state = { y: 200, v: 0, u: 0, r: 200 };
  }

  reset(initialY: number = 200) {
    this.baseY = initialY;
    this.state = { y: initialY, v: 0, u: 0, r: initialY };
    this.integral = 0;
    this.prevError = 0;
    this.elapsedTime = 0;
    this.inputDelayQueue = [];
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
    const { type, gain, timeConstant, mode, pid, controlRate, inputDelay } = params;
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

    if (mode === 'MANUAL') {
      const rate = controlRate ?? 1.5;
      this.state.u = clamp(this.state.u + inputCommand * rate * dt, -1, 1);
    } else {
      const setpointRate = 120;
      this.state.r = clamp(this.state.r + inputCommand * setpointRate * dt, 0, 400);

      const normalizedError = (this.state.r - this.state.y) / 200;
      this.integral = clamp(this.integral + normalizedError * dt, -2, 2);
      const derivative = dt > 0 ? (normalizedError - this.prevError) / dt : 0;
      this.prevError = normalizedError;

      this.state.u = clamp(
        pid.kp * normalizedError + pid.ki * this.integral + pid.kd * derivative,
        -1,
        1
      );
    }

    // ============ 对象层 (Plant) ============
    this.elapsedTime += dt;
    const u = this.state.u;
    let appliedU = u;
    const delay = inputDelay ?? 0;

    if (delay > 0) {
      this.inputDelayQueue.push({ time: this.elapsedTime, value: u });
      const targetTime = this.elapsedTime - delay;
      while (this.inputDelayQueue.length > 1 && this.inputDelayQueue[1].time <= targetTime) {
        this.inputDelayQueue.shift();
      }
      appliedU = this.inputDelayQueue[0]?.value ?? u;
    } else {
      this.inputDelayQueue = [];
    }

    switch (type) {
      case 'PROPORTIONAL':
        // 纯速度控制: v = K * u + d
        this.state.v = appliedU * gain * 200; 
        this.baseY += this.state.v * dt;
        break;

      case 'INERTIAL':
        // 一阶惯性 (速度模式): T * v' + v = K * u + d
        // v' = (K*u - v) / T
        const targetV = appliedU * gain * 200;
        const dv = (targetV - this.state.v) / (timeConstant || 0.1) * dt; 
        this.state.v += dv;
        this.baseY += this.state.v * dt;
        break;

      case 'INTEGRAL':
        // 二阶积分 (加速度模式): a = K * u + d
        const a = appliedU * gain * 500;
        this.state.v += a * dt;
        this.state.v *= 0.98; // 阻尼
        this.baseY += this.state.v * dt;
        break;
    }

    // 输出端扰动（暗流/乱流）叠加到输出，不参与状态积分
    this.state.y = this.baseY + disturbance;

    return this.state;
  }
}
