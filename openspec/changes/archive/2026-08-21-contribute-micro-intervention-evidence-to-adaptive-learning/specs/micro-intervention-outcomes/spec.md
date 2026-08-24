## ADDED Requirements

### Requirement: 微干预结果提供不可变学习证据投影源

微干预结果 SHALL 暴露一个服务端内部、不可变且可重放的投影源，包含 outcome identity、验证题/content/version、结果、学习目标、规范节点、来源归因、干预和 capture identity。结果写入本身 MUST 继续只保存 outcome，不得同步写 mastery 或正式 path。

#### Scenario: projector 读取已封存结果

- **WHEN** 一个 outcome 完整且当前治理身份可核验
- **THEN** 内部投影源 SHALL 提供生成候选学习证据所需的不可变引用
- **AND** 学生 API SHALL 继续只返回 learner-safe 结果

#### Scenario: outcome 不完整或已漂移

- **WHEN** outcome 缺少验证内容身份或其治理引用无法核验
- **THEN** 投影源 SHALL 返回 limitation
- **AND** 不得推断或补写缺失身份
