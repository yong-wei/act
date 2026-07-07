## ADDED Requirements

### Requirement: Fixture readiness is scoped to fixture-owned governed resources
Canonical test-account fixture readiness SHALL be evaluated against the resource subset actually used by the fixture tests rather than the entire global resource backlog.

#### Scenario: Fixture subset is ready
- **WHEN** the canonical fixture account references a bounded set of graph nodes, path nodes, assessment items, citations, and evidence events
- **THEN** the helper SHALL verify citation, path, assessment, and source-event lineage readiness for that scoped subset
- **AND** unrelated global resource backlog rows SHALL remain reported as platform limitations rather than fixture blockers.

#### Scenario: Fixture subset is incomplete
- **WHEN** a resource, citation, path node, assessment item, or evidence event used by the fixture subset lacks reviewed governance
- **THEN** fixture generation SHALL remain blocked for that missing scoped requirement
- **AND** the helper SHALL report the exact scoped blocker.

#### Scenario: Global backlog remains incomplete
- **WHEN** fixture-owned resources are ready but global resource completeness remains incomplete
- **THEN** fixture output SHALL carry a limited-coverage diagnostic
- **AND** it SHALL NOT fabricate citations, path readiness, learner evidence, or completion state for resources outside the reviewed fixture subset.
