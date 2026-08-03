## Purpose

Ensure the series-precheck terminal step is an explicit, observable, and idempotent learner action, so completion evidence is written only after the learner confirms submission and failures can be retried.

## Requirements

### Requirement: Series precheck uses an explicit completion action
“串联校正速判”课前检测 SHALL 在最后一题完成答案检查后显示可执行的“完成检测”操作，不得显示无效的“下一题”。

#### Scenario: Final answer has been checked
- **WHEN** 学生在最后一题选择答案并完成检查
- **THEN** 测验 SHALL 显示“完成检测”
- **AND** SHALL NOT 在检查动作中提交测验完成结果

#### Scenario: Earlier answer has been checked
- **WHEN** 学生在非最后一题完成答案检查
- **THEN** 测验 SHALL 显示“下一题”
- **AND** 点击后 SHALL 进入下一题

### Requirement: Completion submission is observable and idempotent
测验完成提交 SHALL 展示处理中、成功和失败状态，并阻止单次操作产生重复并发写入。

#### Scenario: Completion is pending
- **WHEN** 学生点击“完成检测”且写入尚未结束
- **THEN** 测验 SHALL 显示提交中状态
- **AND** 重复点击 SHALL NOT 再次调用完成写入

#### Scenario: Completion succeeds
- **WHEN** 测验结果和学习路径证据写入成功
- **THEN** 测验 SHALL 显示明确的完成结果反馈

#### Scenario: Completion fails
- **WHEN** 学习路径完成写入失败
- **THEN** 测验 SHALL 显示用户可见的错误
- **AND** SHALL 提供重试完成操作
