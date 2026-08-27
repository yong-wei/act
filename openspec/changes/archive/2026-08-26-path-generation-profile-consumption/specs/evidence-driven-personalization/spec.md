## ADDED Requirements

### Requirement: Path personalization preserves governed evidence provenance
路径个性化 SHALL 沿用学习者状态和受治理证据的来源、证据窗口、置信度、新鲜度及限制信息，不得把个人中心的展示摘要或未经治理的模型叙述作为路径依据。

#### Scenario: Path rationale cites governed evidence
- **WHEN** a generated path contains a personalized rationale
- **THEN** the rationale SHALL reference the governed evidence category and snapshot used by the planner
- **AND** it SHALL preserve the evidence limitation or confidence state

#### Scenario: Evidence is insufficient
- **WHEN** the required evidence cannot be retrieved, is stale, or has low coverage
- **THEN** the path result SHALL return an explicit fallback or low-confidence explanation
- **AND** it SHALL NOT present the path as a fully verified personalized diagnosis
