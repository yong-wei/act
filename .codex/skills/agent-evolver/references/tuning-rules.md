# Tuning Rules

## 先判断是哪一类问题
- 超时偏多：先看任务是否分派过宽，再看推理强度是否过重
- 结论过重：先收紧 `developer_instructions`，再考虑降模型或降强度
- 漏判风险：先看是否应该升级到 `gpt-5.4` 或更高强度
- 越权扩散：优先收紧角色边界，而不是一味换模型

## 建议的调参顺序
1. 调整 `developer_instructions`
2. 调整 `model_reasoning_effort`
3. 最后再调整 `model`

## 本项目特有约束
- 课程任务必须服从 `lesson / interactive-design / interactive-lesson-implementation / lesson-content-review` 的边界
- 要求真实子代理审查的流程，不得通过收紧提示词来伪装成主代理可替代
- `spark-coder` 只能承担局部、可验证、易回滚的简单编码
- `explorer-librarian` 默认只读，只提供材料与路径，不给最终裁决
