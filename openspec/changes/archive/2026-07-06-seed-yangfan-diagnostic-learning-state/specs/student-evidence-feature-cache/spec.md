## MODIFIED Requirements

### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, assessment records, learner-state source records, ResourceNode execution, path feedback, intervention outcomes, and prerequisite-provided simulation/Arena feature groups.

#### Scenario: Full rebuild produces stable payload
- **WHEN** a full feature-cache rebuild is run against unchanged governed evidence
- **THEN** the generated feature payload for a student SHALL remain stable across repeated rebuilds
- **AND** the cache SHALL record the feature payload version used for generation.
- **AND** diagnostic fixture accounts SHALL produce stable cache output across repeated reset/apply runs.

### Requirement: Feature cache consumes path-round evidence
Student evidence feature cache SHALL consume governed control-correction path execution, deviation, terminal validation, and intervention outcome records.

#### Scenario: Cache rebuild includes path features
- **WHEN** the feature cache rebuilds for a student with control-correction path evidence
- **THEN** it SHALL derive deterministic feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes
- **AND** it SHALL include source windows, evidence counts, freshness, confidence, and privacy markers.
- **AND** diagnostic fixture accounts SHALL include enough path evidence for downstream consumers to distinguish missing path context from limited but available path context.

#### Scenario: Cache rebuild includes fixture Arena context
- **WHEN** the feature cache rebuilds for a diagnostic fixture account with Arena-related auxiliary learning evidence
- **THEN** the cache MAY include privacy-safe learning-context features derived from fixture LearningFacts
- **AND** it SHALL NOT treat fixture LearningFacts as official Arena score, validity, ranking, leaderboard, or official submission result evidence.
