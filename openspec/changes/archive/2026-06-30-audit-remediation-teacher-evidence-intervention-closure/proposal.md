## Why

教师报告、评分审批、学生证据 deep link 和强化/补练干预已有多轮基础整改，但审计报告仍保留一批教师侧业务闭环问题：教师能看到证据和候选行动，却不能把处置、反馈、补练任务或路径干预稳定写回。下一阶段需要把教师证据阅读、评分交付和后续干预连成可审计的工作流。

## What Changes

- 将教师报告、评分工作台、学生证据页和班级复盘中的候选行动统一为可执行干预对象。
- 补齐强化任务、补练路径、评分写回和报告交付的状态、失败恢复、审计记录和学生可见结果。
- 要求教师侧证据深链能返回原报告/班级/课堂上下文，并能解释学习者状态不足时的限制。
- 回写 Product Design 审计报告，只关闭有测试或运行证据支撑的 finding。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-teacher-report-grading`: 扩展教师报告、评分和学生证据页的后续干预闭环。
- `teacher-evidence-governance`: 要求教师证据处置和学生可见结果之间保持可追踪关系。
- `adaptive-learning-center-ui`: 要求教师发起的补练/强化路径能进入学生路径或给出明确限制。

## Impact

影响教师报告页、文档评分工作台、学生证据页、班级复盘、学习路径生成入口、LearningFact/证据时间线、相关 API 和审计 evidence 工件。
