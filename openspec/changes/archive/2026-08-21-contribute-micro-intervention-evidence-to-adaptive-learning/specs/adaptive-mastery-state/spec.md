## ADDED Requirements

### Requirement: 掌握度保守消费微干预验证投影

掌握度重算 MAY 消费治理合格的微干预独立验证证据，但 MUST 应用版本化质量、重复、衰减和冲突策略。参与事件、AI 提示和单次微干预通过不得单独形成高置信度或终结性掌握；投影缺失、过期或冲突 SHALL 暴露 limitation。

#### Scenario: 合格微干预验证参与重算

- **WHEN** mastery rebuild 读取到身份完整、未重复且当前的独立验证投影
- **THEN** 它 SHALL 按算法版本产生有界贡献和可追溯 evidence ref
- **AND** 相同输入重算 SHALL 得到相同 posterior/confidence

#### Scenario: 只有参与事件或单次通过

- **WHEN** 学习者只有资源动作、提示事件或一条无额外支持的通过结果
- **THEN** mastery SHALL 保持保守置信度并标出证据限制
- **AND** 不得声明 terminal mastery
