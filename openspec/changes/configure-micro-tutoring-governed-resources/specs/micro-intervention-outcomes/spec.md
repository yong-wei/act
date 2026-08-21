## ADDED Requirements

### Requirement: 微干预记录受治理资源动作身份

系统 SHALL 仅记录服务端已验证、属于干预快照的资源动作事件。事件 MUST 绑定干预实例、资源稳定身份、资源 revision/hash、动作 id/version 和事件幂等键；客户端不得替换资源或动作身份。参与事件 SHALL 与独立验证结果保持不同的 evidence kind。

#### Scenario: 记录合格资源动作完成

- **WHEN** 学生完成当前干预所选资源的受控动作
- **THEN** 系统 SHALL 幂等记录服务端绑定的资源和动作身份
- **AND** 该事件 SHALL 标记为参与上下文而非掌握证明

#### Scenario: 客户端替换动作身份

- **WHEN** 客户端提交的资源、动作或 revision 不属于干预快照
- **THEN** 系统 SHALL 拒绝事件
- **AND** 不得重写已有干预证据
