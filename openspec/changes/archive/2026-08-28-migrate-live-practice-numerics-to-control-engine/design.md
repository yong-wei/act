## Context

`docs/Simulation_Guidelines.md` 已规定 Rust/WASM 拥有数值模型，前端只做 `SimulationClock` 固定步长调度、UI、图表和埋点。现状仍有两种调度 profile：七个 standalone scene 使用 `dt=1/60,maxSubSteps=120`，Control Odyssey 使用 `dt=1/60,maxSubSteps=6`。`simulation-engine-facade.ts` 已包装若干 `modelId`，但 controllers、disturbances、metrics 和部分 interactive resources 仍有 TypeScript 数值逻辑。

### Owner and denominator

| phase/surface | owner | denominator |
| --- | --- | --- |
| plant integration | Rust/Control Engine | 7 scene plants、Control Odyssey models、existing facade model ids、RK4/discrete plant paths |
| controller runtime | Practice Lab/Control Engine | PID、Smith predictor、DP、thruster allocation、notch、gain schedule 及 state/command adapters |
| disturbance/environment | Rust/Control Engine | wind、current、ice-breaking、slosh、dredging/fin/environment helpers；视觉 noise 不计入 |
| metrics/evidence | Practice Lab/Simulation | summary metric derivation、telemetry bridge、SimulationTrace/checksum and run writer；envelope 记录 executor/authoritySource；不拥有 Arena official score |
| scheduling/UI | Scene/Practice page | seven scene `SimulationClock` configs、Odyssey clock、render/telemetry only |
| routes/models/tests | Simulation/Platform | simulation routes, `SimulationTaskSpec`/`SimulationRun`/`SimulationTrace`, legacy persistence observations, listed tests and dynamic callers |

初始 captured source identity 为 `a3e6ce7435503050146cadeae6359d6b8eb9a2a5`；实现必须先在 clean tree 重新枚举 numerics、clock、routes/API、models、scripts、tests 和 callers。路径列表是候选分母，最终以 graph/AST/动态测试覆盖闭合。

## Goals / Non-Goals

**Goals:**

- 让 Practice/standalone live 的真实 numerics 全部通过同一 control-engine facade，保留每个 scene 的模型语义和 fixed-step profile。
- 先交付一条完整 plant→controller→disturbance→metrics→SimulationRun vertical slice，再有序迁移余下调用者。
- 对每个 TS numerical path 提供明确 Rust capability、baseline、property/invariant、abs/rel tolerance 和回滚点。
- 让 run owner、task/spec/controller/replay identity 和 Practice non-official boundary 在迁移中保持不变。

**Non-Goals:**

- 不把七个场景机械合并成一个 dt/maxSubSteps profile，不改变场景参数、教学表现或 manifest/plugin registry。
- 不改 Arena score、leaderboard、official evaluation、hidden scenario 或 Arena submission。
- 不删除 `SimulationSession`/`SimulationLog`，不做 Prisma 大迁移；legacy persistence 是否可退由 R6 单独证明。
- 不用 TS heuristic、旧缓存、预计算数组或 variable delta 在 WASM 不可用时继续推进。

## Decisions

### 1. 以 phase contract 驱动迁移

每条 vertical slice 先冻结四个 phase 的输入/输出：plant state integration、controller command/state、disturbance/environment seed/state、metrics denominator/summary。Rust facade 接收 typed request，页面只负责 clock 和 rendering；phase 之间的 state serialization 由 R1/R2 contract 绑定。

首条 slice 选择 Cruise live turn：`cruise-simulation.tsx` 的 clock/telemetry → facade plant/controller/environment step → summary/checksum → Practice-owned SimulationRun/Trace。完成后按同一矩阵迁移其余六个 scene 与 Control Odyssey。

### 2. 保留各场景调度 profile

`SimulationClock({ dt: 1 / 60, maxSubSteps: 120 })` 的七个 standalone scene 和 `SimulationClock({ dt: 1 / 60, maxSubSteps: 6 })` 的 Control Odyssey 分别作为不可变 contract fixture。`requestAnimationFrame` 只计算 frame delta 并驱动 clock；physics step 始终收到固定 dt。禁止 `setInterval`、实时 variable delta、页面内 RK4/Euler 或 controller timer。

WASM not-ready 时 clock pause/controlled unavailable；不补发 step，不重复消费同一 frame，不用旧状态生成新的 evidence。

### 3. 每个 TS numerical path 必须有显式替代

建立替代矩阵：PID→Rust PID capability；Smith predictor→delay/plant capability；DP/thruster→controller/allocation capabilities；notch/gain schedule→controller/filter capabilities；wind/current/ice/sloshing→disturbance capabilities；RK4→Rust plant integrator capability。纯状态适配、单位转换、图表和 UI 不伪装成 numerical migration。

迁移前 capture baseline（summary metrics、boundary events、seed/checksum）与 Rust result 做 abs/rel tolerance 和 property checks；超出 tolerance 直接 invalid/unavailable，不能调宽阈值掩盖差异。性能 benchmark 记录范围，不把单机时延变成 correctness claim。

### 4. Practice run 与 Arena official 完全隔离

Practice live 通过 R2 envelope 写自己的 `SimulationRun(runKind=scene_simulation/practice)` 和 `SimulationTrace`，保留 owner、task/spec/controller/runtime/model/seed/checksum、`executor`、`authoritySource`、summary 和 source domain。browser facade 只返回非持久展示；任何 owner-scoped run/checksum/evidence 写入必须经过受信 Practice writer/server boundary，不能直接把 browser trace 当成持久 authority。它不创建 `ArenaSubmission`/`ArenaEvaluationRun`，不进入 leaderboard，不改变 Arena artifact。Control Odyssey 的教学/credit bridge 仍由 Odyssey owner 处理；若另有 Arena bridge，必须经过现有 accepted submission contract。

### 5. 逐步移除旧 numeric source，保留可回滚边界

每完成一个 model family，静态 graph 必须显示 active caller 只走 facade，旧 TS numeric function 进入 R6 deletion ledger；若仍被 legacy/历史 route 调用则明确 compatibility-only，不允许两套结果同时作为 authority。旧 persistence rows 只读，迁移不会重算历史结果。

## Hard / Contract / Soft / Delete boundaries

| class | protected fact | rule |
| --- | --- | --- |
| hard | fixed dt/maxSubSteps、Rust numerical ownership、WASM readiness、finite/constraint safety、Practice owner/non-official | failure pauses/fails closed；不写错误 run/evidence或 Arena official data |
| contract | phase request/state、SceneSpec/Trace、runtime/model/schema、seed/checksum、tolerance、clock profile | typed facade + property/replay/route tests |
| soft | visual interpolation、telemetry sampling presentation、loading/disabled copy、chart formatting | 可调整但不得推进 physics 或改变 summary authority |
| delete | direct TS numerical functions/imports、duplicate stepper、legacy numeric forwarder | 每个替代通过 baseline/property/browser/server/zero-caller 后由 R6 删除 |

## No-facade proof and vertical migration

首条 Cruise slice 必须交付 phase matrix、clock fixture、Rust capability identity、summary/checksum parity、Practice run ownership 和 browser smoke。no-facade 证明要求：active scene/controller/environment/metrics callers 均从 facade import；不存在 page-local Euler/RK4/variable-delta；每个被迁移 function 只有一个 numerical authority；旧函数若未删只能列 compatibility caller 和删除条件。

静态 guard 扫描 `src/resources/simulations/physics/controllers`、`disturbances`、interactive learning numerical paths 和七个 scene；动态 browser test 检查 pause/reset/clock profile/WASM unavailable；server route test 检查 run/evidence payload 不含 Arena official fields。

## Migration Plan

1. 以 clean `a3e6ce743` 重算 model/controller/disturbance/metrics/clock/caller denominator，冻结 seven-scene and Odyssey profiles。
2. 依 R1/R2 contract 建立 phase capability matrix 和 Cruise vertical slice；记录 seeded baseline/tolerance。
3. 迁移 Cruise live，再逐个迁移 container、destroyer、dredger、drilling、icebreaker、LNG 和 Odyssey；每个 model family 单独通过 direct caller/behavior tests。
4. 统一 Practice run/replay/evidence writer 接入，不进入 Arena official paths；更新 R6 deletion ledger。
5. 完成浏览器、server、Rust/WASM、property/replay、typecheck 与 strict OpenSpec 验证。

Rollback 按 scene/model family 回退到迁移前完整 commit；若新 capability 不 ready，则该 Practice scene 暂停/不可用，不恢复 TS numerical fallback。历史 `SimulationRun`/`SimulationTrace` 和 Arena records 不重算、不改写。

## Open Questions

无。具体 Rust `modelId` 和 phase request shape 可由实现时现有 crate 结构决定；每个未完成替代必须保持 unavailable 并留在分母和退役台账中。
