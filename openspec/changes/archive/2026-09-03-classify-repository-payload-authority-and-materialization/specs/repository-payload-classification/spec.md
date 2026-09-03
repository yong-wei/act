# repository-payload-classification Specification

## ADDED Requirements

### Requirement: Classification is gated by A's immutable successor capture

The change SHALL permit claim, apply, implementation, and classification only
after the parent coordination layer verifies from live Issue state that Issue
#1876 is closed, carries `status:archived`, and has its native `blockedBy`
dependency resolved. The classifier SHALL consume A's exact immutable
successor subject identity and capture digest. A local change name, a directory
listing, or a working-tree snapshot SHALL NOT substitute for that handoff.

#### Scenario: A gate or successor handoff is incomplete

- **WHEN** Issue #1876 is open, lacks `status:archived`, retains its native
  `blockedBy`, or A's successor subject identity or digest is missing, stale, or
  unreadable
- **THEN** C claim/apply/implementation/classification SHALL be blocked before
  a qualified output is written
- **AND** the result SHALL identify a bounded gate or handoff reason without
  inventing a successor identity

#### Scenario: A handoff is complete

- **WHEN** the parent gate proves all required Issue state and supplies one
  schema-valid A successor capture with its subject identity and digest
- **THEN** every C output SHALL bind that exact identity and digest
- **AND** C SHALL read the declared capture artifacts without rewriting A or
  treating C as a replacement capture

### Requirement: The scope denominator is closed and revision-bound

The classifier SHALL use the exact entry set and family declarations from A's
captured subject, source revision/tree, and denominator digest. The minimum
scope SHALL include `course-content/**/releases/**`,
`course-content/runtime/**`, `artifacts/**`, `docs/architecture/*.json`,
`openspec/changes/archive/**/evidence/**`, WASM/package/generated assets,
large fixtures/snapshots, and every large infograph, PPTX, PPM, EMF, GLB, and
JSON family actually discovered by A. It SHALL record discovered,
`qualified`, `justified-excluded`, and `unresolved` member totals for each
slice, with duplicate groups/member references reported separately, and those
totals SHALL reconcile.

#### Scenario: A scoped entry is classified

- **WHEN** an entry belongs to a declared A scope slice
- **THEN** it SHALL occur exactly once with exactly one member disposition from
  `qualified | unresolved | justified-excluded`, a stable identity, and a
  content hash/size
- **AND** duplicate membership SHALL be a separate observation and SHALL NOT
  become a fourth disposition or reduce the denominator

#### Scenario: Generated or untracked input is observed

- **WHEN** a generated, ignored, untracked, or runtime-created input is needed
  by a scoped record
- **THEN** it SHALL be recorded separately as a generated-input observation
  with producer/version, class, digest, and source identity
- **AND** it SHALL not change the captured tracked denominator or its count

#### Scenario: Proposal-time size observations differ from the capture

- **WHEN** observed byte totals or duplicate-candidate counts differ between
  the proposal and A's successor capture
- **THEN** qualification SHALL use the captured denominator and evidence only
- **AND** no proposal-time size or duplicate value SHALL be treated as a
  hardcoded acceptance threshold

### Requirement: Classifier and subject identities are independent and drift-fenced

When a classifier or validator is implemented, it SHALL first record one clean
tool checkpoint containing `toolCommit`, `toolTree`, `schemaVersion`, and an
entry-bundle digest. It SHALL then classify the independent A subject artifact
using frozen input digests. Deterministic output SHALL be required only when
the subject identity, classifier/tool identity, schema, and frozen inputs all
match. Drift of either identity or any frozen input SHALL fail closed.

#### Scenario: The same frozen subject and tool are classified twice

- **WHEN** the A subject identity/digest, tool commit/tree, schema, entry-bundle
  digest, and all frozen input digests are equal
- **THEN** canonical records and compact projections SHALL be byte-identical
- **AND** the second run SHALL not require a new authority or alter the first
  result

#### Scenario: Subject or tool identity drifts

- **WHEN** the A subject, capture digest, tool commit/tree, schema,
  entry-bundle digest, or frozen evidence input differs during classification
- **THEN** the run SHALL fail closed before a qualified result is published
- **AND** it SHALL not relabel the drifted result as an update to the previous
  package

### Requirement: Qualified records use one primary class and retain orthogonal facets

Every record SHALL bind a stable path or homogeneous family identity, member
content hash or family digest, non-negative safe-integer size, A subject
identity, producer/reproducibility evidence, production/test/tool/documentation
and dynamic consumers, authority/manifest evidence, retention/privacy state,
and materialization/recovery/rollback conditions. Every denominator member SHALL
have exactly one `memberDisposition` from `qualified | unresolved |
justified-excluded`. Only a `qualified` member SHALL have a primary class;
unresolved and justified-excluded members SHALL keep `primaryClass: null` and
their bounded evidence/reason.

A qualified record SHALL have exactly one mutually exclusive `primaryClass`
from this closed set: **A** hand-authored source of truth; **B** reproducible
generated output; **C** immutable release/rollback artifact; **D** ephemeral QA
evidence; **E** cache/materialized view; or **F** regulated/privacy-sensitive
evidence. The classifier SHALL retain orthogonal facets for
authorship/reproducibility, release/rollback role, QA role,
cache/materialized role, privacy, and retention rather than encoding those
facts only in the primary class.

After privacy and all critical evidence are known, primary selection SHALL use
the deterministic priority `F > C > D > E > A > B`: confirmed sensitive or
regulated privacy selects F; a proven immutable release/rollback role selects
C; ephemeral QA selects D; cache/materialized selects E; hand-authored
authority selects A; and reproducible generated output selects B when no higher
signal exists. Existing QA/runtime contracts remain independent dimensions and
do not define a cross-class precedence.

#### Scenario: Evidence supports one class

- **WHEN** all required evidence for a record supports one member of A-F and
  privacy/critical evidence is known
- **THEN** the record SHALL be `qualified` with exactly one `primaryClass` and
  SHALL retain every non-primary facet and authority/rollback fact
- **AND** the compact index SHALL preserve evidence references without copying
  the payload body

#### Scenario: Overlapping roles use fixed precedence

- **WHEN** fixtures contain D+F, B+C, B+E, or A+F evidence combinations
- **THEN** their primary classes SHALL be F, C, E, and F respectively
- **AND** the facets SHALL still retain both source roles, reproducibility,
  release/rollback, QA, cache/materialized, privacy, and retention facts

#### Scenario: Evidence is insufficient or conflicting

- **WHEN** privacy is unknown or required authority, provenance, consumer,
  retention, materialization, recovery, or rollback evidence is missing or
  conflicting
- **THEN** the member SHALL be `unresolved` with `primaryClass: null` and a
  bounded reason code before class precedence is applied
- **AND** `unresolved` SHALL be a status that blocks the affected slice, not a
  seventh class and not a forced A-F assignment

### Requirement: Authority, provenance, and consumers are explicit

The classifier SHALL distinguish canonical source, production authority,
candidate/staged release, rollback identity, and historical evidence. It SHALL
enumerate required and optional production, test, tool/script, documentation,
and dynamic consumers, including import, path-read, manifest, worker, service,
CI, and runtime-discovered edges where applicable. A directory name, version
number, equal hash, or current application HEAD SHALL not establish authority.
Unknown remote production or OSS consumers, selectors, or lifecycle facts SHALL
remain unresolved.

#### Scenario: A candidate release is present

- **WHEN** a staged or qualified candidate has a manifest and content hash but
  no verified active selector/receipt authority
- **THEN** the record SHALL retain candidate state separately from production
  authority
- **AND** candidate publication SHALL not be reported as current or active

#### Scenario: A dynamic or remote consumer cannot be closed

- **WHEN** an import, path read, service, worker, runtime lookup, or remote
  production/OSS consumer cannot be bounded to an immutable evidence reference
- **THEN** the consumer closure SHALL be unresolved
- **AND** the affected record or family SHALL not be migration-eligible

### Requirement: Families are aggregated only under homogeneous evidence

A family record SHALL be used only when every `qualified` member has the same
primary class and homogeneous policy-relevant facets for
authorship/reproducibility, release/rollback role, QA role,
cache/materialized role, privacy, and retention, as well as homogeneous
producer, authority, consumer, materialization, recovery, rollback, and
qualification evidence. The full inventory SHALL retain each member identity
and disposition even when a compact projection aggregates the family.

#### Scenario: A family is homogeneous

- **WHEN** all qualified members of a declared family satisfy the same primary
  class and policy-relevant facet/evidence tuple and their member hashes/sizes
  reconcile to the family digest
- **THEN** the classifier MAY emit one family record with a complete member
  locator, deterministic aggregate counts, and independent member dispositions
- **AND** the family SHALL not hide any member from denominator accounting

#### Scenario: One family member differs

- **WHEN** one member has a different primary class, authorship,
  reproducibility, release/rollback role, QA role, cache/materialized role,
  privacy, retention, producer, authority, consumer, or
  materialization/recovery/rollback condition
- **THEN** the classifier SHALL split the family into homogeneous groups or
  mark the affected members `unresolved`
- **AND** it SHALL not average, inherit, or silently discard the differing
  evidence

### Requirement: Duplicate observations are orthogonal to member disposition

Every denominator member SHALL be independently classified or assigned exactly
one disposition from `qualified | unresolved | justified-excluded`. An exact or
near-duplicate group SHALL contain only references to independently classified
member IDs and comparison evidence; it SHALL not replace a member disposition,
primary class, facet, consumer, authority, retention, privacy, materialization,
recovery, or rollback evidence, and SHALL not reduce denominator counts.
Duplicate, generated, or ephemeral status SHALL never by itself authorize
deletion, movement, externalization, source replacement, materialization, or
selector mutation.

#### Scenario: Exact duplicate candidates are found

- **WHEN** two or more denominator members have independently recorded
  dispositions and share the same content hash and size
- **THEN** the output SHALL record a deterministic exact-duplicate group that
  references every member ID and leaves each member's disposition and primary
  class unchanged
- **AND** the group SHALL remain an observation requiring independent authority,
  consumer, retention, privacy, and recovery proof before any later action

#### Scenario: Near duplicates are found

- **WHEN** A's frozen comparison evidence identifies a near-duplicate family
- **THEN** the output SHALL preserve the comparison algorithm, parameters,
  result, and independently disposed member IDs
- **AND** the result SHALL not be interpreted as a disposition, a denominator
  reduction, deletion authority, or replacement authority

### Requirement: Future eligibility requires complete independent proof

The classifier SHALL mark a record or homogeneous family `futureEligible` only
when all of these are proved together: a canonical source; a complete consumer
list; an explicit retention/deletion condition; a zero-required-consumer proof;
an immutable locator and hash; materialization/recovery/rollback proof; and
privacy approval. Missing, unknown, or drifted proof SHALL keep the affected
decision unresolved. `futureEligible` SHALL be an observation and SHALL not
authorize an action.

#### Scenario: All future-eligibility gates pass

- **WHEN** every required proof is bound to the same A subject and frozen
  classifier inputs
- **THEN** the record MAY be reported `futureEligible: true`
- **AND** no payload, selector, release, or lifecycle state SHALL be changed

#### Scenario: One future-eligibility gate is absent

- **WHEN** any source, consumer, retention, zero-consumer, locator/hash,
  materialization/recovery/rollback, or privacy proof is absent or stale
- **THEN** the record SHALL remain `futureEligible: unresolved`
- **AND** it SHALL remain blocked from migration, deletion, or externalization

### Requirement: Policy and privacy outputs are compact and fail closed

The classifier SHALL emit a compact classification summary, canonical index,
policy matrix, unresolved register, future-eligibility register, and a complete
inventory locator/digest. The policy matrix SHALL describe Git retention,
approved external storage, local materialization, CI generation, and
rollback/recovery separately for A-F. Git SHALL contain only compact,
repository-relative projections and locators; the complete per-file inventory
may be separately addressable by content digest but SHALL not be a giant Git
ledger. The canonical index SHALL list only its four (or explicitly versioned
actual number of) sibling compact projections and the full-inventory
identity/digest; it SHALL not list or hash itself.

#### Scenario: A public projection is generated

- **WHEN** compact outputs are serialized
- **THEN** they SHALL use stable ordering, safe record IDs, repository-relative
  or logical locators, hashes, sizes, and bounded evidence references
- **AND** they SHALL contain no binary payload, raw private evidence, credential,
  learner/user identifier, raw answer/event, secret, or absolute machine path

#### Scenario: A known privacy-sensitive record is classified safely

- **WHEN** a record has confirmed privacy and retention approval, receives
  `primaryClass: F`, and every package projection contains only its safe
  identity, digest, bounded reason code, and approved portable metadata
- **THEN** the record MAY remain `qualified` inside a privacy-scan-passing
  classification package
- **AND** its raw payload and private locator SHALL NOT be publicly
  externalized or reproduced by the package

#### Scenario: Privacy is unknown or forbidden content is detected

- **WHEN** a record has unknown privacy or missing approval, or a package-wide
  privacy scan finds a forbidden value
- **THEN** public externalization and package qualification SHALL fail closed
- **AND** an unknown-privacy record SHALL retain only its safe identity and
  violation code as `unresolved`, without reproducing source text

#### Scenario: Privacy scan covers the complete package

- **WHEN** credentials, cookies, user identifiers, raw answers, absolute paths,
  private locators, or other forbidden values are injected into the full-
  inventory header, a member, an evidence locator, or any compact projection
- **THEN** the package SHALL be unqualified and the scan SHALL identify only a
  safe record identity and violation code
- **AND** no injected value or private source text SHALL appear in any output

### Requirement: Package digest excludes the index's own bytes

The classifier SHALL compute `packageDigest` only from a canonical, sorted
package-input envelope containing A's subject identity and capture digest,
classifier tool identity, schema, frozen input/directory digests, and
normalized denominator member identity+digest+disposition tuples. The digest
input SHALL exclude the bytes of `index.json`, any field containing its own
digest, and any self-reference. The index's byte identity SHALL be bound
outside the index by its immutable Git blob identity or an outer
locator/receipt.

#### Scenario: Equivalent frozen inputs produce a deterministic package

- **WHEN** two runs use the same subject, tool, schema, frozen inputs, and
  normalized member identity/digest/disposition tuples
- **THEN** they SHALL produce the same `packageDigest` and byte-identical index
  bytes
- **AND** the index SHALL list sibling projection and full-inventory digests
  without including its own digest

#### Scenario: Self-referential index digest is attempted

- **WHEN** an index input or package digest calculation includes an `index.json`
  self-member, self-hash, or hash of the serialized index bytes
- **THEN** index validation SHALL reject the package before qualification
- **AND** no self-referential index SHALL satisfy the handoff contract

### Requirement: Existing lifecycle and release authorities remain unchanged

The capability SHALL treat existing QA evidence lifecycle, runtime
manifest/materializer/GC, knowledge release toolchain, OSS runtime, architecture
fitness, and release-selector contracts as read-only compatibility inputs. It
SHALL preserve QA privacy gates, runtime/knowledge lifecycle roots, and
candidate-versus-production separation. Candidate publication, staged release,
or classification output SHALL not activate a selector or current authority.

#### Scenario: Existing contract evidence is consumed

- **WHEN** the classifier reads an existing manifest, receipt, registry, QA
  record, lifecycle state, or architecture/fitness observation
- **THEN** it SHALL bind the source identity and digest as evidence and retain
  that authority's semantics
- **AND** it SHALL not rewrite, copy, replace, or reclassify the existing
  contract itself

#### Scenario: A remote production or OSS fact is required

- **WHEN** classification would require an unverified remote mount, selector,
  object, current release, or production consumer fact
- **THEN** the fact SHALL remain `unresolved`
- **AND** C SHALL not invoke server operations or fabricate a production state

### Requirement: Classification is payload-read-only and mutation-tested

The classifier SHALL read only A's immutable subject artifact, declared frozen
evidence, Git metadata, and existing read contracts. It MAY write its own
compact outputs and full-inventory artifact, but SHALL not delete, move, rename,
upload, download, or mutate source payloads, existing evidence, release blobs,
selectors, database/schema, CI, Git history, OSS objects, or production state.

#### Scenario: A classification run completes

- **WHEN** the classifier emits a qualified or unresolved package
- **THEN** pre/post hashes, sizes, and metadata for the subject and existing
  contract inputs SHALL be unchanged
- **AND** no release, runtime, QA, knowledge, selector, or production mutation
  SHALL be observable

#### Scenario: A mutation path is attempted

- **WHEN** a test or caller requests deletion, relocation, external storage,
  materialization, activation, rollback, GC, or selector change through C
- **THEN** the classifier SHALL reject the operation before mutation
- **AND** it SHALL report a bounded read-only boundary failure
