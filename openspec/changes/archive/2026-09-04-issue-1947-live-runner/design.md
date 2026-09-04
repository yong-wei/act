# Design: issue-1947-live-runner

## Context

`scripts/konling-fair-experiment/run-live.ts:20` 仍从已删除的 `@/lib/ai-client` 导入 `getConfiguredAIModel` / `getConfiguredAIProviderBinding` / `isConfiguredAIServiceAvailable`。PR #1866 把这些函数等价迁移到 `src/lib/ai/provider-runtime.ts`（同名同签名），但漏改了该脚本。三个入口的顶层结构均为「顶层 `main()` + 守卫」：run-live 在无 `KONLING_FAIR_EXPERIMENT_LIVE=1` 时守卫退出，replay-scoring 在无 `--run-id` 时守卫退出，run-fixture 无守卫、直接全量运行（确定性 provider，6 条目 × 2 replicates × 3 臂，实测约 3 秒）。

现有门禁的盲区：`tsconfig.json` 排除 `scripts`，production type graph 因此不可见；`tsconfig.tools.json` 虽覆盖 scripts 且当前能报出该 TS2307，但其范围已有 171 个无关既有错误（course-coverage、data-governance 等），不可能整体作为绿色门禁；vitest 只收 `src/**/__tests__/`。konling 脚本树在 tools graph 下当前仅此一处错误，本身是干净的。

## Goals / Non-Goals

**Goals:**

- live runner 引用受支持的 provider runtime 公共入口，干净检出可加载。
- 入口导入漂移在 `verify:commit` / `verify:push` 被发现。
- 三入口有不调用真实供应商的运行时冒烟证据；fixture 与 replay 走真实执行路径。
- manifest 记录生成修订与评分器修订字段（干净树上无 `-dirty` 后缀，该后缀是 git 状态的正确反映，不写额外逻辑）。

**Non-Goals:**

- 不清理 tools graph 的 171 个既有错误，不把 tools graph 挂入门禁。
- 不改变三臂组装、断点续跑、超时记录、fail-closed 汇总、回放语义与产品回答路径。
- 不改变模型、题库、评分标准。
- 不给 run-fixture 增加新的 CLI 守卫或启动结构改造。

## Decisions

- **导入修复**：一行等价迁移到 `@/lib/ai/provider-runtime`。三个函数同名同签名，无调用点变化。
- **门禁形态：独立小 tsconfig 而非修复 tools graph**。新增 `tsconfig.konling-scripts.json`（extends `tsconfig.base.json`，include 仅 `scripts/konling-fair-experiment/**` 与 `scripts/konling-blind-audit/**`，排除 fixtures/tests），命令 `tsc --noEmit -p tsconfig.konling-scripts.json` 秒级完成，绿色可挂门禁。不注册进 `typescript-graphs/contracts.ts` 的 GRAPH_DEFINITIONS——该校验体系面向 production/tooling/test 四图，新增 graph 定义需 fixture 与 include/exclude 合同，超出本变更需要。仓库对新增独立 tsconfig 无枚举校验。
- **冒烟形态：子进程 tsx 而非 vitest 内 import**。入口顶层执行 `main()`，vitest 内动态 import 会把副作用（exitCode、artifacts 写入）带进测试进程；子进程隔离并把 `cwd` 设为临时目录（`root: process.cwd()` 使产物落在 tmpdir，afterAll 清理）。run-fixture 与 replay-scoring 的模块导入面完全相同（`@/lib/konling-fair-experiment`、`@/lib/konling-study-question-structure`、`../konling-blind-audit/cli`），replay 的真实回放等价覆盖 fixture 的加载面，且两者都走真实执行路径。run-live 用守卫退出路径——能打印 opt-in 提示即证明含 provider-runtime 的完整模块图加载成功，这正是对本次修复的运行时验证。
- **`-dirty` 不写断言逻辑**：`gitRevision()` 在 tmpdir 下 `git` 失败返回 `'unknown'`，冒烟只断言 manifest 的 `gitRevision` / `scorerRevision` 字段非空存在；"干净树无 `-dirty`"由导入修复本身达成（不再需要 dirty 补丁才能跑）。

## Risks / Trade-offs

- `verify:commit` 增加一条 tsc 命令（预计 <5 秒），换取 scripts 漂移可见性；接受。
- 子进程冒烟依赖 `tsx` 与 shim 相对路径，用绝对路径拼接规避 cwd 差异；vitest `testTimeout` 默认 30 秒，实测总耗时约 8 秒内，必要时单测调大 timeout。
- konling-scripts 门禁范围刻意窄：只护 fair-experiment 与 blind-audit 脚本树；未来其他实验脚本漂移仍不可见，属于显式非目标，需要时以同模式扩展 include。
