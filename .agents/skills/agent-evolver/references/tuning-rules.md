# Tuning Rules

## 先判断是哪一类问题
- 超时偏多：先看任务是否分派过宽，再看推理强度是否过重
- 结论过重：先收紧 `developer_instructions`，再考虑降模型或降强度
- 漏判风险：先看是否应从 Luna 升级到 Terra/Sol，或提高推理强度
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
- `spark-coder` 使用 Luna `high`，只能承担局部、可验证、易回滚的简单编码
- `patch-worker` 使用 Luna `max` 承担常规实现；Terra 只处理 Luna 不足的长上下文场景
- 普通独立审查和领域审查使用 Sol `medium`；只有 `critical-reviewer` 的高风险终审使用 Sol `high`，常设 Sol 角色不使用 `xhigh`
- `explorer-librarian` 默认只读，只提供材料与路径，不给最终裁决
- 常设角色必须使用 GPT-5.6 家族；历史模型仅保留在质量台账和兼容性校验中
