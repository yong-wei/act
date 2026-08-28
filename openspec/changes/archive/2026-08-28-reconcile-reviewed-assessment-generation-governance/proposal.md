## Why

本地仍有 `govern-adaptive-assessment-generation-review-publication` 的完整规划文件，但当前代码、测试、任务勾选、归档记录和 GitHub #1480 的状态并不构成同一份可验证事实。生成题接口还会把固定模板和进程内 `Map` 结果标成 `ai_generated`，因此不能仅凭 Issue 已关闭就宣称“候选—人工审核—版本化目录发布”已经成立。

## What Changes

- 以当前 canonical `adaptive-assessment-item-catalog` 及既有生成审核合同为唯一行为真源，逐项对齐 #1480 的实现、测试、tasks、archive 与 Issue 状态。
- 修正生成来源 discriminator：固定模板只表示低风险临时练习，模型输出才表示 AI 候选；内存 `Map` 不得被当作持久候选、审核记录或目录发布证据。
- 若当前实现缺失候选持久化、确定性预检、独立人工审核、版本化 catalog publication 或 lineage，则在同一既有合同下补齐；不得建立第二套 candidate schema、状态机或目录。
- 只有候选 lineage、预检、人工批准、版本化目录记录和 publication receipt 全部可回读时，才允许进入 path-eligible 或正式评估阶段；历史答题快照保持不变。
- 生成 reconciliation receipt、覆盖/缺口台账和可删除的遗留入口记录；只有代码、测试、tasks、archive 和 Issue 对同一 SHA/合同身份一致时才标记 qualified。

## Capabilities

### New Capabilities

- `reviewed-assessment-generation-governance`: 定义生成审核合同的身份对账、真实生成来源、候选流水线和 qualified 证据条件。

### Modified Capabilities

- `adaptive-assessment-item-catalog`: 增加生成治理身份绑定和候选发布证据一致性要求；复用现有目录、阶段覆盖和快照规则，不创建平行目录。

## Dependencies

- 前置：`establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts` 必须先完成并通过 strict validation。
- 既有输入：`govern-adaptive-assessment-generation-review-publication` 的合同与 `adaptive-assessment-item-catalog` canonical spec；其本地未归档状态须作为待对账事实，不能直接视为已完成。
- 下游：`cutover-path-owned-assessment-attempts` 消费本 change 的 truthful generation 和 catalog publication 身份。

## Impact

- 影响 `src/features/assessment/adaptive-question-bank.ts`、`adaptive-engine.ts`、`adaptive-persistence.ts`、`src/features/adaptive-assessment/*`、生成题与审核/目录脚本及其测试。
- 可能更新候选/目录的私有持久化和证据工件，但不修改仍被其他领域消费的旧 `Question`/`UserAnswer` 表。
- 不创建 GitHub Issue、不关闭或重开 #1480、不部署、不激活生产；Issue/archive 的最终操作须由获授权的收口流程执行。
