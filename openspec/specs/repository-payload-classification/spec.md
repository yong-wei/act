# repository-payload-classification Specification

## Purpose
TBD - created by archiving change classify-repository-payload-authority-and-materialization. Update Purpose after archive.
## Requirements
### Requirement: Classification is gated by A's immutable successor capture

The capability SHALL preserve the archived #1876 successor capture and #1881
classification package as immutable predecessor evidence. A completion run
SHALL capture one clean, exact claim-time `integration` commit/tree as a new
classification subject, record the predecessor subject and package digests,
and keep the subject identity independent from the implementation and final
artifact commits. A local change name, mutable directory listing, dirty or
mixed working tree, or the final artifact commit SHALL NOT substitute for the
frozen subject.

#### Scenario: A gate or successor handoff is incomplete

- **WHEN** the archived predecessor identity/digest is missing or invalid, or
  the selected current subject is dirty, mixed, detached-unresolved, not the
  resolved integration revision, or changes during capture
- **THEN** completion SHALL be blocked before a qualified output is written
- **AND** the result SHALL identify a bounded predecessor, subject, or drift
  reason without inventing or inheriting a current identity

#### Scenario: A handoff is complete

- **WHEN** the archived predecessor is digest-valid and one clean integration
  commit/tree is frozen as the current subject
- **THEN** every new output SHALL bind both identities in their distinct roles
- **AND** the capability SHALL NOT rewrite either archived package, activate a
  baseline, or describe the final artifact commit as the subject

### Requirement: The scope denominator is closed and revision-bound

The classifier SHALL use the complete tracked-blob entry set from the frozen
current subject and SHALL retain an explicit predecessor-to-current delta. The
minimum scope SHALL include `course-content/**/releases/**`,
`course-content/runtime/**`, `artifacts/**`, `docs/architecture/*.json`,
`openspec/changes/archive/**/evidence/**`, WASM/package/generated assets,
large fixtures/snapshots, and every large infograph, PPTX, PPM, EMF, GLB, and
JSON family actually present in the current subject. It SHALL record
discovered, `qualified`, `justified-excluded`, and `unresolved` member counts
and Git-object byte totals for each slice. Path counts and bytes SHALL
reconcile independently, while duplicate groups/member references remain
separate observations.

#### Scenario: A scoped entry is classified

- **WHEN** a tracked blob belongs to a declared current-subject scope slice
- **THEN** it SHALL occur exactly once with one member disposition from
  `qualified | unresolved | justified-excluded`, a stable path identity, Git
  object identity, content hash, and non-negative safe-integer byte size
- **AND** duplicate membership SHALL NOT become another disposition or reduce
  the path or byte denominator

#### Scenario: The current subject contains a post-predecessor payload

- **WHEN** a tracked entry is absent from the predecessor denominator but
  present in the frozen current subject
- **THEN** it SHALL be classified under the current denominator and recorded in
  the predecessor delta
- **AND** it SHALL NOT inherit a class, privacy state, authority, consumer, or
  eligibility decision from a neighboring or equal-hash predecessor record

#### Scenario: Generated or untracked input is observed

- **WHEN** a generated, ignored, untracked, materialized, or remotely
  discovered input is needed by a scoped record
- **THEN** it SHALL be recorded separately with producer/version, class,
  digest, source identity, and evidence status
- **AND** it SHALL not change the frozen tracked path or byte denominator

#### Scenario: Proposal-time size observations differ from the capture

- **WHEN** proposal-time file, byte, duplicate, or unresolved observations
  differ from the implementation-time frozen subject
- **THEN** qualification SHALL use only the frozen subject and digest-bound
  evidence
- **AND** no proposal-time count, size, path, or commit SHALL be a hardcoded
  acceptance value

### Requirement: Classifier and subject identities are independent and drift-fenced

The implementation SHALL record one clean tool checkpoint containing
`toolCommit`, `toolTree`, `schemaVersion`, and entry-bundle digest, then use
that tool to classify the independent frozen current subject with immutable
predecessor and evidence-input digests. Deterministic output SHALL be required
only when subject, predecessor, tool, schema, and frozen inputs all match.
Drift of any identity or input SHALL fail closed.

#### Scenario: The same frozen subject and tool are classified twice

- **WHEN** current-subject commit/tree, predecessor identities, tool
  commit/tree, schema, entry-bundle digest, and all frozen evidence digests are
  equal
- **THEN** canonical records and compact deterministic projections SHALL be
  byte-identical
- **AND** the second run SHALL neither create a new authority nor alter the
  predecessor or first result

#### Scenario: Subject or tool identity drifts

- **WHEN** any current-subject, predecessor, tool, schema, entry-bundle, or
  frozen evidence identity differs during classification or projection
- **THEN** the run SHALL fail closed before a qualified package is published
- **AND** it SHALL not relabel the drifted output as an update to an archived
  package or as the active baseline

### Requirement: Qualified records use one primary class and retain orthogonal facets

Every record SHALL bind a stable path or homogeneous family identity, member
content hash or family digest, non-negative safe-integer size, frozen current
subject identity, predecessor identity, producer/reproducibility evidence,
production/test/tool/documentation and dynamic consumers,
authority/manifest evidence, retention/privacy state, and
materialization/recovery/rollback conditions. Every denominator member SHALL
have exactly one `memberDisposition` from `qualified | unresolved |
justified-excluded`. Only a `qualified` member SHALL have a primary class;
unresolved and justified-excluded members SHALL keep `primaryClass: null` and
their bounded evidence or reason.

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
authority selects A; and reproducible generated output selects B when no
higher signal exists. Existing QA/runtime contracts remain independent
dimensions and do not define a cross-class precedence.

#### Scenario: Evidence supports one class

- **WHEN** all required current-subject evidence for a record supports one
  member of A-F and privacy and other critical evidence are known
- **THEN** the record SHALL be `qualified` with exactly one `primaryClass` and
  SHALL retain every non-primary facet and authority/rollback fact
- **AND** the compact index SHALL preserve evidence references without copying
  the payload body

#### Scenario: Overlapping roles use fixed precedence

- **WHEN** current-subject fixtures contain D+F, B+C, B+E, or A+F evidence
  combinations
- **THEN** their primary classes SHALL be F, C, E, and F respectively
- **AND** their facets SHALL retain both source roles, reproducibility,
  release/rollback, QA, cache/materialized, privacy, and retention facts

#### Scenario: Evidence is insufficient or conflicting

- **WHEN** privacy is unknown or required authority, provenance, consumer,
  retention, materialization, recovery, or rollback evidence is missing or
  conflicting
- **THEN** the member SHALL be `unresolved` with `primaryClass: null` and a
  bounded reason code before class precedence is applied
- **AND** unresolved status SHALL block its slice and the completion package
  from qualification rather than becoming a seventh class

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

The classifier SHALL mark a current-subject record or homogeneous family
`futureEligible` only when all of these are proved together against the same
frozen identities: a canonical source; a complete consumer list; an explicit
retention/deletion condition; zero-required-consumer proof; an immutable
locator and hash; materialization/recovery/rollback proof; and privacy
approval. Missing, unknown, conflicting, or drifted proof SHALL keep the
decision unresolved. `futureEligible` SHALL remain an observation and SHALL
not authorize an action.

#### Scenario: All future-eligibility gates pass

- **WHEN** every required proof binds the same current subject, predecessor,
  tool, schema, and frozen evidence inputs
- **THEN** the record MAY be reported `futureEligible: true`
- **AND** no payload, selector, release, evidence, or lifecycle state SHALL be
  changed

#### Scenario: One future-eligibility gate is absent

- **WHEN** any source, consumer, retention, zero-consumer, locator/hash,
  materialization/recovery/rollback, privacy, or identity proof is absent or
  stale
- **THEN** the record SHALL remain `futureEligible: unresolved`
- **AND** it SHALL remain blocked from migration, deletion, externalization,
  or source replacement

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
package-input envelope containing the frozen current-subject identity, archived
predecessor subject/package identities, classifier tool identity, schema,
frozen input/directory digests, and normalized denominator member
identity+digest+disposition tuples. The digest input SHALL exclude the bytes of
`index.json`, any field containing its own digest, and any self-reference. The
index byte identity SHALL be bound outside the index by its immutable Git blob
identity or an outer locator/receipt.

#### Scenario: Equivalent frozen inputs produce a deterministic package

- **WHEN** two runs use the same current subject, predecessor, tool, schema,
  frozen inputs, and normalized member identity/digest/disposition tuples
- **THEN** they SHALL produce the same `packageDigest` and byte-identical index
  bytes
- **AND** the index SHALL list sibling projection and full-inventory digests
  without including its own digest

#### Scenario: Self-referential index digest is attempted

- **WHEN** an index input or package digest calculation includes an
  `index.json` self-member, self-hash, or hash of the serialized index bytes
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

The classifier SHALL read only the frozen current-subject Git snapshot,
immutable predecessor artifacts, declared frozen evidence, Git metadata, and
existing read contracts. It MAY write its own compact outputs and external
full-inventory artifact, but SHALL not delete, move, rename, upload, download,
externalize, materialize, or mutate source payloads, existing evidence,
release blobs, selectors, database/schema, CI, Git history, OSS objects,
production state, test commands, or active architecture authorities.

#### Scenario: A classification run completes

- **WHEN** the classifier emits a qualified or unqualified current package
- **THEN** pre/post hashes, sizes, and metadata for the current subject,
  predecessor, and existing contract inputs SHALL be unchanged
- **AND** no release, runtime, QA, knowledge, selector, baseline, test, or
  production mutation SHALL be observable

#### Scenario: A mutation path is attempted

- **WHEN** a test or caller requests deletion, relocation, external storage,
  materialization, activation, rollback, GC, selector change, baseline update,
  or test-command change through this capability
- **THEN** the classifier SHALL reject the operation before mutation
- **AND** it SHALL report a bounded read-only boundary failure

### Requirement: Current completion qualification is all-or-unqualified

The completion package SHALL report `qualified` only when every current
denominator member has a qualified or justified-excluded disposition, the
unresolved count is zero, all per-slice and global path/byte equations
reconcile, all detail and compact artifact digests validate, lifecycle
compatibility checks pass, and package-wide privacy validation passes. It SHALL
otherwise emit one explicit unqualified package with bounded reason counts and
no migration-ready handoff.

#### Scenario: Every completion gate passes

- **WHEN** current path and byte denominators reconcile, unresolved is zero,
  all required evidence and artifact digests validate, and privacy and
  compatibility checks pass
- **THEN** the package SHALL report `qualified` for its exact subject/tool
  identity
- **AND** downstream proposals MAY inspect its action-neutral eligibility
  records but SHALL still perform their own scoped drift and authorization
  gates

#### Scenario: A completion gate does not pass

- **WHEN** any current member is unresolved, any path or byte is unaccounted,
  an artifact is missing or digest-invalid, a lifecycle check is non-clean, or
  privacy validation fails
- **THEN** the whole package SHALL report `unqualified` with bounded reasons
- **AND** per-slice progress SHALL NOT be presented as package qualification or
  migration authorization

### Requirement: Active architecture and production authorities remain separate

A qualified completion package SHALL remain an investigation and planning
input. Only the later N5 closure change may recapture and atomically activate
the repository baseline, charter, fitness budget, and test qualification. This
capability SHALL NOT change any production authority or selector.

#### Scenario: A qualified current package is emitted

- **WHEN** all completion gates pass and the package is written
- **THEN** `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, active test
  qualification, production selectors, and runtime/OSS state SHALL remain
  byte-identical
- **AND** the package SHALL identify itself as non-active and action-neutral

### Requirement: Complete inventory bytes are independently verified

The full current inventory SHALL have a logical or repository-relative
locator, safe byte count, SHA-256, subject identity, tool identity, and an
independent read-and-hash verification receipt. Package qualification SHALL
require the referenced bytes to be actually readable and to reconcile with
the compact projections; a locator, historical digest, summary-only check, or
regenerated member set without byte verification SHALL NOT satisfy this gate.

#### Scenario: Full inventory bytes are available and valid

- **WHEN** an independent verifier reads the complete inventory at its declared
  locator and confirms byte count, SHA-256, subject/tool identities, member
  denominator, and projection totals
- **THEN** the inventory byte gate SHALL pass for that exact package
- **AND** the verification receipt SHALL be indexed without copying the full
  inventory into Git

#### Scenario: Full inventory bytes cannot be verified

- **WHEN** the inventory is missing, unreadable, truncated, regenerated under
  another identity, or differs in byte count, digest, members, or projections
- **THEN** the package SHALL remain unqualified with a bounded inventory-byte
  reason
- **AND** no historical locator or compact summary SHALL be accepted as a
  substitute

