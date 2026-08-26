## Why

当前 `npm test` 只组合少量专项 smoke 与界面治理脚本，`test:unit` 依赖人工维护的 Vitest include 清单，命令名无法说明覆盖范围、失败语义或是否包含发布证据。这样会让新增测试静默脱离默认门禁，也会把一次性、版本绑定的证据失败误判为产品回归。阶段 1 需要先恢复一套可发现、可审计、默认不接受红色的测试命令合同。

## What Changes

- 定义 `npm test`、领域单元、契约、集成、关键 E2E、发布资格和 nightly 命令的唯一语义、责任边界与退出条件。
- 以仓库声明的测试根和领域归属自动发现测试，取消手工 Vitest include 表作为唯一权威；发现、排除和未分类项必须闭合分母。
- 为当前观察值和环境敏感结果生成绑定 source revision/tree 的 receipt，不把某次通过数、失败数或机器指标写成永久常量。
- 将 run-specific commercial UI、runtime、知识图谱和 OSS 证据从产品测试命令移入显式发布资格输入，并要求证据 revision 一致。
- 明确失败、未处理异常、禁止跳过和未登记的排除均使对应门禁失败；不得静默遗漏或接受失败。
- 保留现有领域行为与发布权威边界，仅替换命令编排、发现和证据归属。

## Capabilities

### New Capabilities

- `restore-trustworthy-test-command-contracts`: 定义分层测试命令、自动发现、revision-bound receipt、失败语义和发布资格输入边界。

### Modified Capabilities

None. Existing release-signal and domain-specific governance specifications are consumed as inputs and are not duplicated or weakened.

## Impact

- 影响 `package.json` scripts、Vitest 配置、测试发现/receipt 工具、领域测试归属清单、CI check 调用和测试文档。
- 需要读取 `capture-modular-monolith-refactor-baseline` 的测试与 CI 观察，并与 `establish-modular-monolith-refactor-charter` 的 owner/authority 记录保持一致。
- 不改变产品路由、数据库、runtime selector、生产发布或 GitHub 协调状态；本 change 也不 claim、部署或激活任何 release。

## Dependencies and Blockers

- 硬前置：`capture-modular-monolith-refactor-baseline` 与已 qualified 的 `establish-modular-monolith-refactor-charter` 必须同时可用；charter 是 baseline 之外的独立 hard prerequisite，不能从 baseline 自动推定。
- 若任一 source identity、测试分母、CI 观察或 charter owner/authority 记录 drift/不完整，必须先以新 receipt 重建输入并保持 blocker。
- 本 change 的命令与 discovery receipt 是 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs` 和后续 CI gate 的必需输入。
