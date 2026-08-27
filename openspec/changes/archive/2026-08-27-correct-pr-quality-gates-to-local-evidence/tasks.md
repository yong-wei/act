## 1. Revise the #1554 proposal boundary

- [x] 1.1 在归档提案 `openspec/changes/archive/2026-08-27-enforce-pr-integration-quality-gates/proposal.md` 顶部加入纠正说明：PR 质量门禁不是 GitHub Actions PR CI。
- [x] 1.2 核对本 change 的 proposal/design/spec delta 已把合入证据定义为本地 `verify:commit` / `verify:push` / typecheck / 相关测试 / exact-current-HEAD 审查。

## 2. Delete hosted PR/integration CI

- [x] 2.1 删除 `.github/workflows/quality-gates.yml`。
- [x] 2.2 将 `.github/workflows/ci.yml` 恢复为 `main` push + `workflow_dispatch`，去掉 `release/**` 与 `main-release-quality-gates`。
- [x] 2.3 保留 `.github/workflows/docker-wolfram-verify.yml` 为专项 `workflow_dispatch`，不把它升格为通用质量门禁。

## 3. Keep local evidence registry without GitHub required checks

- [x] 3.1 将 layer event 改为 `local`，去掉 `pull_request` 作为质量层触发器。
- [x] 3.2 增加 GitHub-hosted CI 边界校验：`quality-gates.yml` 必须缺席；`ci.yml` 不得含 `pull_request`、`integration` push、`release/**` 或 `quality-gates:run`。
- [x] 3.3 将 integration protection 从“required GitHub checks 必须等于 registry”改为“不得把 registry check 配成 GitHub required CI status check”。
- [x] 3.4 更新 Vitest，覆盖删除 CI、禁止再引入 PR CI、以及本地命令映射仍然成立。

## 4. Refresh generated projections and docs

- [x] 4.1 重生 `docs/architecture/quality-gates/registry.json`。
- [x] 4.2 更新 `docs/architecture/quality-gates.md`、handoff 与 governance ledger，去掉“由 GitHub CI 执行分层门禁 / required check 保护 integration”的表述。

## 5. Verify

- [x] 5.1 运行 `src/lib/__tests__/pr-integration-quality-gates.test.ts` 与 `npm run quality-gates:validate`。
- [x] 5.2 运行 `rtk openspec validate correct-pr-quality-gates-to-local-evidence --type change --strict` 和 `git diff --check`。
