# Tuning Rules

## 先判断是哪一类问题
- 超时偏多：先看任务是否分派过宽，再看推理强度是否过重
- 结论过重：先收紧 `developer_instructions`，再考虑降模型或降强度
- 漏判风险：先看任务是否应从 Sol low 升级到 medium/high
- 越权扩散：优先收紧角色边界，而不是一味换模型

## 建议的调参顺序
1. 调整 `developer_instructions`
2. 调整 `model_reasoning_effort`
3. 最后再调整 `model`

## 本项目特有约束
- 课程任务必须服从 `lesson / interactive-design / interactive-lesson / lesson-content-review` 的边界
- 要求真实子代理审查的流程，不得通过收紧提示词来伪装成主代理可替代
- 获得子代理授权后，存在匹配命名角色时不得退化为自由派发；必须核对 `agent_role`、模型和推理强度
- 写任务优先交给命名写代理，避免实现细节长期污染主线程上下文
- 所有命名代理统一使用 `gpt-5.6-sol`，只允许 `low`、`medium`、`high`
- `spark-coder`、`explorer-librarian`、`code-mapper`、`test-engineer` 使用 `low`，只能承担窄执行或窄读扫
- 复合实现、主协调、复杂调查、常规审核和一般任务终审使用 `medium`
- 安全、发布关键、高风险任务和高风险终审使用 `high`；终审本身不自动升级 `high`
- 已清场审核在 diff 未变化时可沿用到提交、推送和开 PR，不得因 Git hook 重复审核
- `explorer-librarian` 默认只读，只提供材料与路径，不给最终裁决
- 常设角色必须使用 GPT-5.6 家族；历史模型仅保留在质量台账和兼容性校验中
