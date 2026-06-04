## ADDED Requirements

### Requirement: Feature cache consumes path-round evidence
Student evidence feature cache SHALL consume governed control-correction path execution, deviation, terminal validation, and intervention outcome records.

#### Scenario: Path execution changes
- **WHEN** a student's control-correction path execution, deviation, or intervention outcome changes
- **THEN** the system SHALL refresh or enqueue refresh for that student's feature cache
- **AND** unrelated student cache entries SHALL NOT be rewritten.

#### Scenario: Cache rebuild includes path features
- **WHEN** the feature cache rebuilds for a student with control-correction path evidence
- **THEN** it SHALL derive deterministic feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes
- **AND** it SHALL include source windows, evidence counts, freshness, confidence, and privacy markers.

#### Scenario: Retry is processed
- **WHEN** the same path evidence event is processed more than once
- **THEN** the cache rebuild or refresh SHALL reuse dedupe keys or stable source references
- **AND** it SHALL NOT double-count adoption, completion, intervention acceptance, or competency contribution.
