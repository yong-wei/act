import {
  buildRustSimulationRequest,
  createInitialRustSimulationState,
  type ControlParams,
  type ShipState,
  type RustSimulationState,
} from './rust-runtime-adapter';
import {
  computeRustSimulationStep,
  isControlOdysseyRuntimeReady,
  preloadControlOdysseyRuntime,
} from './control-engine-runtime';

export type { ControlParams, ShipState };

/**
 * 物理引擎核心
 * 计算下一帧的飞船状态
 */
export class PhysicsEngine {
  private runtimeState: RustSimulationState;
  private state: ShipState;
  
  constructor() {
    this.runtimeState = createInitialRustSimulationState(200);
    this.state = { y: 200, v: 0, u: 0, r: 200 };
    void preloadControlOdysseyRuntime();
  }

  reset(initialY: number = 200) {
    this.runtimeState = createInitialRustSimulationState(initialY);
    this.state = { y: initialY, v: 0, u: 0, r: initialY };
  }

  getState() {
    return { ...this.state };
  }

  setAutoSetpoint(target: number) {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    this.runtimeState.r = clamp(target, 0, 400);
    this.state.r = this.runtimeState.r;
  }

  /**
   * 物理步进计算 (Euler Integration)
   * @param dt 时间步长 (秒)
   * @param inputCommand 用户输入的增量命令 (-1, 0, 1)
   * @param params 控制参数
   * @param disturbance 外部干扰值 (可选，直接叠加到速度或加速度上)
   */
  update(dt: number, inputCommand: number, params: ControlParams, disturbance: number = 0): ShipState {
    this.runtimeState.y = this.state.y;
    this.runtimeState.v = this.state.v;
    this.runtimeState.u = this.state.u;
    this.runtimeState.r = this.state.r;

    if (!isControlOdysseyRuntimeReady()) {
      return this.state;
    }

    const result = computeRustSimulationStep(buildRustSimulationRequest({
      dt,
      inputCommand,
      disturbance,
      state: this.runtimeState,
      ...params,
    }));
    this.runtimeState = result.state;
    this.state.y = this.runtimeState.y;
    this.state.v = this.runtimeState.v;
    this.state.u = this.runtimeState.u;
    this.state.r = this.runtimeState.r;
    return this.state;
  }
}
