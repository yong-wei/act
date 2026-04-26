# 仿真规范说明（Rust 驱动基线）

本规范用于指导后续新增或改造仿真互动环节。当前平台的数值模型统一由 `rust/control-engine` 承担，前端只保留固定步长调度、状态展示、控制面板、图表与埋点。

## 1. 统一目标

- 实时步进、批量响应、优化评估和数值分析统一进入 Rust/WASM 或服务端 WASM runtime。
- 前端不得新增 TypeScript 物理 stepper、传函离散化器或通用仿真 Hook。
- 页面继续使用 `SimulationClock` 做固定步长调度，禁止直接用可变 `delta` 推进模型。
- 控制器、UI 状态、轨迹和指标记录保持工程单位，弧度等内部单位只在模型边界内转换。

## 2. 统一内核与入口

- Rust 源码：`rust/control-engine/src/`
- 浏览器虚拟仿真入口：`src/resources/simulations/rust/control-engine-runtime.ts`
- 服务端虚拟仿真入口：`src/resources/simulations/rust/control-engine-server-runtime.ts`
- 互动学习批量仿真入口：`src/resources/interactive-learning/rust/interactive-simulation-runtime.ts`
- 船舶仿真 facade：`src/resources/simulations/physics/simulation-engine-facade.ts`

新增模型时应优先扩展 `compute_virtual_simulation_step` 的 `modelId` 分支，并在 TypeScript 侧新增薄适配函数。不要在页面中直接实现数值积分、Tustin 离散化、Nomoto/MMG/Azipod/SemiSub 步进或 PID 闭环批量仿真。

## 3. 时间步进规范

统一采用固定步长推进，推荐参数：

- `dt = 1 / 60`
- `maxSubSteps = 6`

```ts
const clockRef = useRef(new SimulationClock({ dt: 1 / 60, maxSubSteps: 6 }));

const loop = (timestamp: number) => {
  const frameDelta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
  lastTimeRef.current = timestamp;

  clockRef.current.advance(frameDelta, (dt) => {
    stateRef.current = stepSomeRustModel({ state: stateRef.current, dt });
  });

  requestAnimationFrame(loop);
};
```

注意事项：

- 禁止 `setInterval` 驱动物理模型。
- 暂停或重置时需调用 `clockRef.current.reset()`。
- WASM runtime 未加载完成时，页面应暂停物理步进或显示空状态，不回退到本地 TypeScript 模型。

## 4. 模型调用规范

### 船舶与复杂物理仿真

页面通过 `simulation-engine-facade.ts` 调用既有函数签名，例如 `nomotoStepRK4`、`mmg3dofStep`、`semiSub3DOFStep`、`azipod3dofStepRK4`。这些函数内部必须构造 `modelId` 请求并调用 Rust runtime。

### 互动学习数值仿真

PID 仿真器、指标裁判席、极点操纵器、欠阻尼响应探索、台风邮轮任务和香槟塔模型统一使用 `interactive-simulation-runtime.ts` 中的适配函数。页面不得导入旧的 `createLinearPlant`、`stepDiscreteStateSpace` 或 `useControlSystem`。

### 数值 API

`/api/simulation/*` 中的物理评估与数值分析使用服务端 WASM runtime。LLM 评语类接口可以保留 TypeScript 业务编排，但不得重新实现物理模型。

## 5. 指标与轨迹记录

- 记录间隔建议 `recordInterval = 0.05s`。
- 统一记录：`time / inputs / outputs / states`。
- 输出指标建议包含：超调、稳态误差、调节时间、能耗积分、舵角/推进器限幅等。

## 6. 禁止项

- 禁止新增 TypeScript 物理模型文件和页面内数值积分器。
- 禁止恢复 `src/resources/simulations/physics/models/*`、`src/resources/simulations/lib/simulation-engine.ts`、`src/resources/simulations/hooks/useShipSimulation.ts` 或 `src/resources/interactive-learning/hooks/useControlSystem.ts`。
- 禁止新增 `createLinearPlant`、`createNonlinearPlant`、`discretizeTransferFunctionTustin` 这类前端仿真主干。
- 禁止把实现语言或 WASM 细节写入学生可见文案。
