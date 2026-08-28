## Why

R1-R5 建立 façade、统一 run contract 并迁移 server、Arena preview 和 Practice live 后，仓库仍会保留九个 raw business loader、已迁移的 TypeScript numerical implementations 以及各种 alias/re-export/forwarder。若不以 caller、runtime 和 evidence 证明后删除，它们会继续成为第二套数值 authority；反过来，过早删除也会破坏历史 evidence、legacy persistence 或仍受保护的场景。

## What Changes

- 冻结并逐项审计四类分母：9 个 raw business loader、TS 数值实现清单、`SimulationSession`/`SimulationLog` legacy persistence、generated control-engine artifacts。
- 在 R3-R5 的 migration receipts 基础上，对已无 caller 的 raw loader、已被 Rust 替代的 TS numerical implementation、alias/re-export/forwarder 执行 evidence-gated retirement。
- 以 zero-caller、静态架构 guard、client/browser runtime、server runtime、Rust/WASM build、replay/evidence 和回滚 commit 证明删除安全；任一条件不满足则保持 blocked/compatibility-only，不删。
- 明确 `src/resources/simulations/destroyer-simulation.tsx`（旧单体、当前没有产品路由 caller）仍受历史 spec/test 保护，条件解除前不得删除。
- 将 `src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts` 纳入九项 raw business-loader 分母；其 direct generated import 必须在最终 zero direct business imports 断言中归零，不能被误归类为 facade/build adapter。
- 明确 `/api/arena/virtual-simulation-runs` 的 persistence validation、Rust recompute、checksum 和 preview write 只能来自 R1 server façade；browser façade 仅可 display，服务端拒收 client trace/summary/checksum。surrogate/identified model relation 也必须随 retirement receipt 验证。
- `SimulationSession`、`SimulationLog` 只做可退役性证明和影响审计，本 change 不顺手删除表、writer、历史 reader 或证据；需要另一个授权迁移。
- generated `index.js`、`index.d.ts`、`index_bg.wasm`、对应声明/hash 和 build-script 输入明确保留，作为 runtime identity，不得被当作 legacy artifact 删除。
- 退役后禁止永久 compat facade；任何临时 compatibility entry 必须绑定 owner、剩余 caller、删除条件、回滚和过期 revision。

## Capabilities

### New Capabilities

- `legacy-practice-numeric-retirement`: 定义 Practice/Simulation legacy 数值与 raw loader 的分母、退役门禁、保护清单和不可逆删除前的验证合同。

### Modified Capabilities

None。复用 `control-engine-wasm-facade`、`practice-lab-artifact-run-contract`、`server-control-engine-consumers`、`arena-preview-control-engine`、`practice-live-control-engine`、`simulation-runtime-replayability`、`simulation-arena-evidence-governance` 和 `resource-simulation-state-effect-safety`；本 change 只负责最终清理，不重定义其运行行为。

## Impact

- **Owner**：Platform/Refactor retirement 负责删除证据与 guard；Practice、Arena、Control Odyssey、Evidence/Data Governance 各自确认其 caller/history 保护条件。
- **Raw business-loader denominator（9）**：generic analysis hook/worker/server、simulation client/server、Control Odyssey client/server、Arena `control-analysis-service.ts`，以及 `src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts`。必须以 R1-R5 final graph 显示九项 zero active caller 后才可删除；generated imports 只能由 stable facade/build adapter 保留，Unit 5-5 runtime 不得作为例外。
- **TS numerical denominator**：`src/resources/simulations/physics/controllers/{azipod-course-keeper,dp-controller,dp-decoupling-controller,gain-scheduler,notch-filter,pid-controller,smith-predictor,thruster-allocation}.ts`；`physics/disturbances/{current-model,dredging-impact,fin-stabilizer,ice-breaking-model,sloshing-model,wind-load}.ts`；`physics/model-state-helpers.ts` 中仍属数值的 helper；以及 `interactive-learning/control-odyssey/engine/physics.ts`、lesson-13 `useChampagneTower.ts`、PID/interactive runtime 中被 R5 标记的 legacy numerics。最终列表由 R5 replacement matrix + static scan 冻结，状态适配和 UI 不自动列为可删。
- **Legacy persistence denominator**：Prisma `SimulationSession`、`SimulationLog` 及其 writer/reader/materializer/report/seed/test callers（包括 `src/app/actions/control-odyssey.ts`、mission/ethics/profile/admin/data-governance、`scripts/db`、historical evidence materialization）。本 change 只产生 audit/blocked receipt，不删除或改写。
- **Generated denominator**：`src/resources/control-system/wasm/control_engine/index.js`、`index.d.ts`、`index_bg.wasm`、`index_bg.wasm.d.ts`、`.build-hash`（若存在）以及 `scripts/wasm/build-control-engine.mjs`/Rust inputs。全部保留并继续由 build script 生成。
- **Routes/APIs/models/scripts/tests/callers**：standalone `/simulations/*`、`/api/simulation/*`、`/api/arena/*`（含 `/api/arena/virtual-simulation-runs` persistence path）、Control Odyssey actions/runtime；`SimulationTaskSpec`、`SimulationRun`、`SimulationTrace`、Arena models；WASM/build/replay/evidence/scene/route tests；完整 direct/reverse/dynamic caller graph 与 browser/server smoke 是退役分母。virtual preview 必须验证 server façade 派生 trace/summary/checksum 和 client-field rejection。
- **Dependencies**：R6 硬依赖 R3 `consolidate-server-control-engine-consumers`、R4 `migrate-arena-preview-numerics-to-control-engine`、R5 `migrate-live-practice-numerics-to-control-engine` 的合格 receipts，并间接依赖 R1/R2。tracking parent 不作 blocker。
- 不改变 Arena 评分/排行、DB schema/history、课程 manifest、plugin registry、生产部署、runtime selector 或生成 artifacts。
