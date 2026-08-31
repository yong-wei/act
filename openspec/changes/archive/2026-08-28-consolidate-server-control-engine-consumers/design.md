## Context

当前 `/api/simulation/runs` 直接调用 generic analysis server runtime；两个 simulation analysis route 直接调用 virtual simulation server runtime；Control Odyssey 另有 server runtime；Arena `control-analysis-service.ts` 自行 dynamic import generated module 并 `initSync`。这些入口都在服务端，却拥有不同的 readiness、错误、runtime identity 和缓存处理。

R1 提供 server façade 的基础 contract，R2 提供 artifact/run identity。此 change 只收敛服务端执行入口，不能把 Arena official evaluator 变成通用 simulation service：Arena evaluator 仍负责 task/object/protocol 选择、hidden execution、metric extraction、hard constraints、score 和 `ArenaEvaluationRun`/`ArenaSubmission` 写入。

### Owner and denominator

| server consumer | owner | route/API and caller denominator | migration boundary |
| --- | --- | --- | --- |
| generic analysis | Control Workbench/Analysis | `/api/simulation/runs` analysis branch、analysis runtime、route/data-governance tests | only numerical compute moves to façade; run persistence remains Simulation owner |
| simulation virtual runtime | Practice Lab/Simulation | cruise-comfort、icebreaker-robust routes、simulation server runtime、optimizer callers/tests | keeps scene dt/maxSubSteps and SceneSpec/Trace semantics |
| Control Odyssey | Control Odyssey | `control-engine-server-runtime.ts`、`official-simulation.ts`、action/recovery/runtime tests | keeps Odyssey phase/credit and `phaseCrossoverStatus` semantics |
| Arena analysis | Arena evaluation | `control-analysis-service.ts`、`whitebox-evaluator/provider`、`/api/arena/evaluate` and evaluation tests | façade is numerical port; Arena evaluator remains score/official authority |
| Arena virtual preview persistence | Arena Preview + Control Engine server | `/api/arena/virtual-simulation-runs`、preview adapter/store、`ArenaVirtualSimulationRun`/canonical `SimulationRun` writers/tests | server façade validates, recomputes and checksums; browser façade is display-only and cannot write |

Models/readers denominator is `ArenaControllerArtifact`, `ArenaEvaluationRun`, `ArenaSubmission`, `SimulationTaskSpec`, `SimulationRun`, `SimulationTrace` plus protocol/cache readers. Generated package and Rust files are counted once through R1 identity; no consumer may create another Wasm module or server singleton.

## Goals / Non-Goals

**Goals:**

- 让四类 server consumer 通过同一 server façade 获得 numerical result、runtime identity 和 fail-closed errors。
- 保证 official Arena inputs 来自 server-owned artifact/task/hidden scenario/model，而不是客户端 score/trace/params。
- 保留三个既有 protocol version 的行为和历史结果；缓存按 task/artifact/protocol 分隔。
- 用调用图、架构守卫、protocol regression 和 property/tolerance tests 证明没有遗留 direct generated imports。

**Non-Goals:**

- 不合并四类业务 owner，不把 Arena evaluator、Practice run 或 Odyssey run 变成一个公共评分服务。
- 不改变 Arena score/validity/constraints/leaderboard、hidden scenario 内容或 accepted historical evaluation。
- 不迁移 client preview/live numerical paths（R4/R5 负责），不退役 raw loaders（R6 负责）。
- 不新建 Prisma 模型、替换 `SimulationRun`，不以 cache hit 或客户端 result 充当 official evidence。

## Decisions

### 1. Server façade 是数值 port，不是业务 authority

四类 server consumer 以及 virtual-preview persistence path 都注入 R1 的 typed server façade。它接受带 spec/artifact/runtime identity 的 request，返回 numerical result 或 typed unavailable/error；不接受 `score`、`valid`、leaderboard row 或 evidence write intent。Arena evaluator 在 façade 外部完成 task policy、private context、metric extraction、hard constraints、score 和 official 持久化。

这样可以统一 Wasm loading 而不把 Arena 官方评测降格为 generic simulation endpoint。`ControlAnalysisService` 可以保留接口名作为 Arena adapter，但实现只能委托 server façade；该接口不向其他域导出官方结果。

### 2. 迁移顺序以一条可回归 vertical slice 开始

先迁移 `/api/simulation/runs` 的 analysis mode：route auth/context → server façade → `ControlAnalysisResult` → existing SimulationRun persistence/summary。确认 runtime identity/error semantics 后迁移两个 virtual route，再迁移 Odyssey；Arena analysis 最后接入其独立 evaluator。每步都维持旧 protocol、result keys 和 cache semantics。

### 3. Official protocol 与 historical result 保持不可变

`analysis-whitebox-v1` 继续只适用已支持 PID/serial-compensator；`template-whitebox-v1` 继续覆盖未实现真实分析的 method；`blackbox-official-v1` 继续由 hidden scenario evaluator 使用。历史 `ArenaEvaluationRun`/`ArenaSubmission` 只读取，不能因为 façade 或 Rust module 变化而重算；新 runtime 需要新 protocol/runtime identity 才能改变语义。

### 4. Hidden context 只在 Arena server evaluator 内部

`taskId`、artifact ownership、registered dataset/model、hidden scenario set、reference trajectory、private model/test 和 constraint policy 由 Arena server evaluator 从数据库/registry 解析。客户端提交的 preview score、trace、parameter claim、runtime result 只能作为请求材料并经过 server 验证；它们不进入 official metrics 或 cache key 的权威部分。

### 5. Cache key 扩展但不改变现有隔离

Arena numerical/evaluation cache 的最小 key 继续是 `taskId + artifactHash + protocolVersion`，不得复用 preview 或另一 protocol 的 result；实现可将 `specHash`、runtimeVersion、modelVersion 和 controllerSchemaVersion 作为 identity metadata 或严格 key component。cache hit 必须再次验证 owner/artifact/protocol compatibility，miss/failure 不得返回 client stale result。

### 6. Virtual preview 的 server persistence boundary

`/api/arena/virtual-simulation-runs` 是 preview writer 的 server entrypoint，不是接受客户端结果的 relay。route 只接受 task/artifact 和允许的公开输入；任何 client `trace`、`summary`、`checksum` 或 hidden field 都必须在调用 facade 前拒绝。server facade 负责授权 artifact/model 解析、Rust numerical recompute、trace/summary 派生、checksum 计算和 `ArenaVirtualSimulationRun`/canonical `SimulationRun` 写入所需的受信结果。browser/worker facade 的 capability 只能用于非持久展示，必须携带 `persisted=false`，没有 run/checksum/evidence writer 权限。

`executor` 与 `authoritySource` 从实际 adapter 生成并由 server validator 复核。preview server 结果使用 `executor=server`、`authoritySource=control-engine-server-facade`；Arena official evaluation 仍使用 `authoritySource=arena-official-evaluator`。固定 surrogate 的结果必须有 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims=true`；identified result 只有在 server 授权参数实际传入 Rust capability 时才可通过。

## Hard / Contract / Soft / Delete boundaries

| class | protected fact | rule |
| --- | --- | --- |
| hard | server-only hidden inputs、official Arena authority、task/artifact/protocol cache identity、WASM readiness、历史结果不可变 | violation 直接拒绝/不写 evaluation；官方 score 只由 Arena evaluator 产生 |
| contract | facade request/result/error、runtime identity、protocol mapping、scene/run mapping | typed adapter + route/provider tests，不能通过 `any` 绕过 |
| soft | server log wording、latency metric、non-official diagnostics | 可调整但不改变 response authority/visibility |
| delete | 四个 server raw loader 的 generated import、重复 `initSync`、未绑定 cache alias | 迁移并完成 zero-caller/browser/server checks 后由 R6 删除；本 change 保留受限 compatibility 记录 |

## No-facade proof and vertical migration

首条 slice 的验收必须同时检查：`/api/simulation/runs` 只 import server façade；result 持久化仍由 simulation/evidence owner 完成；server unavailable 不生成 `SimulationRun` official/evidence result。virtual-preview slice 还必须证明 browser path 不持久化，server path 重算并计算 checksum，client trace/summary/checksum 被拒绝，且身份字段实际参与 canonical request/cache/checksum/result verification。全量静态 guard 扫描四类目录，除 façade adapter/build script 外 generated module import 数为零，且所有 direct caller 均在迁移 matrix 有对应 façade symbol。

Arena 专门测试用 fake server façade 验证 evaluator 仍在服务端计算 metrics/constraints/score，并忽略 artifact 中伪造的 client preview score/trace/params。virtual-preview route tests 还要提交篡改的 client trace/summary/checksum，断言 numerical executor 和 writer 均未调用；model identity 改变必须导致 canonical/checksum/cache 校验变化；surrogate 不能声称 identified，identified capability 缺少授权参数必须 unavailable。历史 protocol fixtures 对同一 row 只做读取一致性，不重算数据库结果。

## Migration Plan

1. 验证 R1 façade identity、R2 envelope 和四类 server denominator；冻结 protocol/cache/historical result fixtures。
2. 迁移 generic analysis vertical slice，运行 route/auth/run persistence tests。
3. 迁移 cruise/icebreaker virtual server routes，保持各自 fixed-step contract；再迁移 Control Odyssey。
4. 将 `/api/arena/virtual-simulation-runs` 的校验、Rust 重算、checksum 和 preview writer 改为 server façade boundary，browser facade 保持 display-only，并加入 client-field rejection tests。
5. 将 Arena analysis service 改为 façade adapter，保留 official evaluator 的 hidden context、metric and persistence authority。
6. 产出 direct-import zero report、cache key/protocol regression receipt、executor/authority/model-relation receipt 和 R6 删除清单。

Rollback 按 vertical slice 回退 consumer adapter 到旧 raw loader；不回滚或重写已经接受的 `ArenaEvaluationRun`、`ArenaSubmission`、`SimulationRun`。若 server façade 不可用，路由返回受控不可用，不能切回客户端或 heuristic 数值作为官方结果。

## Open Questions

无。是否将 `specHash` 纳入物理 cache key 可在实现时依据现有 cache store 决定，但 `taskId/artifactHash/protocolVersion` 三元隔离、历史不重算和 official authority 不得改变。
