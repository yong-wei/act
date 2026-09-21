# marine-comparison-lab Specification

## Purpose
对照实验入口使用真实共享消费者：声明的活动船模、水平正确组合的海面，以及当前选定后端的船体查询。实验提供确定重置与步进，不替换数值模型。

## Requirements
### Requirement: Comparison scenes use real shared consumers
The comparison lab SHALL use the declared active vessel asset, a horizontal correctly composed ocean and the selected backend for vessel queries.

#### Scenario: A backend changes
- **WHEN** The user or runner selects another ocean backend
- **THEN** The same vessel asset and water datum are preserved and queries come from the selected surface.

### Requirement: Display replay is deterministic and stateful
The lab SHALL provide deterministic reset and stepping through the real scene, including stateful foam history, without replacing the numerical model.

#### Scenario: A capture is replayed
- **WHEN** The same initial state and event sequence are replayed twice
- **THEN** Both captures reproduce the declared state within tolerance and report actual backend and feature identities.
