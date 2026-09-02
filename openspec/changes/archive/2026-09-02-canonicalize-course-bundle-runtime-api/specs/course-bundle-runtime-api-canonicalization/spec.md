# course-bundle-runtime-api-canonicalization Specification

## Purpose

Define the migration of runtime lesson and bound-resource consumers to the
existing CourseBundle implementation without changing CourseBundle,
Classroom, or manifest contracts.

## ADDED Requirements

### Requirement: Runtime reads have one canonical CourseBundle entrypoint

All production runtime lesson, manifest, handout, graph, media, textbook, and
bound-resource reads SHALL enter through the existing CourseBundle public
surface.  Internal filesystem readers and the superseded `course-runtime.ts`
entry SHALL not remain competing authorities after migration.

#### Scenario: A route loads a runtime lesson

- **WHEN** an entry, student, teacher, resource, or print route requests lesson
  content
- **THEN** it SHALL call the CourseBundle runtime read surface
- **AND** it SHALL not import an internal reader or query authoring content.

#### Scenario: A legacy import remains during migration

- **WHEN** the caller inventory is evaluated before deletion
- **THEN** each remaining old import SHALL have a named replacement, owner, and
  removal condition
- **AND** the old module SHALL not be declared retired until its required
  caller count is zero.

### Requirement: Runtime identity and hashes remain bound and immutable

Each canonical read SHALL resolve one canonical lesson id and preserve the
captured runtime release/tree locator, source revision, complete bundle digest,
per-resource hashes, identity-projection digest, and manifest hash whenever the
caller has a bundle or session binding.

#### Scenario: A session refreshes after publication

- **WHEN** a session-bound student or teacher refreshes a lesson
- **THEN** the read SHALL use the session's captured bundle revision and
  manifest hash
- **AND** it SHALL reject a changed or mismatched runtime artifact rather than
  silently selecting a newer release.

#### Scenario: A plan title or route alias changes

- **WHEN** a mutable title, route label, or alias differs from the captured
  identity
- **THEN** identity resolution SHALL continue from the canonical lesson id
- **AND** the read SHALL not infer a new bundle from that value.

### Requirement: Runtime reads remain on the published content boundary

The canonical runtime surface SHALL read only reviewed/published runtime
content, the active runtime release, or a bound blob locator.  It SHALL never
fall back from a missing or malformed runtime artifact to
`course-content/authoring/**` or to an unbound revision.

#### Scenario: A runtime artifact is missing

- **WHEN** a required runtime file cannot be resolved
- **THEN** the surface SHALL return the existing explicit unavailable or drift
  result
- **AND** it SHALL not expose authoring content as a substitute.

#### Scenario: An optional resource is missing

- **WHEN** an optional media or knowledge-card resource is unavailable
- **THEN** the base runtime lesson SHALL remain readable
- **AND** the missing resource status SHALL remain observable without changing
  the lesson identity.

### Requirement: Classroom and evidence ownership remains separate

Canonical runtime reads SHALL not implement Classroom authorization, session
lifecycle, live-state writes, submission evidence, teacher projection, or
Learning Record writes.  Response-producing steps SHALL continue through the
existing submission/evidence contract, while progress drafts use live state.

#### Scenario: A teacher previews a runtime lesson

- **WHEN** preview content is read without a student session
- **THEN** the read SHALL return the role-safe runtime projection
- **AND** it SHALL create no student state, submission, interaction log, or
  Learning Record evidence.

#### Scenario: A student submits a response step

- **WHEN** the runtime read supplies a response-producing step to the shared
  classroom shell
- **THEN** the shell SHALL keep durable submission evidence separate from live
  progress
- **AND** the runtime API SHALL remain read-only for that flow.

### Requirement: Canonicalization is qualified by caller and behavior evidence

The change SHALL record a closed caller inventory and compare representative
ordinary, session-bound, generated-courseware, optional-resource, missing, and
drift behaviors before deleting the old entrypoint.

#### Scenario: Qualification is requested

- **WHEN** the runtime API migration is reviewed
- **THEN** focused tests SHALL prove identity/hash preservation, source-boundary
  behavior, access delegation, and optional degradation
- **AND** the ledger SHALL bind results to one source revision.

#### Scenario: The old authority has a hidden caller

- **WHEN** static, dynamic, or bundle analysis finds a required old caller
- **THEN** qualification SHALL remain blocked
- **AND** the old authority SHALL remain explicitly transitional.
