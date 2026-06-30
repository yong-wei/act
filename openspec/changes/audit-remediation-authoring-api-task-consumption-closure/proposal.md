## Why

`audit-remediation-authoring-knowledge-flow-polish` 已关闭课程流构建器保存/校验、播放恢复、知识图谱筛选和按钮命名等范围。审计报告仍保留的作者态残余是 API 数据没有被任务化消费：`/api/lesson-plans`、`/api/resources`、`/api/teacher/resource-nodes`、`/api/knowledge/nodes` 均有数据，但 UI 仍容易表现为长列表或静态清单，缺少编辑、治理、引用、保存、回滚这些可完成任务。

## What Changes

- 为 lesson plans、resources、ResourceNodes 和 knowledge nodes 的作者态 API 数据定义任务化消费合同。
- 将数据列表组织为可执行任务：编辑、治理、引用、保存、回滚或说明不可执行原因。
- 对长页残余范围提供任务分组、状态播报和完成/失败结果，而不是再次重复课程流保存/播放整改。
- 回写审计报告和 evidence，重点覆盖 finding 371 及直接相关的作者态 API consumption 残余。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-authoring-resource-flows`: 增加作者态 API 数据任务化消费要求。

### Related Capabilities
- `teacher-resource-node-management`
- `resource-node-knowledge-workspace-ui`

## Impact

影响教师/管理员教案、资源管理、ResourceNode 管理、知识节点管理、作者态治理入口、API consumer contracts、状态播报和相关测试。
