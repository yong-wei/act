# adaptive-learner-state-service Specification

## ADDED Requirements

### Requirement: Portrait materialization has a transaction-scoped concurrency guard

The learner portrait update engine SHALL serialize the complete per-learner
snapshot read/update/write unit and SHALL acquire the required database lock
before reading the previous snapshot.

#### Scenario: Concurrent materializations target one learner

- **WHEN** two portrait materialization jobs target the same learner
- **THEN** only one job at a time SHALL read and update that learner's
  incremental snapshot baseline
- **AND** the transaction-scoped lock SHALL be released when the transaction
  commits or rolls back.

#### Scenario: Transaction lock support is unavailable

- **WHEN** the production Prisma transaction client cannot acquire the required
  advisory lock
- **THEN** portrait materialization SHALL fail closed
- **AND** it SHALL NOT write a snapshot without the concurrency guard.
