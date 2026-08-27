## Context

#1554 已经落地本地质量门禁 registry（`scripts/quality-gates/*`）以及错误的 GitHub 托管 CI：`.github/workflows/quality-gates.yml` 在 `pull_request`/`push` 到 `integration` 和 nightly cron 上运行分层 jobs，`ci.yml` 增加了 `release/**` 与 `main-release-quality-gates`。仓库既有约定是：面向 `integration` 的 PR 不自动跑 GitHub Actions，以节省额度；`ci.yml` 只在 `main` push 与 `workflow_dispatch` 上跑 lint/test/build；`docker-wolfram-verify.yml` 是专项手动验证。

本 change 纠正生产者边界：registry 继续规定“合入需要哪些可审计证据”，但这些证据由本地命令和 exact-current-HEAD 审查生成，不得要求 GitHub 托管 CI 产出。

## Goals / Non-Goals

**Goals:**

- 删除 #1554 新增的 GitHub PR/integration/nightly 通用质量 CI，并恢复 `ci.yml` 既有 main 基线。
- 把四层门禁改成本地证据层：PR/integration/nightly 的 layer event 为 `local`；main/release 证据也由单独授权的本地验证产生，而不是新的 GitHub job。
- Fail-closed 防止再次引入 `quality-gates.yml`、`pull_request` 通用质量触发器、`integration` push CI、`release/**` 触发器或 GitHub required quality status check。
- 修订已归档 #1554 提案与主 spec，使后续实现不再按 GitHub PR CI 解读。

**Non-Goals:**

- 不把完整 PR/integration/nightly 矩阵塞进 `verify:commit` / `verify:push`。
- 不修复 fitness、tools/test graph、release manifest 等既有诚实 blocker。
- 不把 Wolfram 专项 workflow 改成通用门禁，也不授权新的发布 GitHub CI。
- 不部署、不改生产选择器、不 claim 已关闭的 #1554。

## Decisions

### 1. 证据层保留，GitHub 生产者删除

四层 check registry、impact fallback、receipt schema 和 main/release 强门禁保留。删除的是 GitHub 托管执行面。本地 `npm run quality-gates:validate` / `quality-gates:run` 仍可按层生成 receipt，供审查复现，但不是 GitHub required check。

相对方案：连 registry 一起删。否决原因：用户明确允许 #1554 治理“合入需要哪些证据”，只禁止把证据来源绑定到 GitHub CI。

### 2. GitHub Actions 白名单

允许保留：

- `.github/workflows/ci.yml`：`push` 到 `main` + `workflow_dispatch`；jobs 仅既有 `model-assets` 与 `quality`。
- `.github/workflows/docker-wolfram-verify.yml`：专项 `workflow_dispatch`。

禁止：

- 任何通用质量 workflow 的 `pull_request` 触发器。
- `push` 到 `integration` 的通用质量 workflow。
- nightly `schedule` 通用质量 workflow。
- `ci.yml` 的 `release/**` 触发器和 `main-release-quality-gates` job。
- 将 registry `checkId` 配置为 GitHub required status check。

相对方案：把分层 jobs 改成 `workflow_dispatch` 保留文件。否决原因：用户要求删除 CI 流程，且该文件的存在会继续把质量门禁理解成 GitHub CI。

### 3. 合入证据仍是本地 hook + 相关测试 + HEAD 审查

提交/推送继续使用现有 `verify:commit` / `verify:push`（typecheck 与既有 portrait/resource 门禁）。PR 层 registry 描述合入还应具备的相关测试与 fitness/graph receipts；它们由实现者在本地按影响面运行，并由 exact-current-HEAD 审查核对，而不是 GitHub check run。

### 4. Integration protection 不再等于 GitHub required CI

protection receipt 不再要求 GitHub required check 集合等于 integration layer check IDs。验证目标改为：通用质量门禁没有 GitHub required CI；workflow 文件未重新引入 PR/integration CI。GitHub 审查/对话门禁可以继续存在，但不是本 capability 的 CI 替代品。

### 5. Layer event 改为 `local`

registry 的 `QUALITY_EVENTS` 去掉 `pull_request`。四层均声明 `local`。workflow 文本校验只检查允许保留的 GitHub 文件，并对缺失的 `quality-gates.yml` 作正面断言（文件必须不存在）。

## Risks / Trade-offs

- [Risk] 删除 GitHub PR CI 后，有人把“没有红 check”当成质量已过。→ 文档和 spec 明确合入证据是本地命令与 exact-current-HEAD 审查；buddy-auto 继续按空/无关 CI 处理 integration PR。
- [Risk] 后续 change 再次添加 `pull_request` CI。→ `validateGitHubHostedCiBoundary` fail-closed，相关单测锁定缺文件与 `ci.yml` 形状。
- [Risk] 本地 registry 仍列出完整 integration/nightly 矩阵，可能被误当成每次 commit 必须跑完。→ 明确 Git hook 范围不变；完整层只在对应合入/发布/夜间验证时按需本地执行。

## Migration Plan

1. 修订归档提案与本 change 的 spec delta，先固定正确边界。
2. 删除 `quality-gates.yml`，恢复 `ci.yml`。
3. 更新 registry/event/protection/workflow 校验与测试。
4. 重生 registry 投影、文档、handoff 和 governance ledger。
5. 运行相关 Vitest、`quality-gates:validate`、strict OpenSpec 校验。

回滚：若需恢复 GitHub PR CI，必须另开明确授权的 capability change；本 change 的边界禁止把它当作 bugfix 加回。

## Open Questions

无。GitHub 额度策略与 integration PR 不自动跑 CI 已由提案代理与用户确认。
