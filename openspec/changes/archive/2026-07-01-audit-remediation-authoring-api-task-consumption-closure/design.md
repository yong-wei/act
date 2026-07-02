## Context

当前已归档变更证明若干入口可保存、可恢复、可访问，但 finding 371 指出更底层的问题：API 返回的数据没有稳定转化为“我要完成什么任务”。这会让作者态继续呈现超长清单，即便单个入口已经能工作。

## Approach

作者态 API consumption 应为每类对象生成任务视图：

- lesson plan: edit, validate empty items, start class, clone, archive, inspect linked sessions.
- resource: preview, edit metadata, attach to lesson, inspect usage, repair missing fields.
- ResourceNode: inspect registry/runtime/knowledge binding, resolve blocked state, export issue list.
- knowledge node: inspect graph relation, cite in resource, add to task/lesson, resolve missing metadata.

每个任务需要有可见状态：available, disabled with reason, pending, saved, failed, rolled-back or not reversible. 对已归档的 playlist save/play 和 graph mobile controls 只做兼容，不重新声明 closure。

## Boundaries

- 不重做课程流构建器保存、播放、移动分步或按钮命名。
- 不改变教材/RAG 导出链路。
- 不改变资源注册真源规则。

## Validation Strategy

- Run `openspec validate audit-remediation-authoring-api-task-consumption-closure --strict`.
- Add tests for API-backed task grouping, disabled reasons, save/failure/rollback states, resource usage links, blocked ResourceNode tasks, and knowledge-node citation actions.
- Capture representative UI/DOM evidence for lesson plans, resources, ResourceNodes, and knowledge nodes.
