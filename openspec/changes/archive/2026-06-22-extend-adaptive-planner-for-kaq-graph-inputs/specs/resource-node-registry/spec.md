## MODIFIED Requirements

### Requirement: ResourceNode graph supports planning constraints
The system SHALL expose graph edges and metadata needed by downstream adaptive path planning.

#### Scenario: Planner consumes ResourceNode graph profile
- **WHEN** graph-driven path planning reads ResourceNodes
- **THEN** the planner SHALL receive only audited graph profile, planning, readiness, evidence, citation, privacy, and governance metadata
- **AND** it SHALL NOT inspect raw resource content, raw chunks, media bytes, hidden Arena internals, or private learner evidence to decide path eligibility.
