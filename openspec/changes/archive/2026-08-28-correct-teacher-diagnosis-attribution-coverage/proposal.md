# Proposal: Correct teacher diagnosis attribution coverage

## Why

教师诊断历史投影把“任意 finding 缺少 `knowledgeNodeId`”当成覆盖受限。总体风险、成绩分布等本就不要求知识节点归因的发现，会把完整覆盖的高置信报告误显示为“证据可用，但覆盖受限”。

## What Changes

- 只有需要知识节点归因的发现缺少 `knowledgeNodeId` 时，才标记归因/覆盖受限。
- 总体风险、成绩分布、班级覆盖等非知识节点发现不得单独触发受限状态。
- 作业、测验、学生和学习行为覆盖完整且未声明限制时，页面状态与持久化覆盖事实一致。
- 保留真实知识归因缺失时的恢复建议。
- 增加投影层单元测试覆盖知识进度、总体风险/成绩分布和混合 findings。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `teacher-diagnosis-report-delivery`: 归因受限只由需要知识节点映射的发现触发。

## Impact

- `src/features/teacher/teacher-diagnosis-report-history-projection.ts`
- 教师诊断报告历史投影测试
- 不修改历史报告事实或证据引用
