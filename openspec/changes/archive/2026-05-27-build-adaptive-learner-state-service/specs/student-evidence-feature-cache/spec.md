## MODIFIED Requirements

### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, assessment records, learner-state source records, ResourceNode execution, path feedback, intervention outcomes, and prerequisite-provided simulation/Arena feature groups.

#### Scenario: Simulation and Arena features are consumed
- **WHEN** the cache includes simulation or Arena feature groups
- **THEN** it SHALL consume the outputs of `materialize-simulation-features-for-personalization`
- **AND** it SHALL NOT redefine trace, replay, coverage, or Arena evaluation semantics.

## ADDED Requirements

### Requirement: Cache exposes adaptive-learning freshness and coverage
The system SHALL expose freshness, source coverage, and confidence metadata for adaptive learner-state feature groups.

#### Scenario: Feature entry is read
- **WHEN** a student evidence feature cache entry is read for learner state
- **THEN** it SHALL include evidence windows, source counts, source coverage, last refresh time, and confidence markers for the features it contains.
