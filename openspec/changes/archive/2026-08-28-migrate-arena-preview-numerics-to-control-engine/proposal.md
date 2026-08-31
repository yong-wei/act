## Why

`src/features/arena/blackbox/controller-preview.ts` 仍在浏览器/服务端路径中执行真实的 TypeScript Euler loop，白箱 workbench preview 也存在与官方 evaluator 混用数值路径的风险。这样 preview 可能与 Rust runtime 不一致，并且在 WASM 不可用时容易产生看似成功的 heuristic 结果。

## What Changes

- 将 black-box `controller-preview.ts` 的真实 Euler step、wave/control limit 和 preview metrics 迁移到 R1 client façade 支持的 Rust model capability。
- 将白箱 preview 的数值路径接入 client façade 的受支持能力矩阵；未实现 Rust method 明确返回 unavailable，不能借 preview 冒充 official support。
- 保留 preview response 与 `SimulationRun` 的 `evaluationVisibility=preview`、`officialEligible=false` 以及 datasetHash/controllerHash/model/sourceExperiment 关系。
- browser façade 只允许非持久 preview 展示；`/api/arena/virtual-simulation-runs` 的校验、Rust 重算、trace/summary、checksum 和既有 preview 写入必须经 R1 server façade，服务端拒收 client trace/summary/checksum。
- 每个 preview capability/envelope 记录实际 `executor` 与 `authoritySource`；固定 surrogate 标记 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims=true`，identified 声称必须由 Rust 实际消费授权模型参数支撑。
- Preview 仍可生成受治理的 trace/summary/replay metadata，但不得写 `ArenaSubmission`、official `ArenaEvaluationRun`、leaderboard 或正式能力达成。
- 保持 black-box hidden model/scenario 与 official evaluator 的服务器边界；客户端 preview 不读取或推断 hidden inputs。
- 使用 fixed-step 与 property/baseline/tolerance 验证 Rust 迁移前后受支持 preview 的行为，不采用 TypeScript numerical fallback。

## Capabilities

### New Capabilities

- `arena-preview-control-engine`: 定义 Arena black-box/white-box preview 的数值 façade、能力支持、身份和 official boundary。

### Modified Capabilities

None。`arena-model-registry-preview-adapters`、`arena-knowledge-node-preview`、`simulation-arena-evidence-governance`、`arena-blackbox-official-evaluation` 和 `simulation-runtime-replayability` 的 preview/official 规则继续有效；本 change 只迁移 preview 数值执行。

## Impact

- **Owner**：Arena Preview；Rust numerical runtime 由 Platform/Control Engine 提供，Arena 仍拥有 preview response、ownership 和 presentation。
- **Numerical denominator**：`src/features/arena/blackbox/controller-preview.ts` 中 1 个真实 TS Euler loop 及其 wave/control/metric derivation；`src/features/arena/submissions/workbench-preview.ts`、白箱 preview provider/adapter 中所有数值调用；实现前须从 captured tree 重新生成完整 list，区分纯格式化与真实数值路径。
- **Routes/APIs**：`/api/arena/virtual-simulation-runs`、Arena workbench preview invocation、black-box experiment/model APIs；preview route 的 auth/ownership contract 不变，official `/api/arena/evaluate` 与 `/api/arena/submissions` 不接收 preview authority。
- **Models**：`ArenaVirtualSimulationRun`、canonical `SimulationRun`/`SimulationTrace`、`ArenaBlackBoxExperiment`、`ArenaIdentificationModel`、`ArenaControllerArtifact`（只读 identity）；不写 `ArenaSubmission`/official evaluation。
- **Scripts/tests/callers**：`scripts/wasm/build-control-engine.mjs`、Arena preview/adapter/replay/profile/evidence/route tests、`cruise-roll-blackbox-adapter.ts`、`workbench-preview.ts` 和相关 panels。完整 direct/dynamic caller denominator 由 static graph + route tests 冻结。
- **Dependencies**：硬前置 R1 facade、R2 artifact/run contract；R3 与本 change 并列依赖 R1/R2；R6 依赖 R3、R4、R5。tracking parent 不作 blocker。
- 不改变 official Arena scoring/product rule、leaderboard、课程 manifest、数据库 schema、hidden scenario、生产部署或正式能力判定。
