## Why

现有微辅导 v1 仅覆盖 54 道 practice 题。自适应评估还会选择 27 道 checkpoint、27 道 remediation 以及 27 道 readiness/readiness-gate 题；这些题的错误选项没有精确归因，因此运行时只能 fail-closed 为 `ATTRIBUTION_UNCERTAIN`。

## What Changes

- 新增不可变的 v2 微辅导题目基线，固定当前 135 道人工审核且 path-eligible 的自适应题。
- 新增 v2 选项归因目录，为 272 个错误选项保存内容哈希绑定的独立审核事实。
- 让新错误答案优先使用 v2 目录，同时保留 v1 工件、历史归因和资格回执。
- 扩展生成与回归测试，拒绝缺失、重复、正确选项、内容漂移、审核漂移及节点不一致。

## Capabilities

### New Capabilities

- `micro-tutoring-v2-assessment-baseline`: 定义 135 题全阶段固定分母及版本兼容边界。

### Modified Capabilities

- `micro-tutoring-option-attribution`: 将精确选项归因覆盖从 v1 practice 分母扩展到 v2 全阶段分母。
- `wrong-answer-evidence-attribution`: 新归因使用当前激活的 v2 目录，历史归因保持不可变。

## Impact

- 影响 `course-content/runtime/resource-governance/` 下的微辅导基线与归因目录。
- 影响微辅导目录加载器、错误答案归因及其生成和单元测试。
- 不配置学习资源、独立验证题，不修改学生页面。
