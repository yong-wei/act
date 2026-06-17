## ADDED Requirements

### Requirement: Simulation and Arena outcomes are linkable from path execution
Simulation, control workbench, and Arena evidence governance SHALL expose privacy-safe outcome references that adaptive path execution can bind to path nodes.

#### Scenario: Simulation result is used by a path
- **WHEN** a simulation run satisfies a path node or readiness condition
- **THEN** governance SHALL expose a path-bindable reference containing run id, trace or replay reference, key metrics, validation result, source scope, and replay confidence where applicable.

#### Scenario: Arena result is used by a path
- **WHEN** an Arena submission satisfies a path node or terminal validation condition
- **THEN** governance SHALL expose a path-bindable reference containing submission id, official or preview status, score, validity, evaluation summary, and policy version.

#### Scenario: Outcome cannot be linked
- **WHEN** a simulation, workbench, or Arena outcome exists but cannot be safely linked to the owning path and student
- **THEN** the path SHALL treat the result as unbound
- **AND** the source system SHALL provide a governance-visible reason without exposing private raw payloads to the student UI.
