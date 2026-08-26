# Migration, Backfill, and Competition Toolchains

## ADDED Requirements

### Requirement: One-off tools have explicit classification and ownership

Every migration, historical repair/backfill, and competition-material helper in
the declared denominator SHALL have one registered owner, command ID, input
contract, output class, and verification command. Product routes and ordinary
runtime code SHALL not be classified as one-off tools merely because tests
invoke them.

#### Scenario: An unclassified historical script is found

- **WHEN** the tool registry is built
- **THEN** the script is blocked from the product graph and reported as
  unclassified
- **AND** no generic facade makes it appear safe to execute

### Requirement: Data-changing commands fail safe by default

Migration, repair, and backfill commands SHALL default to dry-run. An apply
operation SHALL require explicit approval, target identity, plan/input hash,
  idempotency evidence, and a durable receipt. This change SHALL not execute an
apply operation against production or user data.

#### Scenario: Apply approval is absent or stale

- **WHEN** an operator invokes an apply-capable command without approval or
  with a plan hash that differs from the current input
- **THEN** the command fails closed before a write
- **AND** the receipt records the rejection and target identity without
  disclosing credentials

### Requirement: Historical backfill preserves canonical evidence integrity

Backfill tools SHALL preserve source traceability, stable record identity,
idempotency, selected regeneration scope, and no-fabrication rules from
`course-evidence-backfill-reporting`. Public results SHALL apply the existing
learner-based suppression and privacy rules.

#### Scenario: A backfill source is incomplete

- **WHEN** a source record cannot support a canonical evidence field
- **THEN** the tool records the omission or failure in its receipt
- **AND** it does not invent an answer, event, learner, or completion result

### Requirement: Competition output is deterministic and public-safe

Competition helpers SHALL emit only deterministic, resettable demo and
submission material defined by `competition-demo-baseline`, including its route
ledger and source identity. They SHALL reject credentials, local absolute paths,
learner identifiers, raw answers, and private audit evidence.

#### Scenario: A submission bundle is generated

- **WHEN** the competition tool builds a public bundle from the declared fixture
- **THEN** the bundle is reproducible and carries a verification receipt
- **AND** privacy validation fails closed if a forbidden value is present

### Requirement: Product graphs cannot import one-off writers

The web/runtime graph SHALL NOT import migration writers, backfill mutators,
repair scripts, or competition submission-material generators. Approved public
contracts and route metadata may be consumed only through the existing bounded
interfaces.

#### Scenario: Product typecheck is executed

- **WHEN** the production/web graph is typechecked and import-scanned
- **THEN** one-off tool implementations are excluded
- **AND** product behavior does not depend on a migration or submission command

### Requirement: Retired entrypoints are removed or explicitly archived

After migration, old executable entrypoints SHALL be deleted or recorded in an
archive ledger with a non-executable status. A forwarding facade SHALL NOT be
counted as isolation.

#### Scenario: All classified callers are migrated

- **WHEN** the tool and test graphs pass their import checks
- **THEN** no caller reaches a retired one-off path
- **AND** each remaining historical script has an owner and lifecycle status

### Requirement: One-off verification produces portable receipts

Each tool class SHALL have an independent typecheck/test path and a receipt
recording command identity, source revision, input/plan hash, target or fixture
identity, output hashes/counts, approval state, and result. Receipts SHALL use
portable paths and redact private values.

#### Scenario: A dry-run is audited

- **WHEN** a dry-run or competition build completes
- **THEN** its receipt is sufficient to reproduce the input selection and verify
  the result without relying on a local absolute path or secret

