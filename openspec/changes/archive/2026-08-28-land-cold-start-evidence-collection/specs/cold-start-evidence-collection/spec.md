## ADDED Requirements

### Requirement: Cold-start evidence gaps are classified by dimension

The system SHALL classify learner evidence insufficiency independently for mastery, ability, resource-preference, and freshness. A non-zero total evidence count SHALL NOT hide remaining insufficient dimensions. Missing, low-confidence, stale, partial, abandoned, or conflicting coverage SHALL be `insufficient` or `unknown`, not a precise personalized claim.

#### Scenario: New learner has no governed evidence

- **WHEN** a learner-state snapshot has no assessment-backed mastery, no ability estimate, no trusted resource preference, and missing freshness
- **THEN** all four dimensions are insufficient
- **AND** the student-facing surface SHALL show an executable starter path together with dimension-level limitation copy

#### Scenario: One dimension is filled and others remain empty

- **WHEN** a learner has completed a governed short diagnosis that updates mastery confidence, but resource preference and ability remain none or low
- **THEN** mastery MAY leave the insufficient set
- **AND** remaining dimensions SHALL stay insufficient with explicit limitation copy

### Requirement: Governed collection activities have independent quality semantics

The system SHALL offer collection activities for insufficient dimensions: short diagnosis, resource trial, and short simulation. Each activity record MUST include goal identity, resource identity, completion state, quality, confidence, source, time, and scope. Page views, clicks, chat declarations, and incomplete attempts MUST NOT become high-confidence preference or mastery.

#### Scenario: A completed governed resource trial is recorded

- **WHEN** a learner finishes a governed resource trial with a resource identity, goal identity, and successful completion
- **THEN** the collection record stores source, time, quality, confidence, and the resource-preference scope
- **AND** confidence for a single completed trial SHALL be at most `medium`

#### Scenario: Weak or unfinished events are rejected

- **WHEN** the event is a page view, click, chat declaration, incomplete attempt, abandoned activity, or conflicting evidence
- **THEN** the classifier SHALL reject it as high-confidence personalization input
- **AND** it SHALL NOT raise mastery

#### Scenario: Mastery authority is not bypassed

- **WHEN** a collection record is not backed by Assessment, official Arena, or governed simulation completion rules
- **THEN** the record MUST NOT write mastery
- **AND** it MAY only inform future new-path preference or limitation copy

### Requirement: Collection changes only subsequent new paths

Completed collection evidence SHALL affect only a later new path generation. Continuing an original path SHALL restore the original snapshot and MUST NOT replan from newer collection records. New-path decision evidence SHALL name which collection-backed dimension changed resource mix, difficulty or rhythm, or checkpoints, without calling the result a best path.

#### Scenario: Learner continues the original starter path after collection

- **WHEN** collection records arrive after a starter path snapshot was frozen
- **AND** the learner chooses to continue the original path
- **THEN** the restored path and frozen decision evidence remain the original snapshot
- **AND** newer collection records SHALL NOT mutate node order, resources, or explanations

#### Scenario: Learner creates a new path after a trusted collection record

- **WHEN** a later new path is generated after at least one completed governed collection record raised an applicable dimension above insufficient
- **THEN** the new path differs in at least one of resource mix, difficulty or rhythm, or checkpoints
- **AND** decision evidence records a collection-backed impact and student-readable explanation for that dimension
