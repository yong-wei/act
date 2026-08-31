## Why

#1554 把“PR 质量门禁”错误等同成了“GitHub Actions PR CI”，并新增了面向 `integration` 的 `pull_request` / `push` / nightly workflow 以及 `ci.yml` 的 `release/**` 与 `main-release-quality-gates` job。这违反本项目明确约定：面向 `integration` 的 PR 不自动运行 GitHub Actions，以避免消耗额度。合入证据必须继续由本地 `verify:commit`、`verify:push`、typecheck、相关测试和 exact-current-HEAD 审查承担；GitHub Actions 只保留现有 `main` push、明确授权的 `workflow_dispatch`，以及后续单独授权的发布验证。

## What Changes

- **BREAKING（相对 #1554 已落地的 GitHub CI）**：删除 `.github/workflows/quality-gates.yml`；禁止为 `integration` PR 或 `integration` push 增加通用质量门禁的 `pull_request` / `push` 触发器；不把 registry check 映射为 GitHub required status check。
- 把 `ci.yml` 恢复为既有 `main` push + `workflow_dispatch`；删除 `release/**` 触发器和 `main-release-quality-gates` job。不改 `docker-wolfram-verify.yml` 这项专项 `workflow_dispatch` 验证。
- 修订 `enforce-pr-integration-quality-gates`：四层门禁仍定义“合入/发布需要哪些可审计证据”，但证据生产者是本地命令与 exact-current-HEAD 审查，而不是 GitHub 托管 CI。
- 保留本地 `scripts/quality-gates/*` registry、impact fallback、receipt 和 package scripts；把 layer event 改为 `local`，并增加 fail-closed 校验：不得重新引入 PR CI workflow 或 GitHub required quality checks。
- 在已归档的 #1554 提案上加纠正说明，避免后续实现继续按 GitHub PR CI 解读。

## Capabilities

### New Capabilities

None. This change corrects the existing quality-gate capability rather than adding a second control plane.

### Modified Capabilities

- `enforce-pr-integration-quality-gates`: 质量层改为本地证据注册表；`integration` PR 不得增加 GitHub `pull_request` 触发器或 required CI status check；提交/推送门禁继续由本地 `verify:commit` / `verify:push` / typecheck / 相关测试 / exact-current-HEAD 审查承担；GitHub Actions 只保留现有 `main` push、明确授权的 `workflow_dispatch`，以及后续单独授权的发布验证。

## Impact

- 删除 `.github/workflows/quality-gates.yml`，恢复 `.github/workflows/ci.yml` 的既有 main 基线。
- 更新 `scripts/quality-gates/*`、对应 Vitest、生成 registry 投影、质量门禁文档、governance ledger、integration protection receipt 语义，以及归档提案纠正说明。
- 不修改 `verify:commit` / `verify:push` 现有命令组成，不把完整 PR/integration 层塞进 Git hook。
- 不创建 Issue、不 claim、不部署、不修改生产选择器；不把 Wolfram 专项 workflow 升格为通用质量门禁。
