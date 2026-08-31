# resource-eligibility-and-release-activation Specification

## Purpose

Define independent, context-bound resource eligibility dimensions and preserve the existing immutable release and activation authorities.

## ADDED Requirements

### Requirement: Eligibility dimensions remain independent

The system SHALL report retrieval readiness, path eligibility, formal binding, launch availability, formal release qualification, Teaching Projection activation, and named consumer activation as separate results with separate evidence and reasons. No aggregate readiness flag SHALL substitute for these dimensions.

#### Scenario: A resource is retrievable but not path-eligible

- **WHEN** a source has valid retrieval/citation evidence but no audited ResourceNode or PlanningUnit for the requested context
- **THEN** retrieval SHALL remain independently available
- **AND** path eligibility SHALL be `blocked` or `unavailable` with its own reason
- **AND** the resource SHALL not become a PathNode.

#### Scenario: A resource is bound but not activated

- **WHEN** an atomic formal binding is valid but its Teaching Projection or named consumer activation is absent or pinned
- **THEN** formal binding SHALL remain a separate observation
- **AND** activation SHALL remain not ready according to the existing activation contract.

### Requirement: Eligibility is specific to a caller context

Every eligibility evaluation SHALL include the applicable user/role, course and scope, purpose, stage, Authority/resource-index identity, requested revision, and launcher contract. The result SHALL carry a context identity and SHALL not be reused as a global resource decision.

#### Scenario: Teacher preview and student path differ

- **WHEN** a resource is visible to a teacher preview but its student role, course scope, or path stage is not authorized
- **THEN** the result SHALL distinguish the two contexts
- **AND** teacher visibility SHALL not make the student resource path-eligible or launchable.

#### Scenario: Recommendation is requested

- **WHEN** a recommendation caller asks whether a resource may be considered
- **THEN** the evaluator MAY return context-specific selectability
- **AND** it SHALL not rank or select the resource, promote a candidate, write a selector, or claim completion/mastery.

### Requirement: Formal qualification and activation retain their owners

Eligibility evaluation SHALL consume, but SHALL NOT replace or mutate, the existing formal binding, Runtime Release, Teaching Projection, and per-consumer activation readers and pointers. Formal release qualification SHALL remain stricter than ordinary browse or recommendation eligibility.

#### Scenario: Optional or NONE disposition is present

- **WHEN** a resource is marked `OPTIONAL` or `NONE` in a diagnostic or source record
- **THEN** that disposition MAY explain a non-formal unavailable result
- **AND** it SHALL not satisfy atomic binding, formal qualification, Teaching Projection activation, or consumer activation.

#### Scenario: Engineering-only consumer omits projection

- **WHEN** the existing consumer contract identifies a consumer as engineering-only
- **THEN** it MAY report Teaching Projection as not applicable
- **AND** that exception SHALL not be used for teaching-resource, path, or other consumers that require projection.

### Requirement: Identity and authorization drift fail closed

The evaluator SHALL verify source/index identity, content/version/hash/scope closure, current role permission, requested revision, retirement state, and source-owned launcher contract before returning an available formal or launch result. It SHALL not fall through to a candidate, Legacy, prior revision, guessed route, or stale descriptor.

#### Scenario: Resource index or revision drifts

- **WHEN** the RegistryIndex, Authority, resource content, course scope, launcher contract, or requested revision does not match
- **THEN** the affected dimension SHALL be unavailable or blocked with a bounded reason
- **AND** no stale launch, formal binding, or activation claim SHALL be returned.

#### Scenario: Resource is retired or unauthorized

- **WHEN** a resource is retired, outside the role's scope, or not permitted for the requested course
- **THEN** path, launch, and formal consumer dimensions SHALL fail closed
- **AND** the evaluator SHALL not disclose the hidden target or policy internals.

### Requirement: Optional ordinary surfaces degrade locally

Browse, recommendation, and optional card/media surfaces MAY omit an unavailable resource or return a bounded `degraded`/`unavailable` status. This behavior SHALL affect only the affected entry or block and SHALL not weaken formal or required-consumer gates.

#### Scenario: Optional media is missing

- **WHEN** base knowledge identity and topology are valid but an optional media or card projection is missing
- **THEN** the affected block SHALL be omitted or marked unavailable
- **AND** valid base knowledge details and unrelated resources SHALL remain readable.

#### Scenario: Formal package has a missing required atom

- **WHEN** a required resource atom lacks a formal binding, qualification, safe launcher, or matching revision
- **THEN** the formal dimension SHALL fail closed
- **AND** an optional status SHALL not convert the package to qualified.

### Requirement: Eligibility is observation-only

An eligibility evaluation SHALL not write selectors, activation pointers, release qualification records, candidate promotions, PathNodes, LearningFacts, completion, or mastery evidence. A launch/read event SHALL continue to follow its existing event and learning-record contracts.

#### Scenario: Caller receives an eligible result

- **WHEN** a caller receives `eligibleForContext: true` for a browse, recommendation, path, or launch context
- **THEN** no state mutation SHALL occur as a side effect
- **AND** any later selection, launch, assessment, or learning evidence SHALL require its own authorized contract.

### Requirement: Producer and caller denominator is closed

The implementation SHALL inventory every production/test/generated/compatibility producer and caller across routes, APIs, models, scripts, tests, and reverse/dynamic edges for all seven dimensions. Each old aggregate status retained during migration SHALL have an owner, replacement identity, consumer denominator, and deletion condition.

#### Scenario: An old readiness entry is replaced

- **WHEN** every classified caller uses the independent snapshot and rollback evidence is available
- **THEN** the old entry MAY become a deletion candidate
- **AND** it SHALL not be hidden behind a permanent facade or deleted before the R4 retirement gate.
