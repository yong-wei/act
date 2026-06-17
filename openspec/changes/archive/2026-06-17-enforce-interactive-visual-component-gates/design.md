## Context

之前设计与实现偏差的根因之一是“设计方向”没有变成工程验收合同。完成标准如果只写功能可运行，视觉质量、课堂流程、教师诊断、数据证据和深浅色状态就会被遗漏。

## Design Contract

本变更引用完整 Product Design 合同。合同中的视觉元素、深浅色适配、学生/教师端角色、非默认状态、后台证据记录和工程语义泄露限制均为验收闸门。

## Decisions

1. 每个视觉组件实现必须提交可审计证据，不允许只给说明文字。
2. 学生端和教师端浏览器审核是不同上下文，不能互相替代。
3. 浅色、深色、移动端、桌面端和投影端截图都必须存在。
4. 组件级状态矩阵必须覆盖学生端未释放、已释放、提交后，以及教师端显影中或揭示中、答案揭示、诊断聚合；结构图还必须覆盖构图后，热点媒体还必须覆盖热点已选。
5. 后台证据样本必须包含组件级事件和提交记录，并绑定 `clientEventId`、`attemptKey`、可信 `sourceLogId`、`schemaVersion`、`InteractionLog`、`StudentStepResponse` 和 `LearningFact` 归属。
6. 每个组件必须回指作者态和教学语义: `lesson_id`、`step_id`、`learning_goal_id`、`handout_anchor` 或 `evidence_unit_id`、`boppps_phase`、`interactive_contract_step_id`。
7. 截图和审核报告必须使用稳定命名与清单字段，不能用自由路径或重复截图冒充互动态。
8. 工程语义泄露是阻塞项，不能作为后续优化。
9. 子代理审查只在用户或 issue/PR 明确授权时作为必选项；否则必须提供等价独立 reviewer 或 Product Design QA 记录。

## Acceptance Evidence

- 设计合同路径。
- 每个组件对应视觉稿或方向稿路径。
- 学生端截图、教师端截图、浅色截图、深色截图。
- 非默认状态截图。
- 移动端、桌面端和投影端视口截图。
- 状态矩阵清单。
- manifest audit。
- 单元测试、组件测试或浏览器测试结果。
- 后台证据记录样本。
- 子代理或独立 reviewer 审核结论。
