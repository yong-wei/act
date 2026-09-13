## MODIFIED Requirements

### Requirement: Consumer readiness is explicit and independent
The system MUST evaluate readiness per named consumer and MUST record the exact Authority/Projection/binding-release combination, artifact hashes, local dependency results, and status. Engineering consumers MAY be ready while affected teaching consumers are `PINNED_PREVIOUS` or `BLOCKED_LOCAL_DEPENDENCY`. Resource-consuming teaching consumers (course-runtime, Konling, learning-path, teaching-resource RAG) MUST treat the anchored resource binding release as a local dependency.

#### Scenario: Engineering consumer is unaffected
- **WHEN** the Authority Snapshot and Engineering RAG checks pass but a teaching binding is unresolved
- **THEN** Engineering Graph/RAG SHALL be eligible for `READY`
- **AND** affected teaching consumers SHALL remain pinned or blocked with exact reasons

#### Scenario: Local dependency fails
- **WHEN** a consumer lacks a required projection/card/prerequisite/resource artifact, binding release, or identity match
- **THEN** that consumer SHALL be `BLOCKED_LOCAL_DEPENDENCY`
- **AND** no pointer update SHALL claim it is active

#### Scenario: Binding release gate did not pass
- **WHEN** the staged binding release `gate.json` is not `passed`
- **THEN** resource-consuming teaching consumers SHALL be `BLOCKED_LOCAL_DEPENDENCY` with reason `binding-gate-failed`

### Requirement: Activation stages complete immutable materialization
Before activation, the system MUST validate a complete staged Authority/Projection/binding-release artifact set, cross-artifact identities, deterministic hashes, consumer resource routes, and readiness results. The staged binding release MUST reference the same Authority release as the combination and its media `sha256` set MUST match the activated runtime release manifest. Partial or mixed-capture directories MUST fail closed.

#### Scenario: Staged set is complete
- **WHEN** all required artifacts and manifests match one capture, one Authority, one projection, and one binding release
- **THEN** the activation manifest MAY be staged for atomic replacement

#### Scenario: Artifact is missing or mixed
- **WHEN** a staged file is absent, tampered, or from another Authority/Projection/binding-release/capture
- **THEN** staging SHALL fail
- **AND** the current activation manifest SHALL remain unchanged

#### Scenario: Binding media identity drifts from the runtime release
- **WHEN** a staged binding anchors media whose `sha256` differs from the activated runtime release manifest
- **THEN** staging SHALL fail with `binding-media-drift`
