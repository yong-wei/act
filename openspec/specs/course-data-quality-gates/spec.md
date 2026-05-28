# course-data-quality-gates Specification

## Purpose

Prevent new interactive lessons from regressing into answer-dropping submissions or unclassified sync errors by enforcing shared submission gates and post-class data-quality reporting.
## Requirements
### Requirement: Response-producing pages are covered by a submission gate
The system SHALL provide a repository gate that detects manifest response-producing pages that bypass the shared submission evidence path.

#### Scenario: Missing shared submission integration
- **WHEN** a manifest page can collect a student response but does not use the shared submission path
- **THEN** the gate MUST fail with the lesson and step or page identifier
- **AND** the failure MUST identify the missing evidence integration.

#### Scenario: Module 5 coverage is included
- **WHEN** the gate runs
- **THEN** 5-2 and later module 5 lessons MUST be included in the response-producing page inventory
- **AND** the gate MUST fail if any inventoried page lacks coverage.

### Requirement: Session data-quality report is available
The system SHALL provide a report that summarizes post-class evidence usability for a session.

#### Scenario: Report includes evidence richness
- **WHEN** the data-quality report runs for a session
- **THEN** it MUST include answer availability, score availability, question summary availability, evidence quality level, report availability, and snapshot freshness
- **AND** it MUST distinguish rich, partial, legacy, and missing evidence.

#### Scenario: Report includes sync quality
- **WHEN** sync errors occurred in the session
- **THEN** the report MUST include raw sync errors, incident count, affected users, dominant source, and severity classification.

### Requirement: Course implementation guidance includes evidence gates
The system SHALL document evidence-gate requirements in the repo-local interactive lesson implementation workflow.

#### Scenario: New lesson implementation
- **WHEN** a new interactive lesson is implemented from manifest activities
- **THEN** the implementation guidance MUST require the shared submission path and post-class evidence verification
- **AND** it MUST name the commands or tests that enforce those requirements.

### Requirement: All runtime-first response pages are gated
The system SHALL gate every runtime-first manifest lesson that can produce a student response.

#### Scenario: Bypass is detected
- **WHEN** a response-producing student page does not use the shared manifest submission controller
- **THEN** the gate fails with lesson and step identifiers

### Requirement: Objective response steps require scoreable context
The gate SHALL verify objective quiz steps can produce question summaries or explicit unsupported-scoring metadata.

#### Scenario: Quiz group lacks evidence contract
- **WHEN** a quiz_group step has reference answers but cannot emit questionSummaries or scoring context
- **THEN** the gate fails with the lesson and step identifier

### Requirement: Early runtime-first lessons are gated
The system SHALL include 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 in the runtime-first manifest submission gate inventory after migration.

#### Scenario: Early lesson missing from required inventory fails
- **WHEN** the course data-quality gate runs after early unit migration
- **THEN** `REQUIRED_RUNTIME_FIRST_GATE_LESSONS` SHALL include 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4
- **AND** the gate SHALL fail if any of those lessons is missing from `COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY`.

#### Scenario: Early lesson bypass is detected
- **WHEN** a migrated early unit student page directly emits a lesson submit event or lacks a manifest step getter
- **THEN** the gate SHALL fail with the lesson id and missing integration code
- **AND** the failure SHALL identify the bypass rather than allowing legacy evidence to pass as rich evidence.

### Requirement: Standard course finalization bypasses are gated
The system SHALL provide a guard that detects standard interactive courses bypassing the shared finalization adapter.

#### Scenario: Handwritten finalization is detected
- **WHEN** a standard course file imports `buildSessionFinalizeTelemetry` or directly calls `trackSessionFinalize` as the session closure path
- **THEN** the gate SHALL fail with the course identifier
- **AND** the failure SHALL require migration to the shared finalization adapter.

#### Scenario: Finalization inventory covers all standard lessons
- **WHEN** the finalization gate runs
- **THEN** it SHALL cover the same standard runtime-first lesson inventory used by submission governance
- **AND** it SHALL include the early units after `migrate-early-units-to-manifest-submission` is complete.

### Requirement: Runtime manifests reject unregistered module kinds
The course data-quality gate SHALL detect manifest modules that do not resolve to a canonical module class or approved migration alias.

#### Scenario: Unknown module kind fails
- **WHEN** the gate scans runtime manifests
- **AND** a module kind is not a canonical class and not present in the legacy alias map
- **THEN** the gate SHALL fail with the lesson id, step id, module id, and offending kind.

#### Scenario: Migrated lesson uses legacy alias
- **WHEN** a lesson is marked as migrated to standard modules
- **AND** its manifest still uses a legacy alias
- **THEN** the gate SHALL fail and identify the canonical replacement.

### Requirement: Module gates cover activity and compute contracts
The course data-quality gate SHALL reject modules whose declared behavior cannot be governed by the shared runtime contracts.

#### Scenario: Activity module lacks response contract
- **WHEN** an activity module or response-producing step is present
- **THEN** the gate SHALL verify that its response kind is registered
- **AND** objective response kinds SHALL expose enough metadata for scoring or explicit unsupported-scoring status.

#### Scenario: Compute panel lacks capability reference
- **WHEN** a module resolves to `compute.panel`
- **THEN** the gate SHALL require a registered compute capability reference or explicit migration exception
- **AND** the failure SHALL identify the missing reference.
