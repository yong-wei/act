## Purpose

Define reproducible assessment-backed knowledge mastery state and conservative confidence handling for contextual evidence.
## Requirements
### Requirement: Knowledge mastery is reproducible
The system SHALL compute knowledge-node mastery from persisted assessment inputs and versioned algorithms.

#### Scenario: Mastery is rebuilt
- **WHEN** mastery state is rebuilt from persisted assessment records
- **THEN** the same inputs and algorithm version SHALL produce the same mastery posterior and confidence metadata
- **AND** the rebuild SHALL expose missing or stale prerequisite evidence.

### Requirement: Assessment-backed mastery uses conservative confidence
The system SHALL distinguish assessment-backed mastery from contextual evidence.

#### Scenario: Non-assessment evidence is present
- **WHEN** browsing, media progress, graph exploration, simulation context, or Konling interaction evidence exists without calibrated assessment evidence
- **THEN** it MAY contribute context confidence or remediation signals
- **AND** it SHALL NOT by itself create high-confidence mastery.

### Requirement: Mastery state is traceable to knowledge capability evidence
Adaptive mastery state SHALL expose traceability from knowledge nodes and capability targets to governed supporting evidence.

#### Scenario: Mastery state is read
- **WHEN** a learner mastery state is requested for a knowledge node or capability target
- **THEN** the response SHALL include mastery level or state, confidence, freshness, supporting evidence refs, source coverage, and limitations
- **AND** it SHALL distinguish target capability requirement from observed mastery evidence.

#### Scenario: Supporting evidence is weak
- **WHEN** supporting evidence is missing, stale, partial, preview-only, low-confidence, or not teacher-approved where required
- **THEN** the mastery state SHALL expose the limitation
- **AND** downstream path planning or Konling responses SHALL NOT present the state as fully verified.

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

