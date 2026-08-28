## Context

当前 Rust crate 已同时承载分析、互动学习仿真、虚拟船舶仿真和高保真 destroyer runtime。浏览器、worker、Next server 和 Arena analysis service 分别从 `src/resources/control-system/wasm/control_engine/index.js` 导入函数并自行初始化；Unit 5-5 policy-learning 的 `rl-training-runtime.ts` 也是直接触达生成模块的业务 loader。`scripts/wasm/build-control-engine.mjs` 会从 Rust 输入生成 `index.js`、`index.d.ts`、`index_bg.wasm` 等文件并计算 build hash；这些产物不是可由业务层自由替换的实现细节。

本 change 的 captured source identity 是 `a3e6ce7435503050146cadeae6359d6b8eb9a2a5`（实现时仍需验证工作树 clean、树对象和 `origin/integration`）。事实分母固定为九个 raw business loader；调用者、Rust 模块、生成文件和测试从同一 revision-bound inventory 生成，不凭目录名推断 owner。

### Owner and surface denominator

| surface | owner | denominator and boundary |
| --- | --- | --- |
| runtime contract/facade | Platform/Control Engine | client, worker, server 三个 adapter；只有它们允许触达 generated package |
| generic analysis | Control Workbench/Analysis consumer | hook、worker、server runtime 及其 panel/test caller；不拥有 Rust ABI |
| simulation | Practice Lab/Simulation consumer | simulation client/server runtime、`simulation-engine-facade`、七个既有场景及 route callers；保留每场景 dt/maxSubSteps |
| Control Odyssey | Control Odyssey consumer | client/server runtime、`official-simulation.ts` 和 action/test callers；不改变 phaseCrossoverStatus |
| Unit 5-5 policy learning | Unit 5-5 learning consumer | `src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts` 及其 panel callers；不得触达 generated package |
| Arena analysis | Arena evaluation authority | `control-analysis-service.ts` 作为官方 evaluator 的依赖；官方 score/validity 仍由 Arena server evaluator 产生 |
| generated artifacts/build | Platform/Delivery | `scripts/wasm/build-control-engine.mjs`、Rust manifest/source/tests、generated JS/types/WASM；由 build hash 绑定 |

## Goals / Non-Goals

**Goals:**

- 让 client、worker、server 共享一个请求/响应/生命周期 contract，并为未来实现替换保留唯一入口。
- 让未 ready、超时、ABI 缺失、非有限结果和初始化异常全部产生可区分且可审计的 fail-closed 状态。
- 让 capability/result envelope 显式携带 `executor` 与 `authoritySource`；browser façade 仅负责非持久展示，Arena virtual preview 的持久化链路由 server façade 独占。
- 让 Rust 内部可以渐进拆分，不改变现有 model id、单位、fixed-step、result key 和 protocol identity。
- 给下游 consumer 迁移提供静态 no-direct-import 守卫、baseline vectors 和 tolerance 证据。

**Non-Goals:**

- 本 change 不迁移全部 consumer、不退役九个 raw business loader、不删除 generated artifacts，也不引入第二个 runtime 或第二套 numerical implementation。
- 不一次性将 `lib.rs` 重写成多个 crate；不改 Arena 产品评分、官方场景或 hidden dataset。
- 不允许用旧值、预计算曲线、浏览器 heuristic 或 TypeScript integrator 填补 WASM 不可用状态。

## Decisions

### 1. 一个语义 façade，三个执行 adapter

建立唯一的 `ControlEngineFacade` contract，至少包含 `computeAnalysis`、`computeSimulationStep` 和必要的 model-specific capabilities；client adapter 负责异步初始化，worker adapter 负责消息边界，server adapter 负责同步初始化。adapter 只负责序列化、生命周期和错误映射，数值计算仍在 Rust/WASM。

业务 consumer 只引用 facade 的 public API。九个 raw business loader 在迁移期只能作为内部 adapter 或受限 compatibility entry，不能独立宣称 authority；每个保留项必须写入后续 R6 的 retirement ledger。

### 2. 生命周期是显式的，失败不降级为数值结果

用可判别状态表示 `idle`、`loading`、`ready`、`error`、`timeout` 和 `unavailable`，并携带 runtime identity、request id、错误类别和重试/人工动作提示。浏览器的 `SimulationClock` 在 `ready` 之前不推进 physics step；worker 错误回到 facade；server 以受控错误返回，不把空数组、零分或上一轮结果包装成成功。

`fallbackResult` 如果被保留，只能作为初始/过渡显示状态，结构上带 `source: 'fallback'`、`isAuthoritative: false`、`runtimeIdentity: null`。它不进入 cache、SimulationRun、ArenaEvaluationRun、ArenaSubmission、LearningFact 或 leaderboard；ready 结果到达后必须替换它，超时则保持不可用状态。

### 3. generated package 是构建身份的一部分

所有 generated JS、TypeScript declarations、WASM binary 和 `.build-hash` 由 `scripts/wasm/build-control-engine.mjs` 产生。build manifest 记录 Rust source tree、Cargo lock、wasm-pack/rustc 版本、生成文件 hash 和 ABI export 集。测试拒绝业务路径对 generated module 的直接 import，并拒绝只更新 JS/types 而没有匹配 WASM/hash 的 partial package。

### 4. Rust 先分模块边界，再搬实现

保持 crate 的公开 wasm exports 和 model id 不变，内部以最小移动建立 `analysis`、`controllers`、`simulation`、`constraints`、`metrics` 的责任边界：request decoding/validation 在 facade-facing layer，model stepping 在 simulation/controllers，hard constraint 在 constraints，summary/metric derivation 在 metrics。每一步都保留现有 golden vectors，禁止借模块整理机会更改 rounding、单位或时间推进。

### 5. 用 property/baseline/tolerance 取代全数组快照

测试使用固定 seed、代表性 request 和 `ControlAnalysisResult`/summary baseline，比较有限标量和聚合不变量；浮点输出使用明确的绝对/相对 tolerance，必要时记录 benchmark range。高频轨迹只校验长度、单调时间、有限值、边界和 checksum，不做跨编译器的完整数组精确相等。

### 6. Executor 与 authority source 是 capability/envelope 的硬身份

每个 capability 和结果 envelope 都必须带 `executor`（`browser`、`worker` 或 `server`）与 `authoritySource`。`browser`/`worker` facade 可以执行受支持的展示计算，但只能返回 `persisted=false` 的非持久 preview；它们没有 `runStore`、checksum writer 或 evidence writer 权限。`/api/arena/virtual-simulation-runs` 的 server path 必须使用 `executor=server` 和 `authoritySource=control-engine-server-facade`，由 server facade 校验 task/artifact、解析授权模型、重算 trace/summary、计算 checksum，再把结果交给既有 preview writer；请求若出现 client `trace`、`summary` 或 `checksum` 字段，必须在任何 numerical execution 和写入前拒绝。

`authoritySource` 只描述实际产生该结果的边界，不接受客户端自报。Arena official result 仍标记 `authoritySource=arena-official-evaluator`，不因调用 control-engine server facade 而改变其 authority；Practice/preview 也不能通过修改 envelope 把 browser result 升级成 server-authoritative result。

### 7. Model relation 必须与 Rust capability 的真实输入一致

固定 surrogate 的 envelope 必须记录 `modelRelation=surrogate`、受治理的 `teachingSemantics` 和 `prohibitsMixedClaims=true`。教学语义只能说明该 surrogate 可用于何种练习或解释，不得暗示 identified model、官方真实性或跨场景适用性。只有当 capability 声明 `modelRelation=identified`，并且 Rust 执行函数实际消费由 server 解析且授权的 model parameters/model snapshot 时，结果才可使用 identified model；仅把 relation、hash 或 label 放入 metadata 而不进入 Rust request 是拒绝条件。

contract/property tests 必须改变 task/spec/artifact/model identity 之一并确认 identity 参与 canonical request、cache/checksum 或结果校验；若 identity 只停留在 metadata、计算结果仍可无条件复用，则 fail closed。另需测试篡改的 client preview、surrogate 的 identified 声称和未携带授权参数的 identified capability 均不产生可持久结果。

## Hard / Contract / Soft / Delete boundaries

| class | protected fact | treatment |
| --- | --- | --- |
| hard | generated runtime identity、WASM ready/error、数值有限性、fixed-step、官方输入不可伪造 | fail closed；禁止 TS 数值 fallback；由 facade/runtime tests 唯一验证 |
| contract | request/response schema、model id、unit policy、protocol/runtime/model version、error taxonomy | 版本化并由 client/worker/server contract tests 验证 |
| soft | loading 文案、spinner、图表空状态、错误展示细节 | 可变，但不得改变 hard state 或把 fallback 当结果 |
| delete | raw loader 直连、重复初始化、旧 forwarder、临时 compatibility alias | 仅在 R3-R5 零 caller 和 R6 回滚/浏览器/服务端验证后删除；本 change 不声称完成 |

## Vertical slice and no-facade proof

首条 vertical slice 为 generic analysis：`use-control-engine` → worker message → shared client/server facade → `ControlAnalysisResult`，同时用 server adapter 对 `/api/simulation/runs` 的 analysis mode 做 parity smoke。R1 的 server acceptance fixture 还必须覆盖 `/api/arena/virtual-simulation-runs`：browser facade 不能持久化，server facade 独立重算并生成 checksum，client trace/summary/checksum 被拒收。其余 simulation、Odyssey、Arena consumer 仅在下游 change 迁移。

实现必须产出：九项 raw business-loader inventory、facade caller graph、generated identity manifest、ready/error/timeout tests、fallback provenance test 和 direct-import negative test。静态守卫必须证明除 facade adapter/build script 外没有 `control_engine/index.js` import；动态测试必须证明同一 request 在 client worker/server 使用同一 model/protocol result，且失败时没有旧结果写入 evidence。Acceptance tests 还必须证明篡改 client preview 不会被持久化、identity 参与计算/校验、固定 surrogate 不能声称 identified model，且 identified capability 缺少授权模型参数时不可用。

## Migration Plan

1. 在 clean `a3e6ce743` 上冻结九个 raw business loader、caller、Rust source/test 和 generated package 的 identity。
2. 添加 shared contract、client/worker/server adapters、Rust module boundary skeleton 和 identity validator；先运行 generic analysis vertical slice。
3. 将 ready/error/timeout/unavailable 与 fallback provenance 接入现有 hook/worker 生命周期；不改变业务路由和官方 evaluator 的 ownership。
4. 把 facade identity、ABI、executor/authority source、模型关系测试 vectors 和 no-direct-import guard 交给 R2-R5；由 R6 在所有 caller 迁移后处理删除。

Rollback 只回滚本 change 的 contract/adapter/module-boundary commit，并恢复原先已生成且 hash 匹配的 package；不得删除历史生成文件或改写已持久化 run。若生成 package 不完整，构建和 runtime 直接不可用，不能临时切换到 TS 数值实现。

## Open Questions

无。具体 facade 文件名、Rust 子目录拆分顺序和 timeout 数值可在实现时依照现有模块布局确定，但不得改变上述九项分母、生命周期语义或 authority 边界。
