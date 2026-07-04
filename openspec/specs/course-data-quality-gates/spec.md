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

### Requirement: Standard module gates are strict
The course data-quality gate SHALL fail on every unregistered module class, unregistered response kind, or missing compute capability reference in new or migrated lessons.

#### Scenario: Unregistered module fails
- **WHEN** the strict gate scans runtime manifests
- **AND** a module kind is not a canonical module class
- **THEN** the gate SHALL fail with the lesson id, step id, module id, and offending kind.

#### Scenario: Unregistered response fails
- **WHEN** the strict gate scans response-producing activity cards
- **AND** a response kind is not canonical
- **THEN** the gate SHALL fail with the lesson id, step id, card id, and offending response kind.

#### Scenario: Missing compute capability fails
- **WHEN** the strict gate scans a `compute.panel`
- **AND** no registered capability reference is present
- **THEN** the gate SHALL fail unless an explicitly documented historical compatibility exception applies.

### Requirement: Non-interactive pages omit generic interaction status modules
The course data-quality gate SHALL prevent standard interactive lessons from rendering generic page interaction status modules on pages that have no learner interaction.

#### Scenario: Non-interactive page has a status module
- **WHEN** a runtime manifest step has no response-producing activity and its interaction kind is `none`, `display`, or another non-interactive value
- **AND** the step declares or renders a generic page interaction status module
- **THEN** the gate SHALL fail with the lesson id, step id, and module id or rendered marker.

#### Scenario: Interactive page keeps activity state
- **WHEN** a runtime manifest step contains a response-producing activity, controlled reveal, or teacher-released activity
- **THEN** the gate SHALL allow activity state, answer state, release state, and evidence markers that are tied to the actual activity
- **AND** it SHALL NOT allow a generic status module as a substitute for the activity contract.

#### Scenario: Unit 1-1 non-interactive pages are scanned
- **WHEN** the no-interaction status gate runs for Unit 1-1
- **THEN** pages without interactions SHALL not include visible "本页互动状态" style text or equivalent generic status chrome.

### Requirement: Data completeness helper reports graph-resource-learner readiness
The system SHALL provide a read-only data completeness helper for agents and reviewers to evaluate whether graph, resource, citation, path-planning, and learner-state data are complete enough for governed platform flows.

#### Scenario: Completeness helper runs
- **WHEN** the helper is executed against the current project data
- **THEN** it SHALL report layer-specific totals and blockers for knowledge graph core data, ResourceNode/resource binding data, citation and retrieval readiness, path-planning readiness, source-event lineage readiness, and learner fixture readiness
- **AND** it SHALL emit machine-readable JSON with stable ids for incomplete records.

#### Scenario: Helper distinguishes readiness dimensions
- **WHEN** a resource is citation-ready but not path-eligible
- **THEN** the helper SHALL report citation readiness separately from path readiness
- **AND** it SHALL not treat retrieval chunks, segments, or provisional metadata as substitutes for audited PlanningUnits.

#### Scenario: Helper is read-only
- **WHEN** the helper inspects database records, runtime artifacts, graph-center coverage, or student evidence caches
- **THEN** it SHALL NOT create, update, delete, or merge any production or fixture data
- **AND** it SHALL report the exact follow-up work bucket required to resolve blockers.

#### Scenario: Source evidence lineage is audited
- **WHEN** the helper evaluates learner-state or fixture readiness
- **THEN** it SHALL verify source event ids, client event ids, attempt keys, source log references, event timestamps, batch processing state, EventDictionary mapping, LearningFact materialization coverage, dedupe keys, and attribution metadata where applicable
- **AND** it SHALL report broken lineage separately from missing derived records.

#### Scenario: Helper output is privacy minimized
- **WHEN** the helper emits JSON or Markdown output
- **THEN** it SHALL redact or hash direct student identifiers by default
- **AND** it SHALL NOT include raw answer text, raw event payloads, raw resource content, private memory content, or hidden evaluation internals.

#### Scenario: Canonical fixture account is audited
- **WHEN** the helper audits a named canonical fixture account such as Yang Fan
- **THEN** it SHALL report canonical identity, duplicate-account candidates, LearningFact coverage, KnowledgeProgress coverage, path execution evidenceRefs, adaptive assessment state, StudentEvidenceFeatureCache source coverage, and fixture-generation blockers.

### Requirement: Data completeness helper audits resource disposition coverage
The data completeness helper SHALL report whether all discovered resources have a reviewed path-planning disposition before full resource coverage can be accepted.

#### Scenario: Full resource coverage audit runs
- **WHEN** the helper audits graph, resource, citation, path-planning, evidence-lineage, and learner-fixture readiness
- **THEN** it SHALL also report resources missing path-planning disposition, reviewed semantic fields, parent planning-unit links, or exclusion rationale
- **AND** it SHALL keep these findings separate from citation readiness and retrieval indexing.

### Requirement: Assessment item semantic coverage is gated
The course data-quality gates SHALL report assessment item semantic coverage before items are used for adaptive path readiness or checkpoints.

#### Scenario: Semantic gate runs
- **WHEN** assessment item governance checks run
- **THEN** they SHALL report missing review decisions, missing LearningGoal bindings, missing K/A/Q objective ids, missing graph-node refs, missing difficulty or cognitive level, missing misconception/remediation refs, stale source hashes, and invalid path eligibility
- **AND** they SHALL fail or block path eligibility according to the configured severity.

#### Scenario: Item is unreviewed
- **WHEN** an item is registered but lacks a valid manual semantic review decision
- **THEN** the gate SHALL keep it visible in backlog output
- **AND** it SHALL NOT allow the item to satisfy readiness, checkpoint, remediation gate, or terminal-validation requirements.

### Requirement: Resource completion helper emits claimable workqueues
The data completeness helper SHALL emit stable workqueues for staged human completion of resource metadata and semantic review.

#### Scenario: Workqueues are generated
- **WHEN** the helper evaluates graph, resource, citation, path-planning, assessment, evidence-lineage, and learner fixture readiness
- **THEN** it SHALL emit machine-readable workqueues grouped by source family, LearningGoal, graph domain, missing-field code, primary follow-up bucket, and dependency state
- **AND** every workqueue item SHALL include stable resource id, source family, current blockers, suggested reviewer action, version or source hash where available, and privacy-minimized display fields.

#### Scenario: Workqueue totals reconcile
- **WHEN** reviewer-facing queues are emitted
- **THEN** queue totals SHALL reconcile with helper layer totals, follow-up bucket counts, and field-completion audit totals
- **AND** a resource SHALL appear in one primary completion queue unless a secondary dependent queue is explicitly marked.

#### Scenario: Human-confirmed rows are integrity checked
- **WHEN** helper output marks semantic fields as human-confirmed
- **THEN** the helper SHALL require reviewer identity, reviewer role, reviewed time, source hash or source version, reviewer-visible rationale, and separate human-review evidence where applicable
- **AND** script constants, generated suggestions, placeholder reviewer ids, or missing source-version evidence SHALL NOT satisfy fresh human review.

