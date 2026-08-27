## Why

standalone simulation 与 Practice live 仍把 controller、plant、environment 和 metrics 分散在 TypeScript 文件中；即使部分模型已经经过 `simulation-engine-facade`，PID、Smith predictor、DP、thruster、notch、gain schedule、wind/current/ice/sloshing 和 RK4 等调用者仍可能绕过同一 runtime。结果是实时运行与 replay/evidence 的数值口径不稳定。

## What Changes

- 将 standalone simulation/Practice live numerics 迁移到 R1 的同一 control-engine façade，先完成一条真实 vertical slice，再按 phase 迁移剩余调用者。
- 每个 Practice capability/run envelope 记录实际 `executor` 与 `authoritySource`；browser facade 只做非持久展示，owner-scoped run 的持久化仍由受信 writer 按 R2 contract 完成。
- 冻结并分阶段验证 plant integration、controller runtime、disturbance/environment 和 metrics denominator；每个模型给出 Rust capability、baseline 与 abs/rel tolerance。
- 迁移 PID、Smith predictor、DP、thruster allocation、notch、gain schedule、wind/current、ice、sloshing、RK4 等已发现的 TS 数值路径，禁止新增 TS 物理或数值 fallback。
- 保留现有固定步长：七个 standalone scene 当前 `dt=1/60,maxSubSteps=120`；Control Odyssey 当前 `dt=1/60,maxSubSteps=6`。不机械统一调度参数。
- Practice 继续只拥有自己的 `SimulationRun`/outcome/evidence；不写 ArenaSubmission、ArenaEvaluationRun、leaderboard 或正式能力结果，不改 manifest/plugin registry。
- 用 seeded replay、property/baseline、浮点 tolerance 和 benchmark 验证迁移，不做完整轨迹数组精确快照。

## Capabilities

### New Capabilities

- `practice-live-control-engine`: 定义 Practice/standalone live simulation 的 façade 迁移、fixed-step 调度、模型替代和 run/evidence 边界。

### Modified Capabilities

None。复用 `simulation-scene-trace-protocol`、`simulation-runtime-replayability`、`simulation-arena-evidence-governance`、`resource-simulation-state-effect-safety` 和 `control-engine-wasm-facade`；本 change 不重定义 SceneSpec 或 evidence schema。

## Impact

- **Owner**：Practice Lab/Simulation runtime；场景页面拥有 UI 与运行上下文，Rust/Control Engine 拥有 plant/controller/environment/metric 数值实现。
- **Scene/caller denominator**：七个 standalone scene `container-simulation.tsx`、`cruise-simulation.tsx`、`destroyer-simulation.tsx`、`dredger-simulation.tsx`、`drilling-simulation.tsx`、`icebreaker-simulation.tsx`、`lng-simulation.tsx`，以及 Control Odyssey live runtime/official simulation；实现时冻结全部 `SimulationClock`、step、controller、disturbance 和 metrics callers。
- **Numerical denominator**：TS PID、Smith predictor、DP、thruster allocation、notch、gain schedule、wind/current、ice-breaking、sloshing、RK4 与相关 model-state helpers/telemetry bridges；区分数值实现、状态适配、图表和 UI。
- **Routes/APIs/models**：standalone `/simulations/*` pages、`/api/simulation/runs`、cruise/icebreaker analysis APIs、Control Odyssey actions/runtime；`SimulationTaskSpec`、`SimulationRun`、`SimulationTrace`、`SimulationSession`/`SimulationLog` 只作为既有 persistence observations，不在本 change 删除或迁移 schema。
- **Scripts/tests**：`scripts/wasm/build-control-engine.mjs`；`simulation-engine-facade`、`simulation-full-rust-migration`、`simulation-rust-runtime`、`simulation-api-rust-runtime`、seeded/replay/run-contract、scene tests、Control Odyssey Rust runtime tests。所有 direct/reverse/dynamic callers 从 captured tree 重算。
- **Dependencies**：硬前置 R1 facade 与 R2 artifact/run contract；R3 并列依赖 R1/R2；R6 依赖 R3-R5。tracking parent 不作 blocker。
- 不改变 Arena 评分/排行、课程 manifest、plugin registry、Prisma 大迁移、生产部署或 official evaluator。
