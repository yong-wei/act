## Why

现有 3,609 项 worklist 绑定旧候选快照，不能作为最新 Aggregate 的最终课程审核分母。系统需要先生成当前、完整且可重复的 worklist 和确定性审核批次 manifest，才能建立真实的 Buddy 审核子变更和依赖图。

## What Changes

- 从已接纳的最新候选 Release/Delta 重新生成 `N_current` CourseCoverage worklist，保留对象修订、来源、邻域、证据和输入摘要。
- 将历史 Coverage 决定限制为 `priorDecisionRefs`，不得复制为当前权威决定。
- 生成确定性的 review-batch manifest，为后续 `review-course-coverage-<batch-id>` 变更冻结互斥、无遗漏的 Canonical 成员集合。
- 加入分母、重复、遗漏、证据、批次闭包和版本漂移门禁；不执行批次内最终审核，不改变生产 selector。

## Capabilities

### New Capabilities

- `current-course-coverage-review`: 定义当前 CourseCoverage worklist、证据边界、审核批次 manifest 和后续决定装配合同。

### Modified Capabilities

无。

## Impact

- 影响 CourseCoverage worklist/receipt 生成脚本、候选治理工件和对应测试。
- 输出后续 Buddy 变更的精确批次身份与成员，不直接产生 CURRENT Coverage。
- 依赖 `admit-latest-stable-actkg-aggregate` 的已接纳候选身份。
