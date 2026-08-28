## Why

控制数值目前由九个 raw business loader 分别初始化：generic analysis 的 hook、worker、server，simulation 的 client、server，Control Odyssey 的 client、server，Arena control-analysis service，以及 Unit 5-5 policy-learning 的 `rl-training-runtime.ts`。它们各自处理生成 Wasm 模块、ready 状态、错误和超时，`useControlEngine` 还可能把预计算结果作为当前结果；这使同一模型在浏览器、worker 和服务端出现不同的权威语义。

## What Changes

- 建立由 Rust/WASM 实现、由 TypeScript 稳定 façade 暴露的统一 control-engine runtime contract，分别提供 client、worker 和 server 入口。
- 将 capability 与结果 envelope 的 `executor`、`authoritySource` 作为必填运行身份；browser façade 只能产生非持久展示，Arena virtual preview 的校验、Rust 重算、checksum 和持久化写入必须经过 server façade。
- 将生成的 `index.js`、`index.d.ts`、`index_bg.wasm`（以及生成的声明文件）视为构建产物与 runtime identity 的一部分；业务模块不再直接导入生成模块。
- 统一 `ready`、`error`、`timeout`、`unavailable` 状态；WASM 未就绪或执行失败时暂停或受控不可用，禁止 TypeScript 物理、离散化或数值 heuristic fallback。
- 服务端拒收 `/api/arena/virtual-simulation-runs` 请求中的 client `trace`、`summary`、`checksum`；固定 surrogate 必须标记 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims=true`，identified model 只有在 Rust capability 实际消费经授权模型参数时才可声称。
- 在不一次性重写模型的前提下，为 Rust 内部按 analysis、controllers、simulation、constraints、metrics 形成可逐步迁移的模块边界，并保留现有公开结果语义。
- 明确 `useControlEngine` 的 `fallbackResult` 只是带来源标记的暂态展示值，不得被视为 current authoritative result、官方评价输入或 evidence-bearing run 结果。
- 增加 property、baseline、绝对/相对 tolerance 和 runtime identity 测试，覆盖生成 ABI、生命周期和跨运行时一致性。

## Capabilities

### New Capabilities

- `control-engine-wasm-facade`: 定义 control-engine 的稳定 façade、运行时生命周期、生成产物身份和无数值 fallback 边界。

### Modified Capabilities

None。`simulation-scene-trace-protocol`、`simulation-runtime-replayability`、`arena-analysis-whitebox-evaluation`、`control-workbench-contracts` 和 `fix-control-workbench-gain-margin-state` 的既有行为继续有效；本 change 只提供其可调用的 runtime contract。

## Impact

- **Owner**：Platform/Control Engine runtime；各业务域仍拥有自己的任务、评分和 evidence authority。
- **Routes/APIs**：本 change 不改公开路由；后续 consumer 迁移涉及 `/api/simulation/runs`、`/api/simulation/cruise-comfort-analysis`、`/api/simulation/icebreaker-robust-analysis` 和 Arena evaluation service，但本 change 只建立调用入口。
- **Raw business-loader denominator（9）**：前述八个 generic analysis/simulation/Control Odyssey/Arena loader，加上 `src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts`。实现前须在 captured Git tree 重新枚举并冻结九项；该 Unit 5-5 runtime 是业务 consumer，不得作为 facade/build adapter 例外。
- **Arena virtual preview persistence**：`/api/arena/virtual-simulation-runs` 的 artifact/task 校验、server recompute、trace/summary 生成、checksum 计算和 `ArenaVirtualSimulationRun`/canonical run 写入必须由 server façade authority 完成；browser façade 只能返回 `persisted=false` 的展示结果。
- **Rust/generated denominator**：`rust/control-engine/Cargo.toml`、`Cargo.lock`、`src/lib.rs`、`src/control_odyssey_runtime.rs`、`src/virtual_simulation_runtime.rs`、`src/destroyer_hifi.rs`、`src/destroyer_hifi_runtime.rs`、Rust tests，以及 `scripts/wasm/build-control-engine.mjs` 与其生成的 control-engine package。生成文件不得手工修改或删除。
- **Callers/tests**：generic analysis hooks and panels、simulation engine facade and scenes、Control Odyssey official runtime、Arena analysis provider，以及对应 `src/features/**/__tests__`、`src/resources/**/__tests__` 和 Rust integration tests；完整 caller 集以静态图和动态 import 扫描为准。
- **Dependencies**：硬前置为 `establish-modular-monolith-refactor-charter` 与 `enforce-modular-domain-dependency-contracts`；R3、R4、R5 依赖本 change 和 R2。tracking parent 不作为 blocker。
- 不新增 Prisma schema、评分规则、课程 manifest、榜单策略、生产部署或 GitHub/Issue 状态；不把本 façade 作为永久 compat facade。
