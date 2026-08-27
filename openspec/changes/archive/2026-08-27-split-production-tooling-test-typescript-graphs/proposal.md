## Why

根 `tsconfig.json` 以仓库级 `**/*.ts`、`**/*.tsx` 为主要 include，导致产品、测试、工具和一次性脚本共享一个 TypeScript Program。当前通过提高 Node heap 来维持 typecheck 只能延后问题，不能证明生产图独立、共享合同有 owner 或工具改动不会牵动产品编译。阶段 1 需要建立清晰、严格且可单独验证的 production、tooling、test 编译图。

## What Changes

- 建立共享 base、Web production、worker production、tooling 和 test 的独立 tsconfig/project-reference 边界与命令。
- 让默认 `npm run typecheck` 只验证 production 图；工具和测试通过具名命令验证，不能被生产 typecheck 静默带入或排除。
- 将 `typecheck:tools` 与 `typecheck:test` 纳入 PR 或 integration 的强制质量层；两图未通过时 main/release 不得发布，nightly 不承担补漏。
- 从 production graph 排除 `scripts/`、`tests/`、OpenSpec、文档、artifacts、evaluate、一次性迁移/回填和其他非运行工具，并对反向依赖 fail closed。
- 对跨图共享类型/契约指定唯一 owner，避免同一合同被多个 program 重复编译或各自复制。
- 为 cold typecheck 的 RSS、duration 和文件计数生成 revision-bound measurement receipt；变量测量不成为 deterministic core 的永久常量。
- 删除“只加内存”作为结构修复的默认路径，保持生产图 strict、no-emit、可审计。

## Capabilities

### New Capabilities

- `split-production-tooling-test-typescript-graphs`: 定义生产、worker、工具和测试 TypeScript 编译图、命令、共享合同 owner 与 measurement receipt。

### Modified Capabilities

None. Existing frontend source-boundary, dependency-chain and domain-contract specifications remain authoritative.

## Impact

- 影响 `tsconfig*.json`、`package.json` typecheck scripts、Next/worker/tool/test entrypoints、共享类型边界、CI mapping 和编译测量 receipt。
- 消费 `capture-modular-monolith-refactor-baseline` 的编译观察与 `restore-trustworthy-test-command-contracts` 的命令/receipt 语义；`typecheck:tools` 与 `typecheck:test` 的强制状态必须由后续 CI gate 读取。
- 不改变运行时业务、API、数据库、WASM 数值行为或生产发布状态；不以本 change 宣称编译预算已达标。

## Dependencies and Blockers

- 硬前置：已 qualified 的 `capture-modular-monolith-refactor-baseline` 与 `restore-trustworthy-test-command-contracts`；编译 entrypoint、文件分母或命令 receipt drift 时必须先重建输入并保持 blocked。
- 共享合同 owner、生产/工具/测试分类无法从 baseline/charter 证明时，保持 graph blocker，不扩大 production glob。
- qualified graph identity 和 measurement receipts 是 `establish-architecture-fitness-budgets`、`enforce-pr-integration-quality-gates` 的必需输入。
