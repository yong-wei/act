## MODIFIED Requirements

### Requirement: Batch grading is observable, resumable, and failure-isolated
The system SHALL support question-scoped grading batches with durable progress, per-answer item state, cancellation, retry, deduplication, provider limitation reporting, and source-aware conversion routing. Assignment-level one-click grading SHALL orchestrate those question-scoped batches after the original deadline, freeze submitted attempts at operation creation, and preserve prior grading history.

#### Scenario: Teacher grades one question across a class
- **WHEN** an authorized teacher starts a batch for eligible submitted answers to one assignment question after the original deadline
- **THEN** the batch SHALL freeze assignment question, rubric, evaluator, rubric-grading policy, answer-conversion policy state, and independent item states
- **AND** each unified-response binary attachment SHALL use Mathpix only when the frozen answer-conversion policy permits.

#### Scenario: Teacher grades unified assignment responses across a class
- **WHEN** an authorized teacher starts a batch for eligible submitted answers to one assignment question after the original deadline
- **THEN** the batch SHALL freeze assignment question, rubric, evaluator, the rubric-grading policy, and the answer-conversion policy state
- **AND** a binary unified-response attachment SHALL use Mathpix only when the frozen answer-conversion policy permits and otherwise become understanding-unavailable
- **AND** it SHALL NOT use the governed local document path as fallback for that binary attachment
- **AND** it SHALL create independent item states and grading runs for each answer.

#### Scenario: Teacher batches non-assignment grading documents
- **WHEN** an authorized workflow starts a batch for grading documents that are not bound to unified assignment responses
- **THEN** the batch MAY continue to use the canonical governed local conversion path
- **AND** this assignment attachment exception SHALL NOT change that route.

#### Scenario: Teacher starts an assignment-level grading operation
- **WHEN** an authorized teacher starts one-click grading for a published assignment after the original deadline
- **THEN** the system SHALL freeze an immutable assignment submission snapshot with its ordered question-attempt vector and create or reuse question-scoped batch work for each eligible attempt
- **AND** later submissions or resubmissions SHALL not enter that operation.

#### Scenario: One batch item fails
- **WHEN** one answer conversion or evaluator call fails
- **THEN** that item SHALL expose its failure and retry state without invalidating successful sibling items
- **AND** the affected student result SHALL remain unconfirmable until the question is retried, manually graded, or explicitly concluded by the teacher.

#### Scenario: Same batch request is repeated
- **WHEN** an equivalent active or completed batch dedupe key is requested
- **THEN** the system SHALL return the existing batch for the same idempotency key.

#### Scenario: Teacher explicitly requests a rerun
- **WHEN** an authorized teacher supplies a rerun reason for the same or a newer frozen evaluator/input version
- **THEN** the system SHALL create a new rerun identity without overwriting prior runs
- **AND** any existing teacher review SHALL explicitly adopt or reject the new run.
