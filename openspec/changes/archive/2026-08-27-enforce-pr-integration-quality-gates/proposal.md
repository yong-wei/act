## Why

当前 `.github/workflows/ci.yml` 主要在 `main` push 和手动触发，PR 与 `integration` 没有一套覆盖命令、required check、分支保护和 release qualification 的分层合同。即使本地命令恢复可信，仍可能出现 workflow 通过但没有运行完整范围、integration 可绕过、main/release 门禁被降低的情况。阶段 1 最后需要把测试、TypeScript graph、fitness budget 和发布资格组合成可验证的质量控制面。

## What Changes

- 定义 PR、integration push、main/release 和 nightly 四层门禁及其最小充分 scope。
- 为每个 required check 绑定一个明确的本地命令/command ID、输入、receipt 和失败语义；受影响域发现不完整时 fail closed，不静默少跑。
- PR 覆盖架构 fitness、受影响 lint、production/tooling/test typecheck、受影响领域单元、契约、Prisma/migration 检查和必要关键 E2E。
- integration push 覆盖全量 unit/contract/integration、production/tooling/test typecheck、Next build、WASM build、migration rehearsal 和关键 E2E；main/release 保留并增强 release qualification、runtime/knowledge/OSS、rollback、readyz 和 DB compatibility 强门禁。
- main/release 只有在 `typecheck:tools` 与 `typecheck:test` 的当前通过 receipts 均存在时才能发布；nightly 承载隔离测试、视觉/性能、真实 provider、课程矩阵、数据治理回放和大规模 Arena/仿真样本，但不承担补漏。
- 定义可核验的 integration GitHub ruleset/branch protection 证据；当前 REST 403、计划限制或无法读取配置只能生成明确 blocker receipt，不能声称已保护，也不能降低 main/release 门禁。

## Capabilities

### New Capabilities

- `enforce-pr-integration-quality-gates`: 定义 CI 分层、required-check/local-command 一一映射、integration protection 证据和 main/release 强门禁。

### Modified Capabilities

None. This change composes the trustworthy test, red-baseline, TypeScript graph, fitness-budget, existing release, and deployment contracts without replacing their authority.

## Impact

- 影响 `.github/workflows/`、package scripts/command IDs、PR/integration/main/release/nightly receipts、GitHub ruleset verification和质量文档。
- 消费前置四项 change 的 qualified identities、failure disposition、production graph、fitness report、release qualification manifest 与 owner 记录。
- 不创建 Issue、不 claim、不部署、不修改生产选择器；GitHub protection 的真实状态必须以可验证平台证据为准。

## Dependencies and Blockers

- 硬前置：已 qualified 的 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs`、`establish-architecture-fitness-budgets` 必须同时可用，并消费 `restore-trustworthy-test-command-contracts` 的 command registry；任一输入未 qualified 时，不得宣称 PR/integration gate 完整。
- 外部 blocker：integration ruleset/branch protection 的 REST 403、计划限制或不可读状态只能记录 `blocked-unverified` receipt；不得以 workflow 通过替代平台保护。
- main/release 的既有强门禁是不可降低的前提；若映射导致其减少或 advisory 化，必须停在 blocker 并请求独立授权。
