## Why

服务端仍有四类独立 control-engine consumer：generic analysis、simulation virtual runtime、Control Odyssey server runtime 和 Arena control-analysis service。它们分别读取生成 Wasm、初始化 singleton、解析 JSON 并处理异常；若任一入口接受客户端 score/trace/params，官方 Arena 评价就可能与 server-owned hidden execution 混合。

## What Changes

- 将上述四类 server consumer 收敛到 R1 的稳定 server façade，统一初始化、ABI、错误、runtime identity 和可用性语义。
- 以 `/api/simulation/runs` 的 analysis vertical slice 为首个迁移，再迁移 cruise/icebreaker virtual routes、Control Odyssey server 和 Arena analysis service。
- 保留 Arena official evaluator 作为独立 authority；facade 只提供数值执行，不拥有 Arena score、validity、hard constraints 或 leaderboard 写入。
- 保留并显式版本化 `analysis-whitebox-v1`、`template-whitebox-v1`、`blackbox-official-v1`；历史 accepted results 不重算、不改写。
- official Arena evaluator 独占 hidden scenario、private dataset/model/reference trajectory/test；客户端 score、trace、params 仅作展示或输入校验，绝不成为 official input。
- `/api/arena/virtual-simulation-runs` 的持久化校验、Rust 重算、trace/summary 生成、checksum 计算和写入必须走 R1 server façade；browser façade 仅可返回非持久展示，服务端在执行前拒收 client trace/summary/checksum。
- server capability/result envelope 必须记录实际 `executor` 与 `authoritySource`；surrogate 固定记录 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims`，identified 声称必须有 Rust 实际消费的授权模型参数。
- 继续以 `taskId + artifactHash + protocolVersion` 隔离 Arena cache，并加入 runtime/model/spec identity 防止跨协议复用。

## Capabilities

### New Capabilities

- `server-control-engine-consumers`: 定义服务端 control-engine consumer 的统一 façade 入口及 Arena official evaluator 的独立 authority 边界。

### Modified Capabilities

None。复用 `arena-analysis-whitebox-evaluation`、`arena-blackbox-official-evaluation`、`arena-official-evaluation-consistency`、`simulation-scene-trace-protocol` 和 `control-engine-wasm-facade`；本 change 不复制这些评分或回放要求。

## Impact

- **Owner**：Platform/Control Engine server adapter 负责稳定入口；Arena evaluation 继续由 Arena server evaluator 负责 authority，Simulation/Practice 与 Control Odyssey 负责各自业务 run。
- **Server consumer denominator（4 类）**：generic analysis（`src/app/api/simulation/runs/route.ts` + `src/resources/control-system/analysis/control-engine-server-runtime.ts`）；simulation virtual runtime（`src/app/api/simulation/cruise-comfort-analysis/route.ts`、`icebreaker-robust-analysis/route.ts`、`src/resources/simulations/rust/control-engine-server-runtime.ts`）；Control Odyssey（`src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts`、`official-simulation.ts`）；Arena analysis（`src/features/arena/evaluation/control-analysis-service.ts`、white-box evaluator/provider）。实现时以调用图重算完整 direct/dynamic caller 集。
- **Routes/APIs/models**：上述 simulation routes、`/api/arena/virtual-simulation-runs`、`/api/arena/evaluate`、`/api/arena/submissions`；`ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`、`ArenaVirtualSimulationRun`、`SimulationTaskSpec`、`SimulationRun`、`SimulationTrace` 只作为既有输入/输出模型，不做 schema 大迁移。virtual preview 的 client trace/summary/checksum 不属于可接受的 server input。
- **Scripts/tests**：`scripts/wasm/build-control-engine.mjs`、Rust crate/tests、Arena evaluation/provider/route tests、simulation API/runtime tests、Control Odyssey runtime tests、replay/evidence contract tests。历史 protocol fixture 进入 regression denominator。
- **Dependencies**：硬前置 R1 `establish-control-engine-wasm-facade` 与 R2 `define-practice-lab-artifact-run-contract`，二者均依赖 charter/dependency-contract；R6 依赖本 change 以及 R4/R5。tracking parent 不作 blocker。
- 不改变官方评分产品规则、leaderboard 策略、课程 manifest、Prisma schema、生产部署或 runtime selector。
