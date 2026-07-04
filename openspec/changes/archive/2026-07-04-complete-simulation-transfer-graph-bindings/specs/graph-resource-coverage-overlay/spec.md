## ADDED Requirements
### Requirement: Simulation and transfer graph resource bindings preserve evidence authority
The graph resource coverage workflow SHALL review simulation-validation and ship-ocean transfer resources as high-complexity graph coverage.

#### Scenario: Simulation or transfer resource is bound
- **WHEN** a simulation, control workbench, Arena, reflection, or transfer-application resource is linked to a graph node
- **THEN** the binding SHALL declare whether the resource is concept support, practice, evidence-producing, preview validation, official validation, terminal validation, remediation, or excluded
- **AND** official Arena score, validity, ranking, and leaderboard authority SHALL remain sourced only from official Arena contracts.

#### Scenario: High-complexity coverage is incomplete
- **WHEN** readiness metadata, evidence authority, or route target is missing
- **THEN** the coverage overlay SHALL keep the resource blocked or locked rather than marking it path-eligible.
