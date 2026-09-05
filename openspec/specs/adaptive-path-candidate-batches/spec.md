# adaptive-path-candidate-batches Specification

## Purpose
TBD - created by archiving change complete-adaptive-path-candidate-adjustment. Update Purpose after archive.
## Requirements
### Requirement: Candidate adjustment persists an immutable derived batch
The system SHALL persist a materially changed candidate adjustment as a new immutable candidate batch linked to the authorized source batch and source candidate, and SHALL preserve the source batch and the learner's selected or executing path unchanged.

#### Scenario: Adjustment produces materially changed candidates
- **WHEN** an authorized learner adjusts a persisted candidate and the planner returns one or more materially changed candidates
- **THEN** the system SHALL persist a new immutable candidate batch
- **AND** the batch SHALL retain its source batch, source candidate, normalized adjustment request, source fingerprint, active-progress version, and server-produced difference summary.

#### Scenario: Derived batch is persisted
- **WHEN** the derived batch is created successfully
- **THEN** the source candidate and source batch SHALL remain unchanged
- **AND** the learner's active path, current node, completion state, deviations, and execution evidence SHALL remain unchanged.

### Requirement: Candidate adjustment uses stable source identity
The system SHALL resolve an adjustment source from server-owned batch and candidate identities and SHALL NOT use a display label, ordinal, title, or page-local option identifier as candidate authority.

#### Scenario: Source candidate belongs to the requested batch
- **WHEN** the learner submits an adjustment with an authorized batch ID and candidate ID
- **THEN** the system SHALL resolve that exact persisted candidate and verify learner and goal scope before planning.

#### Scenario: Source identity is invalid
- **WHEN** the candidate does not belong to the batch or the request supplies only a page-local option identifier
- **THEN** the system SHALL reject the adjustment without generating or persisting a derived batch.

### Requirement: Candidate adjustment reports non-material and stale results honestly
The system SHALL create a successful derived batch only when governed path facts differ materially and SHALL invalidate results whose source or active-progress version no longer matches current server state.

#### Scenario: Adjustment has no material difference
- **WHEN** adjusted candidates preserve the source node identities, node order, and supported path metrics without a material change
- **THEN** the system SHALL return `no_material_difference`
- **AND** it SHALL NOT persist or display a cosmetic successful batch.

#### Scenario: Adjustment result becomes stale
- **WHEN** the source batch, source candidate fingerprint, normalized request identity, or active-progress version changes before completion
- **THEN** the result SHALL be treated as stale
- **AND** it SHALL NOT replace the visible batch, mutate the active path, or create path-choice evidence.

### Requirement: Successful generation persists an immutable candidate batch
The system SHALL persist each explicitly successful adaptive path generation as one candidate batch containing the planner-produced candidates in their original order, and SHALL NOT create a successful batch for active, blocked, failed, or transport-unknown generation states.

#### Scenario: Successful generation creates one batch
- **WHEN** a generation request reaches the explicit succeeded state with planner candidates
- **THEN** the system persists one successful batch and its ordered candidates

#### Scenario: Active or unknown generation creates no successful batch
- **WHEN** a generation request is pending, running, awaiting approval, or has an unknown transport outcome
- **THEN** the system does not expose a successful candidate batch for that request

### Requirement: Generation retries are idempotent by request identity
The system SHALL associate at most one candidate batch with a generation request identity and SHALL return the same batch and candidate identities when the same request is retried.

#### Scenario: Retried successful request reuses the batch
- **WHEN** the same `generationRequestId` is submitted after its candidate batch was persisted
- **THEN** the system returns the existing batch without creating or rewriting candidates

### Requirement: Candidate identity is stable and server-owned
Every persisted candidate SHALL have a stable identifier scoped to its batch, and consumers MUST NOT infer candidate identity from its title, label, ordinal, or conversation text.

#### Scenario: Candidate is reopened by identifier
- **WHEN** an authorized consumer reads a candidate by batch ID and candidate ID
- **THEN** the system returns the originally persisted planner candidate regardless of display-label changes

### Requirement: Candidate batches are separate from selected and executing paths
Persisting a new candidate batch SHALL NOT replace, reset, or mutate the learner's selected, active, fallback, or completed `LearningPath`.

#### Scenario: New generation preserves active execution
- **WHEN** a learner with an active path successfully generates a newer candidate batch
- **THEN** the active path, current node, execution evidence, and terminal validation remain unchanged

### Requirement: Candidate batch reads enforce learner ownership
The system SHALL authorize exact and latest candidate-batch reads using the same learner, teacher-class, and administrator boundaries as learning-path reads.

#### Scenario: Student reads own latest batch
- **WHEN** a student requests the latest successful batch for their own registered goal
- **THEN** the system returns the newest successful batch ordered by server creation time

#### Scenario: Student requests another learner batch
- **WHEN** a student requests a batch owned by another learner
- **THEN** the system denies the request without disclosing batch contents

### Requirement: Candidate snapshots preserve planner output
The system SHALL preserve the planner's candidate ordering, policy identity, executable nodes, explanations, limitations, resource mix, and version metadata without re-ranking or rewriting them.

#### Scenario: Batch projection matches planner result
- **WHEN** a persisted batch is read by Konling or the path center
- **THEN** both consumers receive projections derived from the same immutable candidate snapshots

### Requirement: Candidate batches keep only material path differences

Persisted adaptive-path candidate batches SHALL include only executable candidates whose material facts differ. Material facts are node identity and order, personalizable resource mix, estimated effort, checkpoints, and terminal validation. Title, description, explanation, score, and client display order SHALL NOT create a new candidate. Shared required prerequisite or terminal-validation nodes MAY be identical.

#### Scenario: Title-only duplicates are rejected

- **WHEN** two generated options differ only in label, description, or score
- **THEN** the batch SHALL persist one candidate
- **AND** it SHALL record a diversity limitation explaining the reduction

#### Scenario: Shared required nodes remain distinct options

- **WHEN** two options share terminal-validation nodes but differ in remaining node identity, order, resource mix, or effort
- **THEN** both candidates SHALL remain in the batch

#### Scenario: Resource coverage is insufficient

- **WHEN** material facts cannot support two distinct executable options
- **THEN** the batch SHALL persist the real candidate count
- **AND** it SHALL expose a student-understandable limitation instead of fabricating another card

### Requirement: Candidate batches honor the target option count
成功生成的不可变候选批次 SHALL 与路径规划合同共享同一目标候选数；当策略族请求存在且资源多样性可用时，批次 `candidateCount` SHALL 等于 3。

#### Scenario: Generation persists exactly three candidates
- **WHEN** 一次成功生成因冷启动或低置信自动注入 starter 策略族并持久化候选批次
- **THEN** 该批次的 `candidateCount` SHALL 等于 3
- **AND** 每个候选的 `ordinal` SHALL 在 1..3 范围内连续
- **AND** 批次 SHALL NOT 包含主规划族额外追加的第 4 条候选。

#### Scenario: Adjusted derivation preserves the option count
- **WHEN** 学生基于既有批次发起候选调整并派生新批次
- **THEN** 派生批次 SHALL 沿用同一目标候选数约束，除非规划器显式返回低资源 fallback 状态
- **AND** fallback 状态 SHALL 在批次 metadata 中如实记录，不得以追加候选补足数量。

