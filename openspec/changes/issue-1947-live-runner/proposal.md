# Proposal: issue-1947-live-runner

## Why

PR #1866（C28 provider runtime 收敛）删除 `src/lib/ai-client.ts` 时漏改了 `scripts/konling-fair-experiment/run-live.ts`，live runner 在干净 `integration` 检出上加载即抛 `Cannot find module '@/lib/ai-client'`，正式公平实验被迫在 dirty 工作树中临时修补，破坏"一条命令可运行"与生成修订可复现（无 `-dirty`）的既有验收条件。typegraph production graph 显式排除 `scripts`、vitest 只收 `src/**/__tests__`，该入口漂移在任何提交门禁中都不可见。

## What Changes

- 修复 `run-live.ts` 导入：`@/lib/ai-client` → `@/lib/ai/provider-runtime`（三个函数同名同签名，行为等价迁移）。
- 新增 `tsconfig.konling-scripts.json` 只圈 `scripts/konling-fair-experiment/**` 与 `scripts/konling-blind-audit/**`，以 `tsc --noEmit` 作为 `typecheck:konling-scripts` 命令挂进 `verify:commit` 与 `verify:push`，让入口漂移在提交门禁被发现。
- 新增 vitest 冒烟测试 `konling-fair-experiment-entrypoints-smoke-1947.test.ts`：子进程 tsx 真实加载三入口——fixture runner 全量确定性运行（不联网、约 3 秒）、live runner 无 opt-in 环境变量时守卫退出（同时证明 provider runtime 模块图可加载）、replay-scoring 对 fixture 产物做真实回放；并断言 manifest 记录生成与评分器修订字段。
- 不改变三臂组装、断点续跑、超时记录、fail-closed 汇总与回放语义。

## Capabilities

### New Capabilities

- `konling-fair-experiment-entrypoint-smoke`: 公平实验 CLI 入口（fixture/live/replay）在干净检出上可加载、可在不调用真实供应商的前提下被冒烟验证，且入口导入漂移被提交门禁拦截。

### Modified Capabilities

（无——`konling-fair-baseline-replay-evaluation` 的五个 requirement 行为不变，本变更不触碰其实验语义。）

## Impact

- `scripts/konling-fair-experiment/run-live.ts`：导入路径一行修复。
- `tsconfig.konling-scripts.json`（新增）、`package.json`（`typecheck:konling-scripts` 命令 + verify:commit/verify:push 追加）。
- `src/lib/__tests__/konling-fair-experiment-entrypoints-smoke-1947.test.ts`（新增，vitest，子进程隔离，产物写临时目录）。
- 不影响生产应用代码、数据库、产品回答路径与模型行为。
