## MODIFIED Requirements

### Requirement: Current-head evidence is bound to one clean source identity
The current-head consolidation delta SHALL be generated from one clean, committed source revision and SHALL record the current commit, current tree, capture time, predecessor baseline identity, schema version, command scope, and relevant tool versions. When consumed by the post-convergence A2 successor, the delta SHALL remain a separately identified historical predecessor input whose identity and digest are preserved; it SHALL not be replaced by, or silently merged into, the successor.

#### Scenario: Current-head evidence is accepted as a successor predecessor
- **WHEN** the successor capture loads a current-head package from its declared clean source identity
- **THEN** it SHALL verify and record the current-head package identity/digest, its predecessor baseline identity, source commit/tree, schema, command scope, and tool versions
- **AND** the successor SHALL retain the current-head package as historical input while assigning its own independent capture identity.

#### Scenario: Current HEAD is clean and resolvable
- **WHEN** the delta capture runs against a clean worktree whose Git commit and tree resolve
- **THEN** every emitted record and projection SHALL identify that commit and tree
- **AND** the predecessor baseline SHALL remain referenced as historical input rather than overwritten or activated.

#### Scenario: Capture identity is dirty or mixed
- **WHEN** the worktree is dirty, Git identity cannot be resolved, observations come from more than one revision/worktree, the source differs from the declared source, or the predecessor digest is missing/mismatched
- **THEN** qualification SHALL fail before writing a qualified delta or successor input
- **AND** the implementation SHALL report the unresolved identity/drift condition without substituting another revision or modifying historical artifacts.
### Requirement: Owner, retirement, and hotspot evidence share one bounded delta denominator
The delta SHALL combine owner conflicts, retirement candidates, and hotspot priorities in one normalized record set with stable record IDs, category, current-owner evidence, candidate target owner(s), consumer classification, deletion condition, rollback reference, and repository-relative evidence. It SHALL also expose payload-reference observations and the deterministic hotspot metric vector needed by the post-convergence successor, without creating a second census, fitness, receipt, quality, or payload registry.

#### Scenario: A cross-domain surface is inventoried
- **WHEN** routes, APIs, workers, scripts, tests, imports, persistence, registries, feature-to-App Router edges, deep imports, SCCs, public entrypoints, single-implementation interfaces, delegate-only wrappers, or zero callers indicate competing ownership or a migration-relevant hotspot
- **THEN** the record SHALL preserve all defensible candidate owners, production/test/tooling/dynamic-load/re-export consumers, trust boundary, deletion condition, rollback reference, and evidence references
- **AND** it SHALL distinguish an observation, ambiguity, or unresolved state from a blocking finding until a later owner decision proves the consequence.

#### Scenario: A hotspot is ranked for successor investigation
- **WHEN** the delta contributes a hotspot to the successor Top 50
- **THEN** it SHALL retain source bytes, function count, branch count, import breadth, fan-in/fan-out, declared change frequency, test density, trust density, metric scope, and stable tie-break identity
- **AND** a missing metric SHALL remain unresolved rather than being represented as zero or as a fitness failure.

#### Scenario: A retirement candidate has no safe deletion proof
- **WHEN** a facade, alias, bridge, old entrypoint, compatibility surface, shared library, or zero-caller candidate has a possible replacement but current consumer proof is incomplete
- **THEN** the record SHALL remain unresolved with an explicit deletion condition
- **AND** the delta SHALL not claim that the path is deletable, retired, or safe to remove.
### Requirement: Consumer and OpenSpec conflict evidence is current and classified
The delta SHALL enumerate production, test-only, toolchain, dynamic-load, re-export, documentation, and historical consumers for in-scope surfaces, and SHALL project overlap with current non-archived OpenSpec changes while treating archived artifacts as historical evidence only. It SHALL classify current runtime references and archive-only references as bounded payload evidence without interpreting them as authority or retention decisions.

#### Scenario: A production consumer is found
- **WHEN** a current route, worker, script, or production module imports, loads, re-exports, or calls an in-scope surface
- **THEN** the consumer SHALL appear with its repository-relative path and relationship kind
- **AND** the retirement or owner-residue record SHALL remain open until a later migration proves the required zero-production-consumer condition.

#### Scenario: A test, toolchain, dynamic, re-export, or documentation consumer is found
- **WHEN** an in-scope surface is referenced by tests, scripts/tooling, dynamic loads, re-exports, or documentation
- **THEN** the consumer SHALL retain its separate class and relationship and SHALL not be collapsed into a production consumer or ignored as noise
- **AND** a directory name alone SHALL not establish an active consumer.

#### Scenario: Only a historical artifact mentions a surface
- **WHEN** a surface is mentioned only by an archived change, closed Issue reference, historical test/documentation record, or archive-only runtime reference
- **THEN** the evidence SHALL be classified as historical or archive-only
- **AND** it SHALL not be used as proof of a current production consumer, implementation owner, payload authority, or deletion safety.

#### Scenario: Active changes overlap
- **WHEN** two or more current non-archived changes touch the same owner, contract, path, deletion set, or successor predecessor input
- **THEN** the conflict matrix SHALL record the change IDs, overlap kind, dependency/order implication, and resolution condition
- **AND** the capture SHALL not modify, claim, archive, activate, or use their existence as implementation proof.
### Requirement: Delta output is deterministic, portable, and privacy minimized
The qualified delta SHALL use stable ordering and repository-relative identities, reconcile discovered/represented/excluded/duplicate/unresolved totals for each declared slice, and exclude secrets, learner identifiers, raw answers/events, private content, media, screenshots, absolute machine paths, and unbounded command logs. Its observations SHALL be reproducible from one source identity and the same frozen predecessor inputs, and its compact projections SHALL be consumable by the successor through explicit locator/digest verification.

#### Scenario: Same source and inputs are captured twice
- **WHEN** the delta is generated twice from the same source identity and the same frozen predecessor inputs/receipts
- **THEN** the normalized package SHALL be byte-identical and equivalent records SHALL have stable IDs and ordering
- **AND** changing the source or predecessor input SHALL produce a distinct identity or fail closed rather than overwrite the prior package.

#### Scenario: Delta detail is kept outside the Git compact package
- **WHEN** the post-convergence successor indexes the delta
- **THEN** it SHALL record a logical local/CI locator, byte count, and SHA-256 for complete delta detail while retaining only bounded owner, hotspot, consumer, payload, and denominator aggregates in Git
- **AND** a missing, absolute, or digest-mismatched locator SHALL fail qualification rather than fall back to an unverified scan.

#### Scenario: Unsafe evidence is encountered
- **WHEN** a proposed record or projection contains forbidden content, a secret, a learner identifier, a raw payload, or an absolute machine-local path
- **THEN** qualification SHALL fail closed before the package is accepted
- **AND** the failure SHALL expose only a safe record identity and violation code.
### Requirement: Current-head capture is governance-only
The delta capture SHALL not change application behavior, tests, TypeScript programs, dependency rules, database state, runtime releases, production selectors, active baseline selectors, fitness budgets, test-command qualification, CI/runtime gates, or GitHub coordination state. It SHALL provide only a digest-bound, read-only historical input to the A2 successor and later B/C/D/N5 work.

#### Scenario: Capture completes
- **WHEN** the current-head package is written, verified, and consumed by the successor
- **THEN** only bounded evidence artifacts and their deterministic integrity metadata MAY change
- **AND** no product, release, database, deployment, production, baseline, charter, fitness, test-qualification, or coordination action SHALL be implied or performed.

#### Scenario: Downstream reader consumes the delta
- **WHEN** B, C, D, or N5 reads current-head owner, consumer, hotspot, OpenSpec, or payload observations
- **THEN** it SHALL require the exact current-head identity and digest recorded by the successor and fail closed on missing, stale, mixed, or drifted inputs
- **AND** owner adjudication, payload authority/materialization/retention, test disposition, fitness budget changes, and active-baseline activation SHALL remain outside the delta and A2 capture.
