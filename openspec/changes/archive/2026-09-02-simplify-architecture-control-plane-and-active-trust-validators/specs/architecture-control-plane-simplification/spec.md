## ADDED Requirements

### Requirement: Architecture control facts retain one authority-specific validator

Each census, charter/deprecation, dependency/fitness, quality/toolchain, QA, and release-trust fact SHALL be produced and validated by its existing authority-specific owner; consolidation SHALL remove duplicate implementations without creating a universal replacement authority.

#### Scenario: A control-plane result is consumed

- **WHEN** a command or aggregate needs an architecture, quality, toolchain, QA, or release-trust fact
- **THEN** it SHALL consume the owner-bound receipt with its source/schema/scope identity
- **AND** it SHALL not recompute or silently replace the fact in a parallel validator.

#### Scenario: Two validators appear equivalent

- **WHEN** before/after replay proves identical inputs, outputs, failures, privacy behavior, and authority scope
- **THEN** one existing owner SHALL become canonical and the duplicate MAY be deleted or reduced to a non-authoritative adapter
- **AND** a new all-purpose control plane SHALL not be introduced.

### Requirement: Active trust validation fails closed on identity and evidence drift

The control plane SHALL reject dirty or mixed worktrees, source commit/tree drift, schema/version mismatch, stale or duplicate receipts, denominator conflicts, unresolved owner/scope identity, and non-private output before qualifying a result.

#### Scenario: A receipt comes from a different source tree

- **WHEN** an input receipt, manifest, graph, or validator result differs from the declared source commit/tree or schema identity
- **THEN** the result SHALL be `unresolved` or otherwise non-qualified
- **AND** it SHALL not be used to authorize a release, rollback, deployment, or selector mutation.

#### Scenario: Denominator or privacy validation fails

- **WHEN** included/excluded/duplicate/unresolved totals do not reconcile or output contains credentials, absolute paths, raw payloads, learner identifiers, or provider internals
- **THEN** qualification SHALL fail closed
- **AND** the invalid output SHALL not be published as a trusted receipt.

### Requirement: Release and rollback keep one unique security authority

Exactly one existing release/rollback security validator SHALL decide selector/deployment safety; architecture, fitness, quality, toolchain, QA, and observation results SHALL remain evidence inputs and SHALL not authorize or mutate production state.

#### Scenario: A release is otherwise qualified

- **WHEN** architecture and quality receipts pass but the unique release/rollback security validator has not passed for the exact candidate identity
- **THEN** release or selector mutation SHALL be denied
- **AND** another qualified report SHALL not substitute for the security validator.

#### Scenario: An observation validator attempts a selector write

- **WHEN** a non-security validator, alias, or aggregate command attempts to deploy, mutate a selector, or grant rollback safety
- **THEN** the action SHALL be rejected
- **AND** the existing active and rollback identities SHALL remain unchanged.

### Requirement: Existing delivery gates and command boundaries survive simplification

Control-plane simplification SHALL preserve `verify:commit`, `verify:push`, `typecheck`, independent Web/worker/tool/test graph boundaries, PlatformSetting configuration, AppShell/role/SSR/R3F boundaries, and portable immutable receipts.

#### Scenario: A canonical gate runs after consolidation

- **WHEN** an operator or hook runs `verify:commit`, `verify:push`, or `typecheck`
- **THEN** the existing checks, graph scope, exit status, and failure propagation SHALL remain intact
- **AND** a wrapper SHALL not hide a failed graph or receipt.

#### Scenario: A UI or runtime consumes a control result

- **WHEN** a server-rendered or client surface reads an architecture/release projection
- **THEN** existing authorization, role projection, SSR/R3F dynamic boundary, and privacy contract SHALL remain in force
- **AND** control-plane output SHALL not become business or AI truth.

### Requirement: Simplification is proven by replay and deletion evidence

An alias, wrapper, normalization branch, or duplicate validator SHALL be removed only after before/after replay covers successful, failed, stale, conflict, privacy, ordering, side-effect, and rollback behavior.

#### Scenario: Replay detects a changed failure or security outcome

- **WHEN** deleting a candidate path changes status, failure code, receipt identity, privacy result, selector safety, or side effects
- **THEN** the deletion SHALL be rejected or revised
- **AND** tests SHALL not be weakened to accept the difference.

#### Scenario: A compatibility alias remains

- **WHEN** an operator or CI caller still requires a historical command shape
- **THEN** a thin alias MAY remain with explicit owner, passthrough semantics, non-authoritative status, and deletion condition
- **AND** it SHALL not create a second gate or validator.
