# modular-monolith-refactor-charter Specification

## Purpose
TBD - created by archiving change establish-modular-monolith-refactor-charter. Update Purpose after archive.
## Requirements
### Requirement: The refactor charter consumes one qualified baseline identity
The project SHALL build the modular-monolith charter only from a qualified
`capture-modular-monolith-refactor-baseline` artifact set and SHALL preserve
its source commit, source tree, schema version, and frozen measurement receipt
identities.  For the scoped residual-owner adjudication, it SHALL additionally
consume change A's exact post-convergence successor handoff, including its
owner-residue subject identity and full-inventory artifact digest, without
replacing the predecessor baseline or active charter identity.  If an
adjudicator or validator is implemented, its clean tool checkpoint identity
SHALL remain separate from the A subject identity.  Until the coordination and
A handoff gate succeeds, D SHALL block claim, apply, any implementation
(including validator or fixture), adjudication runs, normalized decision or
evidence-record writes, and qualified projections.

#### Scenario: Charter input is qualified
- **WHEN** the predecessor baseline is clean, denominator-reconciled, and
  identified by one source commit and tree
- **THEN** charter generation SHALL record that identity in every generated
  architecture document
- **AND** later readers SHALL be able to trace each charter decision to
  repository-relative baseline evidence.

#### Scenario: Charter input is missing or drifts
- **WHEN** the baseline is missing, dirty, mixed-worktree,
  denominator-incomplete, or no longer matches the declared source identity
- **THEN** charter qualification SHALL fail before writing a qualified result
- **AND** it SHALL NOT silently recapture or substitute another revision.

#### Scenario: The residual adjudication gate and subject are qualified
- **WHEN** the qualified predecessor baseline remains available and live Issue
  #1876 is closed, carries `status:archived`, and has its native `blockedBy`
  dependency resolved, and A supplies a clean, denominator-complete successor
  with matching subject and full-artifact digests
- **THEN** the scoped charter record SHALL preserve A's source commit/tree,
  successor identity, schema, owner-residue digest, full-artifact locator and
  digest, the predecessor baseline identity, and any frozen receipt identities
- **AND** a later reader SHALL be able to trace each decision to
  repository-relative A evidence without substituting a local scan or treating
  A as an active baseline.

#### Scenario: The gate, input or tool identity is missing or drifts
- **WHEN** the predecessor baseline is missing or drifts, #1876 is not closed,
  lacks `status:archived`, has an unresolved native `blockedBy`, cannot be
  verified, or A's handoff/subject/full-artifact/source/denominator/schema or
  tool identity is missing, drifted, dirty, mixed, or inconsistent
- **THEN** D SHALL block claim, apply, any implementation (including validator
  or fixture), adjudication runs, normalized decision or evidence-record
  writes, and qualified projections
- **AND** the only permitted output SHALL be a parent coordination-layer
  gate-rejection that does not consume A and is neither a D result nor a D
  artifact
- **AND** scoped charter qualification SHALL fail without recapturing,
  substituting another revision, or treating the working tree as A.

#### Scenario: The same subject and tool are replayed
- **WHEN** A's subject identity, tool checkpoint identity, schema and frozen
  evidence inputs are identical
- **THEN** the normalized owner decisions and compact projections SHALL be
  byte-identical
- **AND** changing any identity or frozen input SHALL fail closed or produce a
  distinct decision identity rather than overwrite the prior record.

### Requirement: Every inventoried capability has one accountable target owner
The charter SHALL assign exactly one accountable target domain owner to every
capability and inventoried route, API, persistence model, event, worker, script,
registry, and test surface, while preserving current-owner evidence and any
conflict record.  Qualification SHALL fail whenever an item has no target owner
or more than one candidate target owner.  This canonical single-owner
requirement is unchanged for all in-scope and out-of-scope surfaces; the
residual outcome dimension in the added requirement below SHALL remain
orthogonal and SHALL NOT replace an accountable target domain owner.

#### Scenario: Ownership evidence supports one domain
- **WHEN** the evidence supports one target domain for an inventoried record
- **THEN** the charter SHALL record one stable accountable target domain owner
  ID with current-owner evidence and repository-relative references
- **AND** every projection SHALL use that same owner ID.

#### Scenario: Ownership evidence conflicts
- **WHEN** evidence indicates multiple owners or no defensible target owner
- **THEN** charter qualification SHALL fail and retain the conflicting evidence
  as a blocking record
- **AND** the record SHALL not count as a qualified exception or permit a
  qualified charter to be emitted.

#### Scenario: Baseline fixture has multiple candidate owners
- **WHEN** a baseline fixture reports one capability with two or more candidate
  target owners
- **THEN** the qualification test SHALL fail with the stable record identity,
  candidate owner IDs, evidence references, accountable owner, and resolution
  condition
- **AND** the blocking record SHALL remain non-qualified until exactly one
  candidate owner is adjudicated.

#### Scenario: An out-of-scope compatibility outcome lacks an owner
- **WHEN** an object outside the A-bound `src/lib/data-governance/**` scoped
  denominator is given a compatibility/retirement outcome without exactly one
  accountable target domain owner
- **THEN** charter qualification SHALL fail
- **AND** the residual outcome extension SHALL not satisfy or replace the
  canonical single-owner requirement.

### Requirement: Charter projections are mutually consistent
The project SHALL generate `docs/architecture/refactor-charter.md`,
`bounded-context-map.md`, `dependency-rules.md`,
`trust-boundary-matrix.md`, and `deprecation-ledger.md` as deterministic
projections of one normalized charter record set.  The scoped residual
projection SHALL additionally expose a compact decision matrix,
owner/kernel/tool/fixture/compatibility/unresolved summaries, safe privacy and
determinism evidence, and a full-ledger locator/digest without creating a
second owner catalog or ledger.

#### Scenario: The five documents are generated
- **WHEN** the charter record set is qualified
- **THEN** all five documents SHALL be emitted with stable ordering and the
  same charter identity
- **AND** owner, gate, dependency, and compatibility references SHALL resolve
  across projections.

#### Scenario: The five documents and scoped summaries are generated
- **WHEN** the normalized record set is denominator-complete, identity-valid,
  caller-closed, and has zero unresolved scoped records
- **THEN** all five documents and the scoped compact summaries SHALL be emitted
  with stable ordering and the same charter/subject/tool identity
- **AND** owner, outcome, gate, dependency, compatibility, locator and digest
  references SHALL resolve across projections.

#### Scenario: A scoped conflict remains
- **WHEN** any scoped record is unresolved, a high-impact authority fact is
  unverified, or a required caller/outcome proof is incomplete
- **THEN** the system MAY emit a non-qualified blocker package containing safe
  IDs, evidence locators and resolution conditions
- **AND** it SHALL not emit or describe a qualified scoped charter or
  migration-ready slice.

#### Scenario: A projection diverges
- **WHEN** a document or compact summary contains an unknown ID, conflicting
  outcome/owner, mismatched denominator/count, missing full-ledger digest, or a
  different source/tool identity
- **THEN** validation SHALL fail
- **AND** the divergent document SHALL not be treated as an authoritative
  charter projection.

### Requirement: Hard gates include evidence-based consequences
Each chartered hard gate SHALL identify its protected boundary and fact, threat
or corruption mode, failure consequence, sole authoritative validator,
current consumers, and rationale for blocking behavior.  Residual adjudication
SHALL preserve the existing Learning Record, Assignment, evidence, Arena,
portrait, classroom, privacy, pointer, watermark and retention validators;
uncertainty about a high-impact writer, pointer, retention, authority or
privacy fact SHALL remain unresolved rather than create a replacement gate.

#### Scenario: A hard gate is retained
- **WHEN** a gate protects identity, privacy, authoritative scoring,
  persistence integrity, authority ingress, release activation, numerical
  safety, current-pointer/watermark integrity, or an equivalent high-consequence
  fact
- **THEN** the trust-boundary matrix SHALL record the threat, consequence,
  sole validator, consumers, evidence and blocking rationale
- **AND** the charter SHALL distinguish it from one-time contract validation,
  optional degradation and non-authoritative observation.

#### Scenario: A duplicate or misplaced defense is found
- **WHEN** an internal duplicate check, receipt, state, sink, or observation is
  not the sole validator for a protected fact
- **THEN** the charter SHALL mark it as a removable or consolidation candidate
  with owner, consumers and evidence
- **AND** it SHALL not create another blocking writer, pointer, retention or
  privacy gate merely to preserve historical behavior.

#### Scenario: A high-impact fact cannot be proven
- **WHEN** writer identity, current pointer, retention, official score,
  authority, privacy, or backfill isolation has conflicting or insufficient
  evidence
- **THEN** the record SHALL remain unresolved and the scoped projection SHALL
  be non-qualified
- **AND** a later authorized decision-advisor SHALL be required before a
  migration slice resolves the conflict.

### Requirement: Every compatibility surface has a deletable retirement record
The deprecation ledger SHALL include every discovered facade, alias, re-export,
old route, feature flag, migration exception, fallback, and compatibility
entry with exact path/member identity, accountable boundary, current
production/test/tooling/dynamic/re-export/documentation consumers, replacement,
zero-consumer proof requirement, deletion condition, follow-up change,
rollback reference, trust invariant, and verification evidence.  A residual
compatibility outcome remains a candidate until a later change proves all
conditions; it is never a qualified deletion.

#### Scenario: A compatibility entry is discovered
- **WHEN** A or the current denominator identifies a compatibility surface
- **THEN** the ledger SHALL give it a stable record ID, exact repository-relative
  location, all caller classes, replacement or unresolved reason, and an
  explicit deletion condition
- **AND** the entry SHALL remain visible until a later change verifies zero
  required consumers, privacy/authority safety, recovery, and rollback.

#### Scenario: A new compatibility layer is proposed
- **WHEN** a later implementation needs a temporary compatibility entry
- **THEN** it SHALL be rejected unless its owner/boundary, consumer set,
  replacement, zero-consumer condition, follow-up change, rollback and trust
  invariants are recorded
- **AND** the charter SHALL not treat an undated facade or re-export as a
  permanent API.

### Requirement: Charter qualification is governance-only
Charter generation and validation SHALL not change product behavior, tests,
TypeScript programs, import enforcement, database state, runtime releases,
deployment state, GitHub coordination, production selectors, Learning Record
writes, Assignment state, current pointers, watermarks, retention, or any
existing privacy/authority contract.  It MAY write only the bounded,
revision-bound decision evidence and compact projections defined by this
change.

#### Scenario: The charter is generated
- **WHEN** the charter command runs
- **THEN** it SHALL read repository-owned baseline and configuration evidence
  only
- **AND** it SHALL not claim work, deploy, activate, or mutate production or
  remote coordination state.

#### Scenario: The residual charter command runs
- **WHEN** the command reads A's verified subject/full artifact, repository
  source/configuration, existing specs and bounded evidence
- **THEN** it SHALL emit only safe repository-relative decision records,
  summaries, projections and locators/digests
- **AND** it SHALL not move files, change imports/exports, delete barrels,
  write facts, run backfills, alter Prisma, open Issues, deploy, publish,
  activate selectors, or mutate production/remote state.

#### Scenario: A qualified or non-qualified result is consumed
- **WHEN** a downstream migration or reviewer reads the scoped projection
- **THEN** it SHALL require the exact subject/tool/schema and frozen-input
  identities and fail closed on missing, stale, mixed or drifted evidence
- **AND** `captured`, `digest-verified`, non-qualified blocker, or
  `qualified-for-investigation` status SHALL never imply active charter,
  deletion authority, or production activation.

### Requirement: Scoped residual outcomes are orthogonal to accountable ownership
Only a member or homogeneous family bound to A's
`src/lib/data-governance/**` scoped denominator MAY use the residual outcome
dimension.  The six mutually exclusive outcomes are exact business-domain
owner, strict cross-domain evidence/processing kernel, explicit operator
tooling/backfill boundary, fixture/demo/test/generated asset,
compatibility/retirement candidate, and unresolved conflict.  Every qualified
scoped record SHALL have exactly one `accountableOwner` drawn from the existing
charter domain-owner catalog and exactly one qualified outcome from the first
five outcomes.  `unresolved` means that owner or outcome evidence is not
closed; it is not a qualified owner or exception and causes both scoped and
global charter qualification to fail.  A residual outcome SHALL never replace
the canonical single-owner requirement for any capability, route, API, model,
worker, script, registry, or test surface.

#### Scenario: A qualified residual record has one owner and one outcome
- **WHEN** an A-bound residual member or homogeneous family has closed
  current-owner, caller, authority, privacy, and trust evidence
- **THEN** the charter SHALL record exactly one existing domain `accountableOwner`
  and exactly one qualified residual outcome
- **AND** the owner and outcome SHALL be serialized as separate fields and
  projected together without using one as evidence for the other.

#### Scenario: Kernel, tooling, fixture, or compatibility outcome has a steward
- **WHEN** an A-bound record receives a kernel, operator-tooling, fixture/demo/
  test/generated, or compatibility/retirement outcome
- **THEN** it SHALL also name exactly one existing domain owner or steward
  accountable for the public boundary, privacy, retention/deletion, and
  maintenance obligations applicable to that outcome
- **AND** a consumer list, caller count, directory, or artifact role SHALL not
  substitute for that unique owner/steward.

#### Scenario: Residual owner or outcome evidence is unresolved
- **WHEN** an A-bound member has multiple candidate owners, no defensible owner,
  incomplete caller/authority/privacy/trust evidence, or an unproven outcome
- **THEN** the record SHALL be marked `unresolved` with safe evidence,
  accountable follow-up information and a resolution condition
- **AND** scoped and global charter qualification SHALL fail without forcing an
  owner or outcome.

#### Scenario: An out-of-scope surface is given a residual outcome
- **WHEN** a capability, route, API, model, worker, script, registry, or test
  surface outside A's `src/lib/data-governance/**` denominator is assigned a
  residual outcome such as compatibility without exactly one accountable
  target domain owner
- **THEN** charter qualification SHALL fail
- **AND** the six-outcome extension SHALL not apply outside the A-bound scoped
  denominator or weaken the canonical single-owner contract.

