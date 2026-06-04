## Purpose

Provide a stable, governed diagnosis layer that materializes student, teacher, and service-facing learning diagnosis views from privacy-safe evidence. The layer standardizes judgments, root causes, confidence limits, next actions, and evidence references for future student profile, teacher consultation, prep-pack, grading, and Konling surfaces.
## Requirements
### Requirement: Diagnosis views are role-specific
The system SHALL materialize role-specific learning diagnosis views for students, teachers, and service consumers.

#### Scenario: Student diagnosis is requested
- **WHEN** a student opens a learning overview for a registered goal
- **THEN** the diagnosis SHALL include current judgment, student-readable explanation, supporting evidence references, confidence or limitation state, and next-action links.

#### Scenario: Teacher class diagnosis is requested
- **WHEN** an authorized teacher opens a class diagnosis
- **THEN** the diagnosis SHALL include root-cause clusters, affected population, denominator, confidence, evidence coverage, intervention priority, and class-scoped drilldown references.

#### Scenario: Teacher student consultation is requested
- **WHEN** an authorized teacher opens an individual consultation view
- **THEN** the diagnosis SHALL include dimension, indicator, evidence, recent change, likely cause, and intervention resources
- **AND** it SHALL preserve class-scope authorization.

#### Scenario: Teacher student consultation lacks target student
- **WHEN** a teacher-student diagnosis is requested without an explicit target student
- **THEN** the diagnosis SHALL expose a missing target student limitation
- **AND** it SHALL NOT materialize student path details, learner-state dimensions, class-wide learner evidence, or target-scoped next-action links.

### Requirement: Diagnosis claims are evidence-backed
Diagnosis output SHALL not present a personalized claim without evidence and confidence metadata.

#### Scenario: Evidence-backed claim is emitted
- **WHEN** a diagnosis claim is materialized
- **THEN** it SHALL identify governed evidence references, evidence window, source coverage, confidence state, materialization version, and privacy class.

#### Scenario: Evidence is insufficient
- **WHEN** evidence is missing, stale, partial, preview-only, or low confidence
- **THEN** the diagnosis SHALL expose the limitation
- **AND** it SHALL NOT present the claim as a complete or precise diagnosis.
