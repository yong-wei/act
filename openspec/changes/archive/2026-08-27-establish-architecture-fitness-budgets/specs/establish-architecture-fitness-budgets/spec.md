## Hard Dependencies

已 qualified 的 `enforce-modular-domain-dependency-contracts` 与 `split-production-tooling-test-typescript-graphs` 是本 capability 的硬前置；任一 graph、allowlist、owner 或 receipt drift/分母不完整时不得 qualify，依赖方向不回指本 capability。

## ADDED Requirements

### Requirement: Architecture fitness consumes one qualified dependency graph
Architecture fitness SHALL consume the qualified modular-domain dependency graph, reverse edges, SCCs, deep-import classifications, and allowlist rather than creating a parallel dependency authority.

#### Scenario: A fitness run starts
- **WHEN** the evaluator loads architecture inputs
- **THEN** it SHALL verify baseline, charter, dependency-contract, and TypeScript graph identities and declared denominators
- **AND** missing, drifted, mixed-worktree, or duplicate graph inputs SHALL fail qualification before a report is trusted.

#### Scenario: A new dependency violation appears
- **WHEN** a new forbidden edge, cross-domain deep import, feature-to-App Router edge, or SCC member is found
- **THEN** the fitness report SHALL include every relevant edge/member identity and owner
- **AND** the result SHALL fail unless the change removes or replaces the violation with the declared public contract.

### Requirement: Structural debt budgets are evidence-backed and monotonic
Dependency debt, SCCs, deep imports, feature-to-app edges, unowned exceptions, center-node growth, and registered oversized-file observations SHALL use qualified baselines and SHALL not silently increase.

#### Scenario: Existing debt is measured
- **WHEN** an unchanged baseline is evaluated
- **THEN** existing debt SHALL remain visible with its baseline identity, owner, consumers, reason, and deletion condition
- **AND** the report SHALL not claim that legacy code has been migrated merely because it is allowlisted.

#### Scenario: A structural metric grows
- **WHEN** the current revision adds an edge, SCC member, center reason, oversized file, or exception beyond the frozen baseline
- **THEN** the evaluator SHALL fail unconditionally
- **AND** a new exception, expanded pattern, added field, renamed record, owner transfer, or unowned allowlist entry SHALL not qualify the growth.

### Requirement: File-size and center-node budgets account for change reason
File-size and centrality observations SHALL be tied to source identity, dependency/caller evidence, change reason, owner, and deletion or split condition rather than an arbitrary universal threshold.

#### Scenario: A legitimate central entrypoint needs to change
- **WHEN** a shared entrypoint would grow for a documented runtime, framework, or contract reason
- **THEN** the evaluator SHALL fail if the frozen file-size or centrality metric grows
- **AND** the implementation SHALL use a compliant split/replacement or a separately authorized baseline revision rather than a new exception; an arbitrary threshold is not a substitute for the frozen metric.

#### Scenario: An undocumented center grows
- **WHEN** a file or node grows without a registered reason, owner, or removal condition
- **THEN** the fitness gate SHALL fail with the stable identity and missing evidence fields
- **AND** it SHALL not hide the growth by moving or re-exporting the file.

### Requirement: Compile-resource budgets use frozen measurement receipts
Compile memory, duration, file-count, cache, and platform observations SHALL be consumed through revision- and command-bound measurement receipts and SHALL remain distinguishable from deterministic source-derived fitness data.

#### Scenario: A cold production typecheck is measured
- **WHEN** a cold Web/worker/tool/test typecheck produces RSS or duration data
- **THEN** the fitness projection SHALL reference its immutable receipt identity, scope, source revision/tree, tool versions, and cache mode
- **AND** it SHALL not treat one machine's measurement as a universal constant.

#### Scenario: A graph improves but RSS varies
- **WHEN** source-derived graph scope decreases while a new machine reports a different RSS
- **THEN** the report SHALL preserve both the deterministic improvement and the variable observation
- **AND** it SHALL not reject the structural change solely because of an unqualified environment fluctuation.

### Requirement: The exception set only shrinks
The fitness exception set SHALL be inherited from the qualified upstream baseline and SHALL change only by deleting an entry or deleting it through a compliant replacement; this change SHALL not add entries, broaden patterns, or fill missing fields to bypass a failure.

#### Scenario: A new exception is requested
- **WHEN** a change requests a new exception for a necessary implementation or a frozen metric increase
- **THEN** the fitness gate SHALL fail unconditionally
- **AND** the request SHALL not be made compliant by adding an owner, evidence field, deletion condition, or broader pattern.

#### Scenario: An existing exception is removed compliantly
- **WHEN** a revision deletes an exception or replaces its violating edge with the declared compliant boundary
- **THEN** the exception set SHALL shrink and the report SHALL retain the deletion/replacement proof
- **AND** the revision SHALL not add another exception to compensate.

#### Scenario: An exception is widened or edited to bypass failure
- **WHEN** a revision broadens a pattern, adds a new entry, fills fields solely to bypass a failure, removes its deletion condition, or transfers ownership without deletion
- **THEN** the fitness gate SHALL fail
- **AND** it SHALL report the exact attempted change as an unqualified blocker.

### Requirement: Fitness output is deterministic and auditable
Fitness reports SHALL reconcile included, excluded, duplicate, unresolved, and qualified totals and SHALL be reproducible from one source identity plus frozen measurement receipt identities.

#### Scenario: A report is regenerated
- **WHEN** the same source-derived inputs and frozen receipts are projected twice
- **THEN** the normalized report SHALL be byte-identical with stable ordering
- **AND** a newly captured environment measurement SHALL create a new receipt rather than mutate the prior report inputs.

#### Scenario: A denominator is incomplete
- **WHEN** an edge, file, center, budget, or exception belongs to a declared scope but has no observation or justified exclusion
- **THEN** qualification SHALL fail with the stable item identity and scope
- **AND** the missing item SHALL not disappear from aggregate totals.
