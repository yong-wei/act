## ADDED Requirements

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
