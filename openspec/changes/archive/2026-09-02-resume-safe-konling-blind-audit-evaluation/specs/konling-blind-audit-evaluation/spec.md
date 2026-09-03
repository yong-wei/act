## ADDED Requirements

### Requirement: Blind-audit evaluation persists each record atomically with a unique task key
The knowledge-QA blind-audit runner SHALL assign every audit task a unique key derived from benchmark version, evaluation mode, item id, and replicate, and SHALL write each completed record to the run directory atomically before proceeding to the next task.

#### Scenario: A record completes
- **WHEN** one audit task finishes
- **THEN** its record SHALL be durably present in the run directory under its task key with model, provider, prompt version, score version, timestamps, and git revision
- **AND** a later crash SHALL NOT leave a partially written record under that key.

#### Scenario: A task fails
- **WHEN** the external model service fails for one task with rate limiting, timeout, insufficient balance, or a parse error
- **THEN** the runner SHALL persist the failure attempt with a structured error code and message as its own immutable file
- **AND** repeated failures across resumed runs SHALL accumulate attempts without losing or overwriting earlier history
- **AND** the runner SHALL continue or terminate without corrupting completed records.

#### Scenario: Blind audit reviews the candidate answer
- **WHEN** a blind-audit task executes
- **THEN** the judge SHALL receive the versioned candidate answer as the explicit object of review
- **AND** the reference points SHALL be presented only as comparison material, never as the reviewed answer.

### Requirement: Repeated runs resume without re-billing completed work
The runner SHALL skip any task key whose completed record already exists in the run directory, and SHALL NOT overwrite frozen completed records.

#### Scenario: Execution resumes after interruption
- **WHEN** a run is interrupted at an arbitrary completion ratio and executed again with the same run identity
- **THEN** already completed tasks SHALL NOT be submitted to the external service again
- **AND** the run SHALL continue from the first unfinished task to completion.

#### Scenario: Concurrent writes to one task key
- **WHEN** two processes persist a record for the same task key concurrently
- **THEN** exactly the first writer SHALL win and the second SHALL abandon its write without overwriting the frozen record.

#### Scenario: A failed task is retried
- **WHEN** a run encounters persisted failure records
- **THEN** the next run MAY retry each failed task at most once
- **AND** the previous failure record SHALL remain available for audit after the retry.

### Requirement: Aggregation fails closed for incomplete batches
The aggregation stage SHALL compare the manifest's expected item count with completed and failed records, and SHALL mark the batch `incomplete` when fewer than the expected records are completed.

#### Scenario: Incomplete batch
- **WHEN** completed records are fewer than the manifest expectation
- **THEN** the summary SHALL carry `status: "incomplete"` with progress diagnostics
- **AND** official expert/model comparison metrics SHALL NOT be emitted.

#### Scenario: Mixed configuration detected
- **WHEN** records in one run disagree on model, provider, prompt version, score version, or captured code revision
- **THEN** aggregation SHALL refuse to produce official metrics.

#### Scenario: Manifest drift on resume
- **WHEN** the benchmark manifest hash changes between the original run and a resumed run
- **THEN** the resumed run SHALL fail before submitting any task.

#### Scenario: Aggregation receives a different manifest than the run snapshot
- **WHEN** aggregation is invoked with a manifest whose content hash differs from the run's manifest snapshot, or whose expected task keys do not exactly match the completed record keys
- **THEN** aggregation SHALL refuse to produce official metrics for that run.

### Requirement: Rule scoring and blind audits stay separated
Rule-based scores and independent blind-audit judgments SHALL be recorded and summarized in separate mode subtrees, and aggregation SHALL NOT merge them into one result set.

#### Scenario: Both modes run in one benchmark
- **WHEN** a benchmark executes rule-score and blind-audit modes
- **THEN** their records and summaries SHALL live under distinct mode paths
- **AND** neither summary SHALL silently incorporate the other mode's records.
