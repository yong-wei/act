## Why

Arena 官方提交与发布报告已经能解释 attempt policy 和 evidence writeback 状态，但审计剩余风险在于写回仍偏投影化：学生、教师和控灵/路径规划需要可查询的学习证据，而不是只在提交响应或报告摘要中看到一次性 projection。

## What Changes

- 将 accepted official Arena submission 的 KAQ evidence writeback 落到持久学习证据。
- 保持 late、zero、invalid、duplicate 和 permission-limited attempt 的不写回或降级原因。
- 让学生反馈、教师发布报告、证据时间线、LearningFact/KAQ overlay 和后续路径规划读取同一权威写回结果。
- 补齐幂等、重复提交、回滚失败和审计 evidence。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `kaq-evidence-writeback-governance`: 要求 Arena 写回从 projection 升级为幂等持久材料化。
- `audit-remediation-arena-classroom-evidence`: 要求 Arena evidence writeback 可被学生证据和教师报告共同查询。
- `arena-learning-evidence-context`: 要求 Arena 提交证据能进入学习上下文消费链路。

## Impact

影响 Arena evaluate API、submission service、KAQ evidence writeback、LearningFact/学生证据查询、教师发布报告、学生反馈组件、路径规划证据输入和相关测试。
