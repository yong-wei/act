# smart-courseware-editor-simplification Specification

## Purpose
TBD - created by archiving change simplify-smart-courseware-editor. Update Purpose after archive.
## Requirements
### Requirement: Smart courseware editing has one durable state authority

The smart courseware editor SHALL use the existing `src/lib/smart-courseware` domain/service projections as the authority for draft, job, module, revision, content hash, source-gap, review, and publication facts.

#### Scenario: Editor receives a server projection

- **WHEN** a teacher opens or refreshes a courseware draft
- **THEN** the editor SHALL render the server-owned projection and retain only transient UI state locally
- **AND** a derived local copy SHALL not become the value submitted for publication.

#### Scenario: A job or revision changes on the server

- **WHEN** generation, retry, module regeneration, review, or publication changes the canonical projection
- **THEN** the editor SHALL reconcile with the current service result
- **AND** a stale local snapshot SHALL not overwrite the newer revision or hash.

### Requirement: Document edits reuse the existing preparation editor contract

Courseware document fields SHALL use the existing preparation document editor and save/conflict coordinator, without introducing a second document store, editor workspace, or persistence path.

#### Scenario: Teacher edits and saves a module or outline

- **WHEN** an authorized teacher changes courseware document content
- **THEN** the existing editor contract SHALL validate, save, and report the same optimistic-version/conflict behavior
- **AND** the editor SHALL preserve the draft identity.

#### Scenario: A save conflicts with a newer revision

- **WHEN** the server rejects a stale expected version
- **THEN** the editor SHALL show the existing conflict/recovery flow
- **AND** it SHALL not silently merge or discard canonical content through a new local adapter.

### Requirement: Simplification preserves courseware lifecycle and role projections

Deleting derived state or aliases SHALL preserve generation, validation, review, source-gap acknowledgement, publication, student-safe preview, classroom binding, idempotency, retry/resume, and role authorization semantics.

#### Scenario: Teacher publishes a reviewed draft

- **WHEN** all existing deterministic gates and acknowledgements pass for the current draft hash
- **THEN** publication SHALL create the same immutable courseware revision and projection as before
- **AND** AI/provider output or editor-local state SHALL not authorize publication.

#### Scenario: Student opens a preview

- **WHEN** a student requests the courseware projection
- **THEN** the existing student-safe manifest and AI notice SHALL be returned
- **AND** teacher answers, source-gap audit, provider audit, raw payload, and editor controls SHALL remain hidden.

### Requirement: Courseware editor simplification is behavior-preserving

The implementation SHALL document before/after state ownership and SHALL delete a derived or alias path only when characterization tests cover its observable output, side effects, errors, ordering, and role/privacy behavior.

#### Scenario: A proposed simplification changes a test-visible behavior

- **WHEN** a deletion causes a focused before/after test to differ
- **THEN** the deletion SHALL be rejected or revised
- **AND** tests SHALL not be weakened merely to accept the new behavior.

#### Scenario: A retained compatibility adapter is necessary

- **WHEN** an existing caller still requires a historical payload shape
- **THEN** one bounded non-authoritative adapter MAY remain
- **AND** it SHALL have an owner and deletion condition and SHALL not create a second courseware authority.

