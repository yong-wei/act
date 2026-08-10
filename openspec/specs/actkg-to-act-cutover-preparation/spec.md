# actkg-to-act-cutover-preparation Specification

## Purpose
TBD - created by archiving change prepare-actkg-to-act-graph-cutover. Update Purpose after archive.
## Requirements
### Requirement: Capture a safe local preparation baseline

The preparation workflow SHALL record the permanent worktree role, branch,
captured Git revision, `origin/integration` divergence, dirty ownership, and
byte-level observations of existing Authority, Teaching Projection,
consumer-activation, and legacy-retirement pointers before materializing a
candidate. The workflow MUST fail closed when the resource worktree cannot be
cleanly aligned without overwriting local work.

#### Scenario: Clean resource worktree is aligned

- **WHEN** the permanent resource worktree is clean and behind
  `origin/integration` without local-only commits
- **THEN** the workflow SHALL fast-forward only, record the resulting capture
  revision, and continue with that revision as the preparation identity

#### Scenario: Existing local work prevents safe alignment

- **WHEN** the resource worktree has unowned changes, divergent commits, or a
  fast-forward conflict
- **THEN** the workflow SHALL preserve all local files, record the observed
  divergence and ownership evidence, and stop before candidate preparation

### Requirement: Admit only an immutable non-default Authority candidate

The workflow SHALL select one explicitly identified locally available ActKG
Release and validate its release identity, schema version, bundle digest,
closure, and compatibility before creating a candidate. It MUST write the
candidate and all derived evidence below a unique non-default preparation root,
and MUST NOT write a default Authority `current.json` or treat admission as
consumer activation. Where database-backed import is required, it MAY use only
a unique, disposable local schema with an explicit schema-qualified connection;
it MUST NOT write candidate records to the shared `public` schema.

#### Scenario: Compatible local Release is available

- **WHEN** a locally available Release passes identity, schema, digest, closure,
  and compatibility validation at the captured revision
- **THEN** the workflow SHALL create an immutable candidate manifest that pins
  the Release and bundle identities and hashes every materialized artifact

#### Scenario: Release validation is incomplete

- **WHEN** a selected Release lacks a compatible bundle, trusted digest,
  predecessor baseline, or required closure proof
- **THEN** the workflow SHALL record the failed check as `BLOCKED` and SHALL
  NOT synthesize a candidate, modify a default pointer, or infer missing data

#### Scenario: Local candidate import is isolated

- **WHEN** database-backed validation is required for a compatible local Release
- **THEN** the workflow SHALL record the unique schema identity and before/after
  shared-schema fingerprints, run every importer and repository read with the
  same schema-qualified connection, materialize only a `staged` Authority
  Snapshot below the preparation root, and clean up that exact schema on both
  success and failure

### Requirement: Prepare a deterministic teaching projection delta

The workflow SHALL compute an exact baseline-to-candidate impact set and derive
an inactive Teaching Projection candidate deterministically from the frozen
inputs. It SHALL evaluate only active ACT course resource bindings, textbook
locators, teaching prerequisites, and teaching semantics that are in the impact
set. Published upstream engineering entities, formulae, system models, and
engineering relationships MUST receive identity and integrity verification only.
The historical 34-batch CourseCoverage audit and its 4,880 DEFER outcomes MUST
remain immutable and outside the release-delta denominator.

#### Scenario: An impacted binding has one compatible successor

- **WHEN** an active course binding resolves to exactly one compatible successor
  in the frozen Authority candidate
- **THEN** the candidate Teaching Projection SHALL include a traceable mapping
  and the impact record SHALL identify the frozen source and successor IDs

#### Scenario: A successor cannot be determined safely

- **WHEN** the delta contains a split, merge, no successor, or teaching-semantic
  ambiguity for an active binding, locator, or prerequisite
- **THEN** the workflow SHALL emit a stable REVIEW_REQUIRED item and SHALL NOT
  guess a successor or activate the candidate projection

#### Scenario: Historical review evidence is present

- **WHEN** the preparation reads historical CourseCoverage evidence
- **THEN** it SHALL retain the evidence as immutable audit context and SHALL NOT
  add its DEFER population to the new release-delta count or worklist

### Requirement: Derive active-course author decisions from current blueprints

The workflow SHALL use the current active interactive-course arrangement and its
package BOPPPS or interactive blueprint as ACT-owned semantic evidence for each
otherwise unresolved active resource. Every derived decision MUST pin the
resource and scope identity, runtime source digest, blueprint digest, candidate
set, authored package-policy digest, and a usable Canonical endpoint in the
fixed Authority release. A required resource MUST resolve as `BOUND`; an
`EXPLICIT_NONE` result is valid only for an active resource explicitly marked
non-semantic by its projection mode.

#### Scenario: A current blueprint resolves an active resource

- **WHEN** a frozen active resource has no deterministic crosswalk, card, or
  manifest binding and its package blueprint supplies an ACT teaching endpoint
- **THEN** the workflow SHALL create a formal `AUTHOR_DECISION` BIND record and
  rebuild the package gate from that record without changing upstream semantics

#### Scenario: Blueprint or policy changes after a decision

- **WHEN** the package BOPPPS/interactive blueprint or authored binding policy
  bytes differ from the captured revision
- **THEN** the prior decision SHALL fail input-digest matching and the resource
  SHALL require a new decision before activation

### Requirement: Produce complete staged consumer evidence without activation

For engineering-graph, engineering-rag, course-runtime, konling,
teaching-resource-rag, and learning-path, the workflow SHALL produce one
staging manifest that records pinned Authority and Projection identities,
readiness, shadow-comparison result, rollback target, and missing local
evidence. Any staged activation and rollback exercise MUST occur only within
the unique non-default preparation root. The workflow MUST verify that default
pointers and active consumer selectors are byte-for-byte unchanged.

#### Scenario: Consumer has complete local staged evidence

- **WHEN** a consumer can pin the candidate inputs and its readiness, shadow,
  and rollback checks pass in the non-default staging root
- **THEN** its manifest SHALL report `READY` or `PINNED` together with the
  relevant hashes and rollback target

#### Scenario: Consumer lacks required local evidence

- **WHEN** a consumer cannot complete its local readiness, shadow, or rollback
  check
- **THEN** its manifest SHALL report `BLOCKED` with the exact missing evidence,
  and no default pointer or active selector SHALL be changed

#### Scenario: Staged exercise completes

- **WHEN** a staged consumer activation and rollback exercise is run
- **THEN** the workflow SHALL retain before-and-after default-pointer hashes and
  report failure if either hash differs

### Requirement: Emit a truthful pre-switch readiness report

The workflow SHALL emit one immutable readiness report that identifies the
source Release, capture revision, Authority and Projection identities and
hashes, every consumer status, REVIEW_REQUIRED items, rollback paths, and any
missing evidence. The report MUST distinguish conditions sufficient to request
a separately authorized atomic pointer switch from conditions that still block
that request. It MUST state that legacy retirement remains out of scope until a
later successful switch and a zero-fallback evidence window.

#### Scenario: All affected consumers are ready

- **WHEN** every affected consumer has acceptable staged, readiness, shadow, and
  rollback evidence and the REVIEW_REQUIRED worklist is empty or resolved
- **THEN** the report SHALL identify that a separate request for an atomic
  pointer switch can be made, without performing that switch

#### Scenario: Evidence remains incomplete

- **WHEN** any affected consumer is blocked or a REVIEW_REQUIRED item remains
  unresolved
- **THEN** the report SHALL identify the exact blocker and SHALL NOT recommend
  an actual switch or legacy retirement

### Requirement: Atomically activate the verified local release set

After all active package gates, prerequisite publication, and six-consumer
shadow/readiness checks pass, the workflow SHALL activate the local release set
only through existing atomic stores. The shared consumer-activation pointer is
the consumer switch unit; it MUST contain all six unique consumer records, one
Authority identity, and one Projection identity for all teaching consumers. The
workflow MUST preserve predecessor pointers, exercise rollback before the final
switch, re-read every consumer after activation, and keep legacy-retirement
unchanged.

#### Scenario: Complete release set is ready

- **WHEN** 32 packages / 551 active resources resolve with zero
  `REVIEW_REQUIRED`, every package gate and prerequisite publication passes,
  and all six consumer records are READY with matching release identities
- **THEN** the workflow SHALL atomically activate the local Authority,
  Projection, prerequisite, and consumer pointers and emit their receipts

#### Scenario: Post-activation identity mismatch

- **WHEN** a post-switch consumer read does not resolve the pinned Authority or
  Projection identity
- **THEN** the workflow SHALL restore the preserved predecessor pointer through
  the existing rollback contract, or, for an all-ABSENT first activation,
  remove only the journal-bound pointers whose current identities exactly match
  the new release and report the failed observation

