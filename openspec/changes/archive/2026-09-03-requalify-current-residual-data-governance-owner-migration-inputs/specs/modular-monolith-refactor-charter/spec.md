## MODIFIED Requirements

### Requirement: The refactor charter consumes one qualified baseline identity

The project SHALL build the active modular-monolith charter only from a
qualified `capture-modular-monolith-refactor-baseline` artifact set and SHALL
preserve its source commit, source tree, schema version, and frozen measurement
receipt identities. A current residual-owner requalification SHALL preserve
that active predecessor and the archived #1876/#1883 identities as immutable
history while capturing a distinct clean claim-time integration subject,
complete residual member/caller denominator, and independently verified full
ledger. Its adjudicator/validator tool checkpoint SHALL remain separate from
the current subject and every historical subject. Missing, dirty, mixed,
unreadable, incomplete, or drifted inputs SHALL block qualified projections.

#### Scenario: Charter input is qualified

- **WHEN** the active predecessor baseline is clean, denominator-reconciled,
  and identified by one source commit and tree
- **THEN** charter generation SHALL record that identity in every generated
  active architecture document
- **AND** later readers SHALL be able to trace each charter decision to
  repository-relative baseline evidence

#### Scenario: Charter input is missing or drifts

- **WHEN** the active baseline is missing, dirty, mixed-worktree,
  denominator-incomplete, or no longer matches the declared source identity
- **THEN** active charter qualification SHALL fail before writing a qualified
  result
- **AND** it SHALL NOT silently recapture or substitute another revision

#### Scenario: The residual adjudication gate and subject are qualified

- **WHEN** the native upstream payload dependency is resolved, the historical
  predecessor identities remain digest-valid, and one clean integration
  commit/tree supplies a complete current residual member/caller denominator
  and readable full-ledger bytes
- **THEN** the scoped record SHALL preserve the current source commit/tree,
  subject identity, schema, member/caller digests, actual ledger locator,
  byte-count and SHA-256 verification receipt, tool identity, and historical
  predecessor identities
- **AND** a later reader SHALL trace each current decision without substituting
  a local scan, upstream subject, historical decision, or active baseline

#### Scenario: The gate, input or tool identity is missing or drifts

- **WHEN** the upstream dependency is unresolved, the current source is dirty,
  mixed, non-integration, incomplete, or drifted, a historical identity is
  rewritten, the full ledger is unreadable or unverified, or any
  subject/tool/schema/frozen-input identity is inconsistent
- **THEN** claim or execution SHALL stop at the applicable gate and no
  qualified current residual projection SHALL be written
- **AND** a bounded blocker SHALL be emitted without substituting another
  subject, inheriting historical owners, or activating the charter

#### Scenario: The same subject and tool are replayed

- **WHEN** current subject, historical predecessor, tool checkpoint, schema,
  and frozen evidence inputs are identical
- **THEN** normalized owner decisions and compact deterministic projections
  SHALL be byte-identical
- **AND** changing any identity or frozen input SHALL fail closed or produce a
  distinct decision identity rather than overwrite a prior record

### Requirement: Every inventoried capability has one accountable target owner

The charter SHALL assign exactly one accountable target domain owner to every
capability and inventoried route, API, persistence model, event, worker,
script, registry, and test surface, while preserving current-owner evidence
and any conflict record. Qualification SHALL fail whenever an item has no
target owner or more than one candidate target owner. This canonical
single-owner requirement is unchanged for all in-scope and out-of-scope
surfaces; the residual outcome dimension SHALL remain orthogonal and SHALL NOT
replace an accountable target domain owner.

#### Scenario: Ownership evidence supports one domain

- **WHEN** current evidence supports one target domain for an inventoried
  record
- **THEN** the charter SHALL record one stable accountable target domain owner
  ID with current-owner evidence and repository-relative references
- **AND** every projection SHALL use that same owner ID

#### Scenario: Ownership evidence conflicts

- **WHEN** current evidence indicates multiple owners or no defensible target
  owner
- **THEN** charter qualification SHALL fail and retain the conflicting evidence
  as a blocking record
- **AND** the record SHALL not count as a qualified exception or permit a
  qualified charter to be emitted

#### Scenario: Baseline fixture has multiple candidate owners

- **WHEN** a current-subject fixture reports one capability with two or more
  candidate target owners
- **THEN** the qualification test SHALL fail with the stable record identity,
  candidate owner IDs, evidence references, accountable follow-up, and
  resolution condition
- **AND** the blocking record SHALL remain non-qualified until exactly one
  candidate owner is adjudicated

#### Scenario: An out-of-scope compatibility outcome lacks an owner

- **WHEN** an object outside the current `src/lib/data-governance/**` scoped
  denominator is given a compatibility or retirement outcome without exactly
  one accountable target domain owner
- **THEN** charter qualification SHALL fail
- **AND** the residual outcome extension SHALL not satisfy or replace the
  canonical single-owner requirement

### Requirement: Charter projections are mutually consistent

The project SHALL generate `docs/architecture/refactor-charter.md`,
`bounded-context-map.md`, `dependency-rules.md`,
`trust-boundary-matrix.md`, and `deprecation-ledger.md` as deterministic
projections of one normalized charter record set. A current residual
requalification SHALL additionally expose a compact decision matrix,
owner/kernel/tool/fixture/compatibility/unresolved summaries, safe privacy and
determinism evidence, qualified future migration-input slices, and an actual
full-ledger locator/byte-count/SHA-256/verification receipt without creating a
second owner catalog or permanent giant Git ledger.

#### Scenario: The five documents are generated

- **WHEN** the active charter record set is qualified
- **THEN** all five documents SHALL be emitted with stable ordering and the
  same charter identity
- **AND** owner, gate, dependency, and compatibility references SHALL resolve
  across projections

#### Scenario: The five documents and scoped summaries are generated

- **WHEN** the current normalized record set is denominator-complete,
  identity-valid, caller-closed, payload-bound, privacy-safe, has zero
  unresolved records, and its full-ledger bytes are independently verified
- **THEN** compact scoped summaries and migration-input projections SHALL be
  emitted with stable ordering and the same subject/tool/decision identity
- **AND** owner, outcome, gate, caller, payload, compatibility, locator,
  byte-count, digest, and receipt references SHALL resolve across projections

#### Scenario: A scoped conflict remains

- **WHEN** any current record is unresolved, a high-impact authority or
  payload fact is unverified, a caller/outcome proof is incomplete, or the
  actual full ledger cannot be read and verified
- **THEN** the system SHALL emit one non-qualified blocker package containing
  only safe IDs, evidence locators, bounded reasons, and resolution conditions
- **AND** it SHALL not emit or describe a qualified scoped charter or
  migration-ready input

#### Scenario: A projection diverges

- **WHEN** a document or compact summary contains an unknown ID, conflicting
  owner/outcome, mismatched path/caller/byte denominator, missing or invalid
  ledger receipt, or a different subject/tool/payload identity
- **THEN** validation SHALL fail
- **AND** the divergent document SHALL not be treated as an authoritative
  charter or migration-input projection

### Requirement: Charter qualification is governance-only

Charter generation and current residual requalification SHALL not change
product behavior, tests, TypeScript runtime programs, imports/exports,
database state, runtime releases, deployment state, GitHub coordination,
production selectors, Learning Record writes, Assignment state, current
pointers, watermarks, retention, or any existing privacy/authority contract.
They MAY write only bounded, revision-bound decision evidence, verification
receipts, and compact projections. Only N5 may later recapture and atomically
activate the baseline, charter, fitness budget, and test qualification.

#### Scenario: The charter is generated

- **WHEN** the charter command runs
- **THEN** it SHALL read repository-owned baseline and configuration evidence
  only
- **AND** it SHALL not claim work, deploy, activate, or mutate production or
  remote coordination state

#### Scenario: The residual charter command runs

- **WHEN** the command reads the frozen current subject, immutable historical
  comparisons, current source/configuration, applicable payload policy,
  existing specs, and bounded evidence
- **THEN** it SHALL emit only safe repository-relative decision records,
  summaries, migration-input projections, and locator/byte/digest receipts
- **AND** it SHALL not move files, change imports/exports, delete barrels,
  write facts, run backfills, alter Prisma, open Issues, change tests, deploy,
  publish, activate selectors, or mutate production/remote state

#### Scenario: A qualified or non-qualified result is consumed

- **WHEN** a downstream proposal or reviewer reads a qualified or non-qualified
  scoped projection
- **THEN** it SHALL require exact current subject/tool/schema, historical
  predecessor, payload-evidence, frozen-input, and full-ledger receipt
  identities and fail closed on missing, stale, mixed, or drifted evidence
- **AND** record-qualified, package-qualified, migration-input, captured,
  digest-verified, or qualified-for-investigation status SHALL never imply
  active charter, deletion authority, implementation authorization, or
  production activation

### Requirement: Scoped residual outcomes are orthogonal to accountable ownership

Only a member or homogeneous family bound to the frozen current
`src/lib/data-governance/**` denominator MAY use the residual outcome
dimension. The six mutually exclusive outcomes are exact business-domain
owner, strict cross-domain evidence/processing kernel, explicit operator
tooling/backfill boundary, fixture/demo/test/generated asset,
compatibility/retirement candidate, and unresolved conflict. Every qualified
scoped record SHALL have exactly one `accountableOwner` drawn from the existing
charter owner catalog and exactly one qualified outcome from the first five
outcomes. `unresolved` means owner or outcome evidence is not closed; it is not
a qualified owner or exception and causes scoped and global qualification to
fail. Historical owner/outcome records MAY be comparison evidence but SHALL
not be inherited as current decisions.

#### Scenario: A qualified residual record has one owner and one outcome

- **WHEN** a current residual member or homogeneous family has closed caller,
  current-owner, authority, payload, privacy, and trust evidence
- **THEN** the charter SHALL record exactly one existing domain
  `accountableOwner` and exactly one qualified residual outcome
- **AND** owner and outcome SHALL be serialized separately and projected
  together without using either one or a historical decision as evidence for
  the other

#### Scenario: Kernel, tooling, fixture, or compatibility outcome has a steward

- **WHEN** a current record receives a kernel, operator-tooling, fixture/demo/
  test/generated, or compatibility/retirement outcome
- **THEN** it SHALL also name exactly one existing domain owner or steward
  accountable for the public boundary, privacy, retention/deletion, and
  maintenance obligations applicable to that outcome
- **AND** a consumer list, caller count, directory, artifact role, or archived
  owner SHALL not substitute for that unique owner/steward

#### Scenario: Residual owner or outcome evidence is unresolved

- **WHEN** a current member has multiple candidate owners, no defensible owner,
  incomplete caller/authority/payload/privacy/trust evidence, or an unproved
  outcome
- **THEN** the record SHALL be marked `unresolved` with safe evidence,
  accountable follow-up information, and a resolution condition
- **AND** scoped and global qualification SHALL fail without forcing an owner
  or outcome

#### Scenario: An out-of-scope surface is given a residual outcome

- **WHEN** a capability, route, API, model, worker, script, registry, or test
  surface outside the frozen current `src/lib/data-governance/**` denominator
  is assigned a residual outcome without exactly one accountable target owner
- **THEN** charter qualification SHALL fail
- **AND** the six-outcome extension SHALL not apply outside the current scoped
  denominator or weaken the canonical single-owner contract

## ADDED Requirements

### Requirement: Current residual requalification follows payload eligibility but owns its subject

The mapped `complete-current-repository-payload-eligibility-classification`
Issue SHALL be closed with `status:archived` and its native dependency SHALL be
resolved before this change is claimed. The upstream result MAY supply schema,
policy, and safe comparison evidence, but this change SHALL capture an
independent clean current subject after the dependency is satisfied. Native
ordering SHALL NOT establish subject equality or permit current owner, caller,
privacy, payload, or ledger-byte facts to be inherited.

#### Scenario: The payload dependency is not archived

- **WHEN** the mapped upstream Issue is open, lacks `status:archived`, retains
  an unresolved native dependency, or cannot be uniquely read
- **THEN** this change SHALL remain unclaimable and SHALL not run its
  adjudicator, write fixtures, or emit a current decision package
- **AND** no historical payload or Data Governance package SHALL bypass the
  dependency

#### Scenario: The dependency is archived and the subject differs

- **WHEN** the upstream Issue is archived and this change captures a later
  clean integration subject
- **THEN** applicable upstream policy evidence SHALL be rebound or recorded as
  drifted against this subject
- **AND** the different subject SHALL be expected rather than silently coerced
  to the upstream identity

### Requirement: Full residual ledger bytes are independently verified

The complete current residual ledger SHALL have a logical or
repository-relative locator, byte count, SHA-256, current subject/tool/schema
identities, member-set and caller-bundle digests, and an independent
read-and-hash verification receipt. Qualification SHALL require the actual
bytes to be readable and to reconcile with every compact projection.

#### Scenario: The full ledger is readable and valid

- **WHEN** an independent verifier reads the complete ledger and confirms its
  locator, bytes, SHA-256, subject/tool/schema, member and caller denominators,
  normalized records, and projection totals
- **THEN** the ledger-byte gate SHALL pass for that exact decision package
- **AND** the receipt SHALL be indexed without committing the full ledger to
  Git

#### Scenario: The full ledger is missing or substituted

- **WHEN** the ledger is missing, unreadable, truncated, regenerated under a
  different identity, or differs in byte count, hash, members, callers, or
  projections
- **THEN** the package SHALL remain non-qualified with a bounded ledger-byte
  blocker
- **AND** a locator, archived digest, compact summary, or reconstructed count
  SHALL NOT substitute for actual byte verification

### Requirement: Protected data-governance invariants remain read-only

Current requalification SHALL bind, but SHALL NOT modify, the sole online
Learning Record writer and its identity/deduplication/time/outbox/pointer/
watermark contracts; Assignment approved snapshots, CAS, idempotency,
processing and derivative boundaries; ArenaSubmission official scoring and
declared context-only facts; Portrait V2 primary state and compatibility;
classroom authorization, redaction and independent-learner suppression;
operator/backfill isolation; and privacy, retention, recovery and rollback.

#### Scenario: A protected invariant is proven

- **WHEN** current evidence identifies the authoritative writer, reader,
  pointer, score, snapshot, authorization, suppression, or operator boundary
- **THEN** the decision record SHALL preserve that boundary and its evidence as
  a future migration constraint
- **AND** the requalification run SHALL not invoke or mutate the protected path

#### Scenario: A protected invariant is unproved or conflicting

- **WHEN** current evidence cannot prove one protected boundary or indicates
  multiple writers, authorities, pointers, or incompatible privacy/retention
  obligations
- **THEN** affected records and the package SHALL remain unresolved and
  non-qualified
- **AND** no migration-input slice SHALL hide, default, or resolve the conflict

### Requirement: Qualified migration inputs are precise and action-neutral

A migration-input slice SHALL be emitted only from a qualified current package
and SHALL contain exact paths, one accountable owner, one outcome, public
boundary, all caller classes, explicit not-touched paths, protected trust
invariants, current payload state, zero-consumer proof requirement, deletion
condition, rollback/recovery evidence, and the future authorization condition.
It SHALL be an input for a later Buddy proposal, not an implementation plan or
action authority.

#### Scenario: A future slice is fully qualified

- **WHEN** package, ledger bytes, member/caller denominator, owner/outcome,
  payload, privacy, trust, recovery, and rollback gates all pass for a slice
- **THEN** the compact handoff MAY expose that slice with its exact identities
  and future conditions
- **AND** it SHALL not create an Issue, move a file, rewrite a caller, delete a
  compatibility surface, or activate any authority

#### Scenario: A future slice has one incomplete gate

- **WHEN** any slice identity, caller, owner, outcome, payload, privacy, trust,
  recovery, rollback, or deletion proof is missing, stale, or conflicting
- **THEN** the slice SHALL remain unresolved or non-migration-ready with a
  bounded reason
- **AND** completion of another slice or the historical 262-record package
  SHALL NOT make it qualified
