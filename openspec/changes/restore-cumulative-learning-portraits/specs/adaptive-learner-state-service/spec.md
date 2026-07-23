## MODIFIED Requirements

### Requirement: Learner portrait updates are stable and incremental
The learner portrait update engine SHALL treat portrait data as cumulative
long-term state that is changed only by governed evidence or an explicit
calculation-version migration. It SHALL process each learner's facts in stable
fact order through the same deterministic reducer for incremental updates,
retries, and rebuilds.

#### Scenario: No new evidence is available
- **WHEN** a learner has an existing portrait v2 state
- **AND** no new governed evidence affects that state
- **THEN** dimension scores, confidence, trend, risk, and portrait availability SHALL be preserved
- **AND** elapsed calendar time SHALL only change the displayed evidence age.

#### Scenario: Sparse evidence affects one dimension
- **WHEN** new governed evidence affects only one portrait dimension
- **THEN** only that dimension and its dependent aggregate state SHALL receive an update
- **AND** unrelated dimensions, trends, and risks SHALL NOT be reset.

#### Scenario: Negative evidence is processed
- **WHEN** governed evidence explicitly indicates failure, misconception, unsafe action, or low-quality work
- **THEN** affected dimensions MAY decrease through a bounded update
- **AND** the update SHALL include rationale and evidence lineage.

#### Scenario: Context-only evidence is processed
- **WHEN** a LearningFact or event is marked as context-only or has no profile contribution
- **THEN** it SHALL NOT overwrite any portrait score, trend, risk, or confidence
- **AND** it MAY appear in evidence context or activity history.

#### Scenario: Multiple facts for one learner are processed
- **WHEN** multiple facts for one learner enter one worker request or several retries
- **THEN** the engine SHALL order them by occurrence time and stable fact identity and fold them one at a time
- **AND** worker batch boundaries SHALL NOT change the resulting portrait.

#### Scenario: Historical fact changes the stable order
- **WHEN** a governed fact is corrected, revoked, or inserted before the learner's current state watermark
- **THEN** the engine SHALL rebuild only that learner from the complete eligible fact sequence
- **AND** the rebuilt result SHALL equal a fresh fold of that sequence.

## ADDED Requirements

### Requirement: Learner portrait is cumulative and evidence-triggered
The learner-state service SHALL expose one canonical cumulative portrait v2
formed from all eligible learning facts for the learner. The portrait SHALL
remain usable until governed evidence or a calculation-version change produces
a replacement state.

#### Scenario: Portrait is read after a period without activity
- **WHEN** a learner has a valid cumulative portrait and no newer eligible fact
- **THEN** student, teacher, diagnosis, and class consumers SHALL receive the same portrait values
- **AND** the response SHALL expose the evidence cutoff without marking the portrait unavailable because of age.

#### Scenario: New eligible evidence is accepted
- **WHEN** a new fact passes governance and has an explicit portrait contribution
- **THEN** the learner's cumulative portrait SHALL be incrementally updated
- **AND** the update SHALL preserve unaffected dimensions and evidence lineage.

#### Scenario: Fact has no portrait contribution
- **WHEN** a fact is valid for activity history but cannot map to a portrait dimension, trend, or risk
- **THEN** it SHALL NOT change the cumulative portrait
- **AND** it SHALL NOT be counted as portrait-supporting evidence.

### Requirement: Learner portrait reconciliation is idempotent and learner-scoped
The system SHALL allow a learner or an authorized teacher to request a portrait
reconciliation that processes only eligible fact changes not yet reflected in
the learner's current state.

#### Scenario: Learner requests reconciliation with pending facts
- **WHEN** an authenticated learner requests portrait reconciliation and eligible pending facts exist
- **THEN** the system SHALL enqueue one idempotent learner-scoped task
- **AND** that task SHALL process the pending facts through the canonical reducer.

#### Scenario: Teacher requests class reconciliation
- **WHEN** an authorized teacher requests reconciliation for a current class
- **THEN** the system SHALL enqueue independent learner-scoped tasks for current members
- **AND** it SHALL report processing, completed, and failed learner counts without combining member facts.

#### Scenario: Reconciliation has no pending fact
- **WHEN** reconciliation finds no eligible fact change beyond the learner's current watermark
- **THEN** it SHALL complete without creating a new portrait snapshot
- **AND** it SHALL NOT change scores, timestamps, trend, risk, or confidence.

### Requirement: Cumulative portrait migration is deterministic and reversible
The system SHALL provide an idempotent migration that rebuilds existing learner
portraits and current-class aggregates with the canonical cumulative reducer
without rewriting source LearningFacts.

#### Scenario: Migration is rehearsed
- **WHEN** a latest production database export is restored to an isolated local environment
- **THEN** dry-run and apply modes SHALL report stable fact, learner, portrait, class, skipped, and failed counts
- **AND** rerunning the migration against the same input SHALL produce the same final portraits and aggregates.

#### Scenario: Production migration is executed
- **WHEN** local rehearsal has passed and production application, worker, and scheduler writes are stopped
- **THEN** the same migration SHALL run after a recoverable database backup
- **AND** services SHALL remain stopped until portrait, aggregate, and representative page verification succeeds.

#### Scenario: Production migration verification fails
- **WHEN** migration or verification fails
- **THEN** the operator SHALL restore the pre-migration database backup and previous application version
- **AND** a partially migrated state SHALL NOT be served.
