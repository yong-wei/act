## Context

R1-R5 的目标是把数值执行收敛到 Rust/WASM façade，但迁移完成不等于可以删除所有旧文件。仓库中九个 raw business loader 负责不同运行时初始化，其中包括 Unit 5-5 policy-learning 的 `rl-training-runtime.ts`；R5 迁移前的 TS controller/disturbance/model helper 既包含真实数值，也包含 state adapter/UI 依赖；`SimulationSession` 与 `SimulationLog` 仍被历史 evidence、Control Odyssey lease、admin/profile/report 和 seed/test 使用；generated control-engine package 则是必须保留的 runtime identity。

`src/resources/simulations/destroyer-simulation.tsx` 是旧单体路径，当前没有产品路由 caller，但历史 scene protection tests/spec 仍读取它。它不能因为 zero product caller 就被当作可删。实际路由使用的是 `src/resources/simulations/simulations/destroyer-simulation.tsx`，二者必须在 inventory 中分开。

### Owner and four frozen denominators

| denominator | owner | protected treatment |
| --- | --- | --- |
| 9 raw business loaders | Platform/Control Engine | R1-R5 graph proof + stable facade replacement；only zero-caller entries eligible |
| TS numerical list | Practice Lab/Control Engine | R5 capability/tolerance/replay receipt per function; state/UI helpers remain unless separately proven |
| `SimulationSession`/`SimulationLog` | Learning Record/Data Governance + Control Odyssey | full reader/writer/history audit; no deletion in this change |
| generated artifacts | Platform/Delivery | mandatory build outputs and runtime identity; explicitly non-deletable |

### Route/API/model/script/test/caller denominator

The captured source revision is `a3e6ce7435503050146cadeae6359d6b8eb9a2a5`; implementation must verify clean tree and re-enumerate. The route/API set includes standalone `/simulations/*`, `/api/simulation/runs`, cruise/icebreaker analysis routes, `/api/arena/virtual-simulation-runs`, `/api/arena/evaluate`, `/api/arena/submissions`, and Control Odyssey server actions/runtime. Model set includes `SimulationTaskSpec`, `SimulationRun`, `SimulationTrace`, `SimulationSession`, `SimulationLog`, `ArenaControllerArtifact`, `ArenaEvaluationRun`, `ArenaSubmission`, `ArenaVirtualSimulationRun`, `ArenaBlackBoxExperiment`, and `ArenaIdentificationModel`. Script/test set includes WASM build, db materializers/reports/seeds, Rust/WASM/runtime/replay/evidence/scene/route tests. Caller set is the complete static import, dynamic import, route registry, worker, server action, script and browser graph; test-only readers and historical protection are separate classifications.

## Goals / Non-Goals

**Goals:**

- 用 revision-bound inventory 和 R3-R5 receipts 决定哪些 raw loader/TS numeric entry 确实可以删除。
- 证明删除后 client/browser/server/Rust/WASM/runtime/replay/evidence 行为不回退，且无第二套 numerical authority。
- 保留 legacy persistence、历史 evidence、protected destroyer monolith 和 generated artifacts，直到各自独立条件满足。
- 删除临时 aliases/forwarders 时同步更新 architecture guards、registry、tests、docs 和 rollback receipt；不留下永久 compat facade。

**Non-Goals:**

- 不在本 change 删除 `SimulationSession`、`SimulationLog`、历史 evidence、`SimulationLog` materializer、generated JS/types/WASM 或受保护的 destroyer monolith。
- 不改变 runtime model、Arena official scoring、leaderboard、manifest/plugin registry、Prisma schema、production deployment 或 selectors。
- 不为了达到 zero-caller 删除测试保护、历史 reader、debug/audit consumer 或未完成的 R3-R5 capability。

## Decisions

### 1. 四类分母分别判定，不能用一个 zero count 覆盖

每条候选记录包含 `category`、source revision/tree、current owner、replacement identity、all callers（含 dynamic/test/history）、runtime surface、delete condition、rollback commit 和 verification receipts。raw business loader 与 TS numerical 的 zero-caller 只在 active production/browser/server graph 上成立，同时必须检查动态 import、worker URL、route registry 和 build output；`rl-training-runtime.ts` 属于业务 caller，不能被 facade/build adapter 例外吞掉；legacy persistence 和 generated artifacts 即使无业务 caller 也不会自动进入删除集合。

### 2. 退役状态是单向但可回滚的证据门

候选状态依次为 `observed` → `replaced` → `zero-caller-proven` → `runtime-verified` → `deleted`。缺失任何上游 receipt、caller ambiguity、历史保护命中、browser/server failure、checksum drift 或 rollback artifact 时保持 `blocked`。删除 commit 必须可单独回滚；回滚恢复旧文件只能作为紧急工程动作，不能恢复旧 numerical authority 与新 façade 同时 active。

### 3. Raw loader 删除必须先证明 facade-only imports

最终静态 guard 要求生成 package 的 import 只存在于 stable facade/build adapter；九个 raw business-loader path（含 `rl-training-runtime.ts`）、旧 `initSync`/dynamic import 和 direct `compute_*` caller 全部为零，除非某一项被明确记录为 compatibility-only 且有期限。动态 worker URL、Next server bundling 和 Rust/WASM generated exports 也要验证。永久 re-export/forwarder 不合格；短期 compatibility entry 必须在同一 change 内有 owner、expiry 和 deletion issue/condition。

### 4. TS numeric 删除以替代矩阵和性质证明为准

R5 为每个 PID、Smith、DP、thruster、notch、gain schedule、wind/current、ice、slosh、RK4 和相关 helper 提供 Rust capability、baseline、abs/rel tolerance、seed/replay 和 browser/server receipt。R6 只能删除 active numeric function；state creation、unit conversion、telemetry mapping、chart formatting 如果仍被 facade caller 使用则保留，并从 deletion denominator 排除。任何不支持的 capability 继续 unavailable，不删除后暗中恢复 TS fallback。

### 5. Legacy persistence 与 generated artifacts 是显式保护对象

`SimulationSession`/`SimulationLog` 的 writers、readers、historical materialization、admin/profile/ethics/Control Odyssey leases 和 tests 必须做 full impact audit；本 change 只能记录未来独立 migration 的条件，如 replacement read model、historical replay proof、retention approval 和 rollback. Generated JS/types/WASM/.d.ts/hash 继续由 build script 产生并纳入 runtime identity，不能以“已迁移”删除。

### 6. Destroyer legacy monolith 保留直到历史保护解除

对 `src/resources/simulations/destroyer-simulation.tsx` 即使 product route caller 为零，仍保留现有 historical scene tests/spec and review protection。只有另一个明确授权 change 解除保护、完成静态/浏览器/回滚证明后才可重新评估；本 change 的删除清单将其标为 `protected-not-delete`。

## Hard / Contract / Soft / Delete boundaries

| class | boundary | rule |
| --- | --- | --- |
| hard | no direct generated imports, no TS numeric authority after replacement, no hidden/official boundary regression, legacy/history/generated protection | failing proof blocks deletion; keep old entry or mark unavailable |
| contract | retirement state, caller denominator, replacement hash, runtime/browser/server receipts, rollback commit | deterministic ledger and static/runtime guards |
| soft | comments, labels, non-authoritative diagnostics, cleanup ordering | may change only after hard proof |
| delete | nine raw business loaders, migrated TS numeric implementations, duplicate aliases/forwarders | delete only after zero-caller + runtime verification + rollback; no permanent compat facade |
| protected | `SimulationSession`/`SimulationLog`, historical evidence/readers, generated artifacts, old destroyer monolith | explicit retain; not counted as failed migration, but no false completion claim |

## Vertical retirement and no-facade proof

The first deletion slice is one server raw loader already replaced by R3, chosen from the generic analysis/server path after its route and browser-independent tests pass. Then retire the corresponding duplicate client/worker loader only after R4/R5 caller graphs prove no active import. TS numeric deletion proceeds by model family from the R5 matrix, not by filename glob.

No-facade proof is a final report with: zero active direct generated-module imports outside stable facade/build adapter, including the Unit 5-5 RL training business loader; zero active old TS stepper/calculator callers; no duplicate `initSync`/loader; no unknown dynamic import; no `SimulationSession`/`SimulationLog` deletion; generated artifact presence and hash; `destroyer-simulation.tsx` protection; browser runtime and server runtime smoke; `/api/arena/virtual-simulation-runs` server-facade validation/recompute/checksum/write and client-field rejection; preview `executor`/`authoritySource` and truthful surrogate/identified-model claims; replay/evidence/official-boundary checks; and a tested rollback commit. A single remaining production/test/history caller is classified, not hidden by deleting the file.

## Migration Plan

1. Verify R3-R5 qualified identities, clean source revision, generated package and four denominator inventories.
2. Build a retirement ledger separating raw loaders, TS numeric entries, aliases/forwarders, legacy persistence, protected destroyer, and generated artifacts.
3. Choose one R3 server loader as the first deletion slice; prove facade-only import, server readiness/error, route behavior, and rollback. Keep `/api/arena/virtual-simulation-runs` writes behind the server facade and validate client-field rejection before deleting its raw path.
4. Retire remaining raw loaders and R5-migrated TS numerics in small model-family commits; after each commit run affected caller graph and focused runtime tests.
5. Re-run browser/client/worker/server/Rust/WASM/replay/evidence/official boundary verification, then update static architecture guards and ledger.
6. Report legacy persistence and protected/generated entries as intentionally retained with conditions for future work; do not claim all legacy surface is gone.

Rollback restores the last deletion commit and its ledger/guards while keeping historical evidence and generated package unchanged. If a runtime/browser/server check fails, revert the deletion and mark the candidate blocked; never restore a TS numerical fallback alongside the façade merely to make a smoke pass.

## Open Questions

无。具体删除顺序可以按 R3-R5 receipts 和 caller graph 决定；任何未解决的 dynamic caller、历史保护或 capability gap 都必须阻止删除并留在台账中。
