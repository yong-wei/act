## Why

Grill 讨论会形成影响实现边界和技术取舍的决策，但现有流程不能保证这些记录进入与实现相同的 PR。决策一旦只保留在会话上下文或本地工作树，后续审阅者无法验证实现依据，也无法理解已经排除的方案。

## What Changes

- 将现有 Use-Grill-Me 包装技能纳入项目技能目录，使它以任务边界读取既有决策记录，并将新的上下文、ADR 与任务清单写入独立目录。
- 定义任务决策目录和 `manifest.json` 合同，关联 GitHub Issue 或本地任务、Grill 记录、OpenSpec 变更或无变更计划，以及实现范围。
- 新增本地提交与 PR 两阶段校验：前者验证任务清单有效，后者验证 PR 实现范围由同一任务清单覆盖。
- 要求实现 PR 面向 `integration`，并在创建后使用已配置的 Codex 审查请求。
- 将当前 #995 的决策记录和本 OpenSpec 变更互相关联，作为首个受该合同约束的任务。

## Capabilities

### New Capabilities
- `task-decision-delivery-governance`: 定义任务决策目录、清单、Use-Grill-Me 输入输出和决策记录随实现 PR 交付的要求。
- `task-decision-delivery-validation`: 定义本地提交和 PR 对任务清单及实现范围覆盖关系的验证行为。

### Modified Capabilities

- 无。

## Impact

- 新增项目级 Use-Grill-Me 技能及其作用域解析器测试、任务清单校验脚本及其测试。
- 修改项目技能索引和 `package.json` 的本地提交验证入口，并接入独立的 GitHub Actions PR workflow。
- 新增 `docs/grill/issue-995-decision-traceability/` 的决策记录和任务清单。
