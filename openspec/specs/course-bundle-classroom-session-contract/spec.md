# course-bundle-classroom-session-contract Specification

## Purpose
TBD - created by archiving change define-course-bundle-classroom-session-contract. Update Purpose after archive.
## Requirements
### Requirement: Bundle revisions are identity-complete and immutable

The system SHALL represent each published course bundle revision with a stable
bundle identity, canonical lesson id, bundle revision, exact runtime release
identity and tree/object locator, complete bundle digest, required per-resource
hashes, runtime source revision, identity-projection digest, and manifest hash.
The complete digest MUST cover the canonical bytes of the formal lesson,
manifest, handout, graph-overlay, knowledge-card, and media bundle content;
per-resource hashes MUST identify those resources where present. Once
referenced by a classroom session, the revision SHALL NOT be mutated in place.

#### Scenario: A bundle revision is qualified

- **WHEN** a runtime bundle is admitted for classroom use
- **THEN** it MUST expose one canonical lesson identity, revision, exact runtime
  release/tree/object locator, complete bundle digest, required per-resource
  hashes, runtime source revision, identity-projection digest, and manifest hash
- **AND** the identity fields MUST be internally consistent and persistable as
  one revision record.

#### Scenario: A referenced revision is changed

- **WHEN** content, manifest, runtime release locator, complete digest,
  per-resource hash, or identity fields would change for a revision already
  bound to a session
- **THEN** the write MUST be rejected or published as a new revision
- **AND** the previously bound session MUST continue to reference its original
  values.

### Requirement: New classroom sessions capture one bundle revision

Every newly created `ClassSession` SHALL capture an immutable CourseBundle
revision, exact runtime release/tree/object locator, complete bundle digest,
required per-resource hashes, and manifest hash in the same
application/database boundary as session creation. The existing
`LessonPlan`/BOPPPS relation and generated courseware publication binding SHALL
remain available for their current roles.

#### Scenario: An ordinary runtime-first session is created

- **WHEN** a caller starts a classroom from an ordinary lesson plan
- **THEN** creation MUST resolve one qualified CourseBundle revision and persist
  its identity, exact release locator, complete digest, required resource
  hashes, revision, and manifest hash on the session
- **AND** a later plan-title change MUST NOT change the session identity.

#### Scenario: A generated-courseware session is created

- **WHEN** a caller starts a generated-courseware publication
- **THEN** the session bundle revision, exact runtime release/tree/object
  locator, complete digest, required resource hashes, and manifest hash MUST
  match the publication revision
- **AND** a mismatch MUST fail closed before the session is created.

### Requirement: Runtime identity projection is self-sufficient

The runtime bundle SHALL contain the lesson identity projection and exact
release/object locator required by classroom/runtime readers. Every
session-bound runtime reader MUST use only the captured CourseBundleRevision
binding and its release/object locator, complete digest, and per-resource
hashes; it MUST NOT select the active runtime release, read
`course-content/authoring/**`, or depend on an authoring-only identity map or
mutable title.

#### Scenario: Runtime content is loaded for a bound session

- **WHEN** a classroom page loads its lesson manifest, graph, handout, media, or
  knowledge-card projection
- **THEN** the reader MUST use the captured bundle revision and exact runtime
  release/object locator for every formal resource
- **AND** it MUST NOT resolve identity from an active release, authoring file,
  mutable title, or unbound current path.

#### Scenario: The active runtime release changes after session creation

- **WHEN** the active runtime release/tree/object locator is switched after an
  ordinary session has been created
- **THEN** the bound session MUST continue reading its captured release/object
  locator and complete bundle digest
- **AND** its lesson, manifest, handout, graph-overlay, knowledge-card, and
  media hashes MUST remain those captured at session creation.

#### Scenario: A generated-courseware session follows its captured release

- **WHEN** the active runtime release/tree/object locator is switched after a
  generated-courseware session has been created
- **THEN** the session MUST continue reading the captured publication-linked
  release/object locator, complete bundle digest, and manifest hash
- **AND** publication revision and required resource hashes MUST remain bound to
  the original session identity.

#### Scenario: Runtime identity projection is incomplete

- **WHEN** a runtime bundle lacks a canonical identity, revision, exact release
  locator, complete digest, required resource hash, or manifest hash
- **THEN** qualification MUST fail with the missing field
- **AND** the classroom MUST NOT silently substitute an active release, plan
  title, or another runtime directory.

### Requirement: Aliases are bounded ingress metadata, not session authority

The canonical identity resolver MAY accept explicitly registered route, preset,
runtime, evidence, or plan-title aliases for ingress, but a plan title or alias
MUST NOT be persisted or used as the authoritative identity of a new session.

#### Scenario: A registered alias is used at ingress

- **WHEN** a caller provides a registered alias
- **THEN** the resolver MUST return one canonical identity and matched alias
  family before session creation
- **AND** the session MUST persist the canonical bundle revision instead of the
  alias string.

#### Scenario: An unknown or ambiguous alias is used

- **WHEN** an alias is unknown, ambiguous, or maps to a different bundle
- **THEN** resolution MUST return an explicit failure
- **AND** no session MUST be created with a guessed identity.

### Requirement: Optional projections preserve bound identity

Lesson, manifest, handout, graph-overlay, media, and knowledge-card projections
associated with a classroom bundle SHALL carry or verify the same bundle
revision, exact runtime release/object locator, complete bundle digest, and
required per-resource hash. Missing optional projections MAY degrade the
presentation, but bundle or resource identity drift MUST fail closed.

#### Scenario: Optional media or card is missing

- **WHEN** the bound revision is valid but an optional media or knowledge-card
  projection is unavailable
- **THEN** the base lesson MUST remain renderable
- **AND** the missing surface and reason MUST be observable without changing the
  session identity.

#### Scenario: An optional projection belongs to another revision

- **WHEN** a lesson, manifest, handout, graph-overlay, media, or knowledge-card
  projection has a mismatched bundle, release locator, complete digest, or
  resource hash
- **THEN** it MUST be rejected as identity drift
- **AND** the system MUST NOT display it as a soft missing resource.

### Requirement: Legacy and drifted sessions are explicit

Sessions created before the immutable binding exists SHALL be classified as
legacy/incomplete when read or reported. The system MUST NOT perform a blanket
title-based backfill or silently rebind historical session identity.

#### Scenario: A legacy session is read

- **WHEN** a historical session has no complete bundle binding
- **THEN** the response/report MUST expose its legacy/incomplete classification
- **AND** compatibility behavior MUST not claim a qualified immutable identity.

#### Scenario: A bound session drifts

- **WHEN** stored binding fields disagree with the referenced revision or runtime
  manifest
- **THEN** the read or qualification MUST fail closed with a drift reason
- **AND** it MUST NOT select the current plan or title as a replacement.

### Requirement: Identity denominator and migration evidence are closed

The implementation SHALL maintain a revision-bound denominator covering every
`ClassSession` writer/reader, runtime-first identity surface, active-release
lookup, exact release/tree/object locator, complete bundle digest, per-resource
hash, generated-courseware launcher, lesson/manifest/handout/graph-overlay/
media/knowledge-card lookup, authoring/title fallback, and legacy session
class. A migration entry MUST name its owner, replacement, deletion condition,
and evidence.

#### Scenario: The denominator is qualified

- **WHEN** bundle/session migration is reviewed
- **THEN** static callers, dynamic/browser entry points, and persistence readers
  MUST reconcile to one inventory
- **AND** the observed 32 runtime-first families and approximately 96 private
  route surfaces MUST be represented or explicitly explained by the frozen
  revision-bound inventory.

#### Scenario: A fallback consumer remains untracked

- **WHEN** an authoring/title fallback or direct session writer is absent from
  the migration ledger
- **THEN** qualification MUST fail
- **AND** the fallback MUST NOT be considered retired.

### Requirement: Bundle/session verification includes browser evidence

The contract SHALL be verified by focused identity/schema/concurrency tests,
affected Course/Classroom tests, and browser acceptance for ordinary and
generated-courseware sessions.

#### Scenario: Bound session is refreshed after release and plan changes

- **WHEN** teacher and student refresh a session after the plan title or alias
  changes and the active runtime release/tree/object locator is switched
- **THEN** both MUST render the original bundle revision, captured release
  locator, complete bundle digest, manifest hash, and required resource hashes
- **AND** the identity MUST match the characterization receipt.

#### Scenario: Strict validation is run

- **WHEN** `openspec validate define-course-bundle-classroom-session-contract
  --type change --strict` and `git diff --check` are run
- **THEN** the change MUST pass with its denominator, characterization, migration,
  and ledger artifacts present.

