## Context

归档变更已经证明报告交付、评分审批和学生证据 deep link 的基础状态可用，但当前剩余缺口集中在“教师读到证据之后如何形成可执行后续行动”。如果只补更多提示文案，仍会留下假动作：教师看见补练或强化建议，却不能创建任务、不能写回路径，也不能在学生侧看到结果。

## Approach

以教师证据后续行动为主线定义最小闭环：

1. 来源：报告、评分结果、课堂复盘、学生证据详情均生成同一种处置候选。
2. 决策：教师可以选择发送反馈、批准评分写回、生成补练任务、生成或更新学习路径。
3. 写回：每个动作必须产生持久状态，或返回明确的不可写回原因。
4. 可见：学生侧路径、任务或证据时间线必须能看到教师动作的结果。
5. 审计：审计报告只在 evidence 文件、测试和 UI 证据同时可追溯时关闭 finding。

## Boundaries

- 不重写教师报告总架构，不引入第二套证据模型。
- 不把学习者画像缺失作为整体失败；只能降低个性化程度，并保留证据引用和可执行下一步。
- 不关闭未被本变更测试覆盖的管理员、Arena、课堂生命周期或作者态 finding。

## Validation Strategy

- Run `openspec validate audit-remediation-teacher-evidence-intervention-closure --strict`.
- Add focused unit/API/component tests for teacher evidence action state, writeback success/failure, student visibility, and context-preserving deep links.
- Capture DOM or browser evidence for representative teacher report, student evidence detail, grading workbench, and student-side result surfaces before closing audit findings.
