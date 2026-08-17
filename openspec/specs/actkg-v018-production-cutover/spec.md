# actkg-v018-production-cutover Specification

## Purpose
TBD - created by archiving change activate-actkg-v018-production-cutover. Update Purpose after archive.
## Requirements
### Requirement: Production cutover requires an unchanged qualified handoff

Immediately before transaction entry, the operator MUST verify the deployed OCI
identity, qualification and runtime-publication receipts, sealed v0.18 targets,
complete v0.9 predecessor set, production marker, and all current pointer hashes.

#### Scenario: Any handoff or predecessor identity drifts

- **WHEN** a receipt, runtime, target, marker, lock, or current pointer differs
- **THEN** transaction entry MUST be refused without modifying a pointer

### Requirement: Five knowledge selectors advance through one write-ahead transaction

Under one exclusive production lock, the workflow MUST seal and re-read a
write-ahead journal, compare current v0.9 identities, and atomically advance
Authority, Teaching Projection, prerequisite, Authority domain-shard, then
shared consumer activation. The consumer-activation pointer MUST be the only
READY commit point.

#### Scenario: All prepared component writes succeed

- **WHEN** Authority, Teaching Projection, prerequisite, and Authority
  domain-shard targets have been written and re-read but the consumer pointer
  is not yet committed
- **THEN** the release set MUST NOT be reported READY

#### Scenario: The shared consumer pointer commits

- **WHEN** all six records agree on the same v0.18 Authority and teaching identities
- **THEN** the transaction MAY become READY and proceed to post-switch verification

### Requirement: The v0.9 rollback is exercised and identity constrained

The operator MUST exercise the rollback path before the forward switch and
retain complete v0.9 predecessor pointers. After transaction entry, compensation
MAY replace only pointers whose current identities equal the journaled v0.18 targets.

#### Scenario: Post-switch verification fails without concurrent drift

- **WHEN** a required observation fails and current pointers still match v0.18 targets
- **THEN** the workflow SHALL atomically restore the complete v0.9 set and verify all six consumers

#### Scenario: A pointer contains an unexpected concurrent identity

- **WHEN** compensation observes neither the journaled target nor predecessor identity
- **THEN** recovery MUST stop, preserve the journal, and report operator intervention required

### Requirement: Post-switch verification proves production graph and teaching behavior

After the READY commit point, the workflow MUST verify pointer and receipt
closure, 6,843 visible nodes, 2,811 relations, admitted Chinese preferred and
fallback labels, absence of learner-visible system identifiers, teaching
queries, cards and infographs, prerequisites, all six named consumers,
app/worker health, and public readiness.

#### Scenario: All production observations pass

- **WHEN** every required observation resolves the sealed v0.18 release set
- **THEN** the workflow SHALL seal a successful cutover receipt and keep v0.9 as rollback

#### Scenario: Any required observation fails

- **WHEN** a required count, label, query, consumer, health, or readiness check fails
- **THEN** the workflow MUST invoke the journaled rollback rather than leave mixed state

### Requirement: Successful cutover does not retire historical knowledge

The operation MUST retain the complete v0.9 release set, rollback evidence, and
Legacy view after success. Deletion or retirement requires a separate change
after an independently defined observation window.

#### Scenario: v0.18 cutover succeeds

- **WHEN** the successful receipt is sealed
- **THEN** v0.9 and Legacy artifacts SHALL remain available and unmodified

