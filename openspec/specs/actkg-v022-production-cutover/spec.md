# actkg-v022-production-cutover Specification

## Purpose
Atomically activate the qualified ActKG v0.22 composite envelope on production while keeping rollback evidence for the previous envelope.
## Requirements
### Requirement: Activation requires the qualified handoff and remains a separate release action

Production activation MUST be a release action separate from candidate import
and runtime publication. Immediately before transaction entry, the operator
MUST verify the deployed envelope-capable runtime identity, the qualification
evidence produced by `validate-v022-composite-cutover-candidate`, the sealed
v0.22 composite release envelope targets, and the complete previous-envelope
predecessor identities of all five selectors.

#### Scenario: Qualification evidence is missing or drifted

- **WHEN** the qualification evidence is absent, belongs to a different
  envelope, or any runtime, target, or predecessor identity differs from the
  sealed handoff
- **THEN** transaction entry MUST be refused without modifying any selector

### Requirement: All five selectors advance atomically to the same composite release envelope

Under one exclusive production lock with a sealed, re-read write-ahead
journal, the activation MUST advance Authority, Teaching Projection,
prerequisite, Authority domain shard/catalog, and shared consumer-activation
selectors to the same qualified v0.22 composite release envelope. The shared
consumer-activation pointer MUST be the only READY commit point. If any
selector cannot be moved, or after activation any selector still resolves an
older release, the activation MUST fail closed and production MUST remain
fully on the previous envelope; a mixed composite state SHALL never be exposed
as production.

#### Scenario: One selector cannot be moved

- **WHEN** any of the five selector writes fails or a re-read shows a selector
  still bound to v0.9 or v0.18
- **THEN** the transaction MUST abort, restore the complete previous-envelope
  selector set, and MUST NOT commit the consumer-activation pointer

#### Scenario: All selectors resolve the same qualified envelope

- **WHEN** all five selectors re-read as the journaled v0.22 envelope
  identities and the shared consumer-activation pointer commits
- **THEN** the activation MAY become READY and proceed to post-activation
  verification

### Requirement: A previous-envelope snapshot supports one-action five-selector rollback

Before the forward switch, the activation MUST seal a snapshot of all five
previous-envelope selector identities and exercise the rollback path. Within
the rollback window, one rollback action MUST restore all five selectors
together to the snapshot. Compensation MAY replace only pointers whose current
identities match the journaled v0.22 targets.

#### Scenario: Post-activation verification fails without concurrent drift

- **WHEN** a required observation fails and current selectors still match the
  journaled v0.22 targets
- **THEN** the rollback SHALL atomically restore all five previous-envelope
  selectors and re-verify the restored envelope

#### Scenario: A selector holds an unexpected concurrent identity

- **WHEN** compensation observes an identity that is neither the journaled
  target nor the snapshot predecessor
- **THEN** recovery MUST stop, preserve the journal and snapshot, and report
  that operator intervention is required

### Requirement: Post-activation verification proves full reviewed domain membership and display hygiene

After the READY commit point, verification MUST prove that `/knowledge` serves
the activated envelope's domain catalog with the full reviewed membership
recorded in the qualification evidence, that admitted Chinese preferred and
fallback display coverage is intact, and that no internal identifiers (object
IDs, relation IDs, release, snapshot, activation, projection names, version
hashes, internal enums, or paths) are learner-visible. Expected membership
MUST come from the activated envelope's evidence, not hard-coded counts.

#### Scenario: A domain shows only residual legacy membership

- **WHEN** any `/knowledge` domain resolves fewer reviewed members than the
  qualification evidence records for the activated envelope
- **THEN** verification MUST fail and the journaled five-selector rollback
  MUST be invoked rather than leaving the state current

#### Scenario: All observations pass

- **WHEN** domain membership, Chinese display coverage, identifier hygiene,
  shared consumers, worker health, and public readiness all resolve the
  activated v0.22 envelope
- **THEN** the workflow SHALL seal a successful activation receipt and retain
  the previous-envelope snapshot for the rollback window

### Requirement: Superseded envelopes persist only as read-only history and rollback evidence

After activation settles, v0.9 and v0.18 artifacts MUST remain preserved but
MUST be reachable only through read-only history entries and rollback
evidence. Normal production reads MUST NOT resolve any superseded envelope,
and this change MUST NOT delete or retire those artifacts.

#### Scenario: A normal read targets a superseded envelope

- **WHEN** a normal production read path would resolve v0.9 or v0.18 content
  after the activation receipt is sealed
- **THEN** the state MUST be treated as a verification failure subject to the
  rollback requirement, not as an acceptable hybrid

