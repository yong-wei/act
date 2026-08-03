# versioned-knowledge-consumer-activation Specification

## Purpose
TBD - created by archiving change activate-versioned-knowledge-consumers. Update Purpose after archive.
## Requirements
### Requirement: Consumer readiness is explicit and independent
The system MUST evaluate readiness per named consumer and MUST record the exact Authority/Projection combination, artifact hashes, local dependency results, and status. Engineering consumers MAY be ready while affected teaching consumers are `PINNED_PREVIOUS` or `BLOCKED_LOCAL_DEPENDENCY`.

#### Scenario: Engineering consumer is unaffected
- **WHEN** the Authority Snapshot and Engineering RAG checks pass but a teaching binding is unresolved
- **THEN** Engineering Graph/RAG SHALL be eligible for `READY`
- **AND** affected teaching consumers SHALL remain pinned or blocked with exact reasons

#### Scenario: Local dependency fails
- **WHEN** a consumer lacks a required projection/card/prerequisite/resource artifact or identity match
- **THEN** that consumer SHALL be `BLOCKED_LOCAL_DEPENDENCY`
- **AND** no pointer update SHALL claim it is active

### Requirement: Activation stages complete immutable materialization
Before activation, the system MUST validate a complete staged Authority/Projection artifact set, cross-artifact identities, deterministic hashes, consumer resource routes, and readiness results. Partial or mixed-capture directories MUST fail closed.

#### Scenario: Staged set is complete
- **WHEN** all required artifacts and manifests match one capture and consumer combination
- **THEN** the activation manifest MAY be staged for atomic replacement

#### Scenario: Artifact is missing or mixed
- **WHEN** a staged file is absent, tampered, or from another Authority/Projection/capture
- **THEN** staging SHALL fail
- **AND** the current activation manifest SHALL remain unchanged

### Requirement: Activation pointer is atomic and reversible
The system MUST replace the activation manifest/pointer atomically and MUST retain the prior manifest as a digest-checked rollback target. Rollback MUST change only the pointer and MUST preserve immutable snapshots.

#### Scenario: Engineering-first switch
- **WHEN** Engineering Graph/RAG is ready and teaching consumers are pinned
- **THEN** one atomic manifest update SHALL activate only the ready consumers
- **AND** the manifest SHALL retain explicit prior combinations for pinned consumers

#### Scenario: Rollback is requested
- **WHEN** the current manifest and selected prior manifest digests match
- **THEN** rollback SHALL atomically restore the prior combinations
- **AND** it SHALL not delete or mutate either snapshot

### Requirement: Shadow checks do not mutate learning state
Shadow comparison MUST use representative graph, RAG, Konling, course, card, textbook, prerequisite, and path reads without writing LearningFacts, changing selectors outside the activation pointer, or publishing new teaching decisions.

#### Scenario: Shadow result differs
- **WHEN** old and new consumer responses differ in a material identity/readiness field
- **THEN** the consumer SHALL remain shadow/pinned and the discrepancy SHALL be recorded
- **AND** no learner state or upstream relation SHALL be changed

