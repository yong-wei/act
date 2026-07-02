## ADDED Requirements

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
