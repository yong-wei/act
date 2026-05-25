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

## 7. SceneSpec v1 与 SimulationTrace v1 协议

本节定义平台级仿真场景描述协议和追踪协议，类型定义见 `src/resources/simulations/core/protocol-types.ts`。

### 7.1 SceneSpec v1 字段

| 域 | 字段 | 必需 | 说明 |
|----|------|------|------|
| scene | id, title, route, launchModes | 必需 | 场景身份、路由、支持的启动模式 |
| scene | resourceId, courseAlignment | 可选 | 课程资源 id、单元对齐 |
| model | family, runtimeModelId, parameterSchema, version, unitPolicy | 必需 | 模型族、Rust/WASM runtimeModelId、参数 schema、版本、单位策略 |
| disturbance | environmentFamilies, stochasticPolicy, seedRequirement | 必需 | 环境族、随机策略、种子需求 |
| evaluation | metrics, hardConstraints, successCriteria, evaluationProtocol | 必需 | 评价指标、硬约束、成功条件、EvaluationSpec 引用 |
| assets | assetIds, visualLayers, version | 必需 | 资源 id、视觉层、资源版本 |
| telemetry | sampleChannels, defaultRecordInterval, summaryMetrics | 必需 | 遥测通道、默认记录间隔（建议 0.05s）、汇总指标 |
| replay | seedFields, runtimeVersion, modelVersion, checksumPolicy | 必需 | 回放种子字段、运行时版本、模型版本、校验策略 |
| governance | evidenceSource, privacyLevel, retentionClass, contextFields | 必需 | 证据源、隐私级别、保留类别、上下文字段 |

### 7.2 EvaluationSpec v1 字段

| 字段 | 必需 | 说明 |
|------|------|------|
| id | 必需 | 评价协议标识，如 "eval/cruise-official" |
| metrics | 必需 | 评价指标 id 列表 |
| hardConstraints | 必需 | 硬约束 id 列表 |
| visibility | 必需 | preview / official / both |
| modelRelation | 必需 | 记录 Arena 对象与 3D 场景对象的模型关系（same / simplified / surrogate）、教学语义和评价边界 |
| prohibitsMixedClaims | 必需 | 是否禁止混合 preview 和 official 声明 |

### 7.3 SimulationTrace v1 字段

| 域 | 字段 | 必需 | 说明 |
|----|------|------|------|
| envelope | runId, sceneId, scenarioId, protocolVersion, seed, startedAt, completedAt | 必需 | 运行身份与时间边界 |
| envelope | runtimeVersion, modelVersion, sampleCadence, checksum | 必需 | 版本、采样节奏与校验 |
| samples | path, frameCount, channels | 必需 | 高频采样引用 |
| summary | metrics, passed, durationSeconds | 必需 | 聚合指标、通过/失败、时长 |

### 7.4 派生字段

从上述必需字段派生的值（如 `TrajectoryPoint[]`、`ChartData`、`SimulationMetrics`、伦理违规列表）属于运行时产物，不在协议中重复定义。协议只规定场景配置和追踪信封，运行时数据结构沿用 `src/resources/simulations/core/types.ts`。

### 7.5 与 Rust/WASM 基线的关系

- 本协议是**描述层**，不替代 Rust/WASM 运行时（第 2 节）。
- `model.runtimeModelId` 必须对应 `compute_virtual_simulation_step` 中已注册的 `modelId`。
- `telemetry.defaultRecordInterval` 默认 0.05s，与第 5 节要求一致。
- `replay.seedFields` 为后续回放功能预留，当前不改变固定步长调度逻辑（第 3 节）。
- 新增场景时，先扩展 `SceneSpec v1` 描述，再在 Rust 侧新增 `modelId` 分支和 TypeScript 适配函数。
