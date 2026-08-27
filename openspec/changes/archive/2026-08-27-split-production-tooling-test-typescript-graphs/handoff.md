# Handoff: TypeScript graph split

## Source identity

本实现从 #1550 squash 后的 `1afde1203e2e48b2f1206b187db0439097912656` 开始。该 revision 的 `HEAD^{tree}` 由 graph runner 在每次执行时读取；当前实现阶段工作区包含本 change 的未提交修改，因此本地 receipt 的 `dirty` 必须被下游 qualification 拒绝，不能当作 release evidence。

硬前置 identity 已记录为：`capture-modular-monolith-refactor-baseline` 的
source commit/tree 为 `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac` /
`189dfeb5ad35f1d88e8ea5509a48b388424bf88f`；
`restore-trustworthy-test-command-contracts` 的 source commit/tree 为
`49117482cdda904ac0fde0ba33c93c82fe45d48d` /
`2614e8ae6eb6c84f08f156d8f90f69c5a105a4f3`。本 change 没有改写这两个
历史工件。

本次 characterization 确认：旧根配置以仓库级 TypeScript glob 为唯一
Program；Next 兼容入口是 `next-env.d.ts` 与 `.next/types`；正式 worker
入口位于 `scripts/workers/` 及 submission scan/gc；tooling/test 入口由
scripts、Vitest、Playwright 和 package scripts 分担。新图的 source root 与
边界检查据此声明，未把旧根 glob 搬到任何子图。

## 已交付合同

- `tsconfig.base.json` 只保存共享 compiler policy；`tsconfig.json` 不再含仓库级生产 glob。
- `tsconfig.web.json`、`tsconfig.worker.json`、`tsconfig.tools.json`、`tsconfig.test.json` 分别声明四张独立 graph。
- `npm run typecheck` 是 web+worker aggregate；四张 graph 均有具名命令。
- `scripts/typescript-graphs/contracts.ts` 负责 config、entrypoint、边界、shared owner、manifest 和 receipt contract；`run.ts` 负责 tsc 执行、cold/warm measurement 与不可变工件写入。
- `typescript-graph-fixtures/` 提供唯一 owner、声明消费者和四张 tsc-only probe。
- 契约测试覆盖 production 到 tooling/test、重复 owner、无 owner、cycle、未知入口、错误 exclude、strictness downgrade、deterministic manifest 与 mandatory tools/test receipts。

四个共享合同 fixture 的职责是：`web.ts` 编译 source owner，`worker.ts`、
`tools.ts`、`test.ts` 只导入稳定 declaration boundary；重复 owner、无 owner
和环依赖作为契约测试的负例输入，不复制进 graph include。

## 当前验证状态

本轮验证在当前 dirty worktree、Node `v26.0.0`、TypeScript `5.8.3` 下完成。
`tsconfig.base.json` 保持 `skipLibCheck: true`；它不再被 graph contract 视为
compiler-policy downgrade。runner 通过独立 marker 读取 tsc 的真实退出码，
不会把 Darwin `/usr/bin/time -l` 的 `sysctl ... Operation not permitted`
测量错误误报为编译失败。

生产图的 tsc 结果与边界结果分开记录：

| command | process | receipt result | evidence |
| --- | --- | --- | --- |
| `npm run typecheck` | exit 0 | web `status=blocked`, worker `status=passed` | web `tscErrorCount=0`, boundaryFailureCount=12；receipt `18ae957152a2c0e54148c974cada3afda0068eb11b72074793254e3b5d069eb1`；worker `tscErrorCount=0`, receipt `e2cf6d47a84db5a2f3041654d14d7a3c5c27858dd3f146f127da9c4342f959b4` |
| `npm run typecheck:web` | exit 0 | blocked receipt | `tscErrorCount=0`；12 条既有 `web-includes-tooling` / `production-to-tooling` 边仍进入 receipt，不使 verify:commit 失败 |
| `npm run typecheck:worker` | exit 0 | passed receipt | `tscErrorCount=0`；receipt `28ac622d965097be717bedf0be9bf9d0122511d927b3af39a7711926af063101` |

Web 的 12 条边界记录集中在 `scripts/actkg-release/` 及其现有引用，属于
后续迁移的历史 production-to-tooling blocker；它们仍由 receipt 和契约测试
保留，不能被退出码语义解读为 production tsc 错误。Worker 的 scheduler 与
submission GC 类型已对齐当前依赖/API，因而其 tsc 图为绿。

独立 tooling/test 图仍未 qualify：

- `npm run typecheck:tools` exit 1，receipt
  `bc377c4cad5abe6eda04c3f00dae716af33cd14e763feeb585272e81b850d8d6` 为
  `status=blocked`、`tscErrorCount=105`；这些是既有 scripts 类型债，不得用
  扩大 include、降低 strictness、改变 `skipLibCheck` 或 heap 参数消除。
- 默认 `npm run typecheck:test` exit 1，receipt
  `9d510c52efd71f1f62440b1131d96856b3fa471d9b3833932a5795c2bbd0c512` 为
  `status=blocked`、`exitStatus=134`，原因是 Node 默认 heap OOM；这不是
  production pass。临时 `NODE_OPTIONS=--max-old-space-size=8192` 仅用于
  观测时，test 图捕获 `tscErrorCount=376`，receipt
  `396364fc8f6a33b4786ce3d60bc29459b1794ec05bf26c05638c5a09bbb8e98c`；该
  heap 配置不是结构修复，也不构成 release evidence。

四张 tsc-only fixture 均能被对应 graph 诊断：web probe receipt
`df5a873585a83e627c72b35cd3b0445b0ce3acd5edf196d2324c0b5d08019dc6`、worker
`5d87b78a6ca0f893632ae510bebc26578d6fb42edaebaafef963c6a01f2f2e11`、tools
`ed0d6fda0fbe2d3191c7e2c0f05db62b78c2ae9c83da9d487df63b68cbb34367`、test
`0a451a5898a1d2859988c4c9931ec6bd978a36bf685a8ba92fc68eeb1248a1f8`。这些
probe 按预期以非零 tsc 退出；test probe 使用临时 8 GiB 环境仅为确认夹具
诊断，不改变默认命令或质量门禁。

所有 receipt 均来自 source tree
`8e8d69bc2e68e5f51529e85153ca837d05632036` 且 `dirty=true`，只能作为本地
验证记录，不能作为 clean release evidence。Darwin 测量仍为
`peakRssBytes: null`，这是 sandbox 限制，不是预算结论。

## 交接给后续 Issue

### #1553 — architecture fitness budgets

读取每张 graph 的 clean、revision-bound manifest 和 cold/warm receipt，另行决定 duration/RSS/file-count 的趋势和阈值。不要把本 change 的单机 receipt 写成永久常量，也不要用当前 dirty 或 blocker receipt 设定 production budget。

### #1554 — PR/integration quality gates

将 `typecheck:web`、`typecheck:worker` 作为 production aggregate，将 `typecheck:tools`、`typecheck:test` 作为 PR/integration mandatory inputs。main/release 消费前必须校验四图 source identity、manifest hash、`dirty=false`、`status=passed` 和 `exitStatus=0`；缺失、stale 或 failed 的 tools/test receipt 必须 fail closed。nightly 不得补替这两个输入。

当前 `npm run typecheck` 的进程退出码只反映 tsc 结果，以便保持仓库零 TypeScript 错误基线。Web graph 仍有历史 production-to-tooling 边，receipt `status=blocked`。#1554 必须按 receipt 状态门禁，不能只看 typecheck exit 0。真实共享合同的唯一 owner / project-reference 收敛由 #1553 fitness 继续收缩，本 change 用 fixture 证明合同。

后续迁移应逐条处理 production-to-tooling 边和未决入口，并以 owner registry/声明输出维持共享合同的单一编译权威；不要在本 change 中改变生产选择器、运行时行为或发布状态。
