## ADDED Requirements

### Requirement: Locked terminal validation is reported as included but unverifiable

当路径纳入终点检验节点但这些节点当前都不是 ready 时，Planner SHALL 明确报告终点已纳入且当前不可验证。客户端 MUST NOT 把未 ready 的终点展示为可立即检验。

#### Scenario: Included Arena terminal is locked

- **WHEN** `terminalValidationNodeIds` 非空，且这些终点没有一个 ready
- **THEN** `terminalValidationStrategy.summary` SHALL 表达终点已纳入但当前不可验证
- **AND** `paths[].limitations` SHALL 包含稳定受限文案“终点已纳入但当前不可验证”
- **AND** `activeNodeIds` MUST NOT 包含该 locked 终点

#### Scenario: Ready Arena terminal keeps existing reporting

- **WHEN** 纳入的终点检验节点至少有一个 ready
- **THEN** `terminalValidationStrategy` 与 `limitations` SHALL 保持现有可验证报告行为
