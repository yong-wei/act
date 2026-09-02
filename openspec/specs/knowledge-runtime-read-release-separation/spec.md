# knowledge-runtime-read-release-separation Specification

## Purpose
Keep product knowledge/resource runtime reads on existing active contracts. Release, qualify, cutover and compatibility writers stay independently owned tools; compatibility slices retire only with zero-consumer evidence.
## Requirements
### Requirement: Knowledge runtime reads do not import release writers
Product knowledge and resource runtime readers SHALL use the existing active read contracts, typed projections, resource index/eligibility readers and safe launch descriptors. They SHALL NOT import or execute content export, bundle publication, qualification, cutover, rollback or compatibility-writer implementations.

#### Scenario: Active read is served
- **WHEN** a student, teacher or administrator requests the active knowledge/resource workspace
- **THEN** the product graph SHALL resolve only the existing active read path and generated runtime artifacts
- **AND** it SHALL preserve role isolation, snapshot/projection/hash validation and bounded unavailable states without requiring a release writer.

#### Scenario: Read artifact is drifted
- **WHEN** an active manifest, projection, shard or resource identity does not match its declared hash/revision
- **THEN** the read path SHALL fail closed with the existing bounded drift/unavailable result
- **AND** removing a release-tool import SHALL not turn the mismatch into an empty or guessed response.

### Requirement: Release and activation tooling remain independently owned
Content export, knowledge publication, Teaching Projection generation, Runtime Release publication, activation and rollback SHALL remain independently runnable tool entries with their existing manifests, receipts and validators. The product application SHALL not require their writer modules to render an already selected runtime.

#### Scenario: Toolchain is run outside the web graph
- **WHEN** an operator runs a declared content, knowledge or runtime release verification command
- **THEN** the command SHALL execute through its single registered tool entrypoint
- **AND** the product application graph SHALL not be imported as a hidden writer dependency.

#### Scenario: Publication is not activation
- **WHEN** a release tool produces a qualified immutable artifact
- **THEN** it SHALL leave active/rollback selectors unchanged
- **AND** a separate existing activation contract SHALL remain responsible for any production selection.

### Requirement: Compatibility slices require verified retirement evidence
Each knowledge/runtime compatibility slice SHALL have an owner, source revision, real consumers, replacement identity, rollback decision and deletion condition. A slice SHALL be deleted only after a revision-bound zero-production-and-operator-consumer proof and replacement/rollback verification; a test-only or historical reader SHALL be classified separately rather than silently counted as active.

#### Scenario: Slice has no remaining consumer
- **WHEN** all production and operator callers resolve through the replacement and the rollback proof passes
- **THEN** the compatibility implementation and duplicate tests MAY be deleted
- **AND** the retirement receipt SHALL preserve the source identity, replacement identity and tested rollback commit.

#### Scenario: Slice still serves rollback or migration
- **WHEN** a compatibility entry is needed by a supported rolling deployment, cross-version rollback or historical audit
- **THEN** it SHALL remain explicitly retained with its owner and deletion condition
- **AND** the project SHALL not claim that compatibility retirement is complete.

### Requirement: Active Authority and role boundaries are not altered by separation
Read/tool separation SHALL preserve active/hash/rollback identity, candidate-versus-production isolation, role-scoped data access and fail-closed publication semantics. This change SHALL NOT modify Authority selectors, domain shards, ActKG/Teaching Projection schemas or production Authority.

#### Scenario: Unauthorized role requests a diagnostic or release identity
- **WHEN** a student or teacher requests candidate/legacy diagnostics or release/tooling identity
- **THEN** the existing role policy SHALL deny or redact it
- **AND** the read/tool split SHALL not introduce a fallback through a compatibility helper.

#### Scenario: Active rollback remains available
- **WHEN** an active runtime read fails and the operator invokes the existing rollback procedure
- **THEN** rollback SHALL select the previously verified immutable identity through its existing authority
- **AND** this change SHALL not rewrite or synthesize a selector.

