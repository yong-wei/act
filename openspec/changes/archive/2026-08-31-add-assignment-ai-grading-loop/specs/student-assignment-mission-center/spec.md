## MODIFIED Requirements

### Requirement: Student assignment states expose a valid next action
Task Center and assignment detail SHALL present authoritative assignment and question states with a clear next action and recoverable error state. For new teacher-confirmed-result revisions, the state SHALL distinguish pending grading, grading in progress, partial failure, awaiting teacher confirmation, released, and authorized post-deadline resubmission without exposing internal grading details.

#### Scenario: Mainline assignments are loading
- **WHEN** Task Center is resolving the student's mainline assignment scope
- **THEN** the page SHALL show a non-deceptive loading state that preserves the current tab and does not present stale counts as final.

#### Scenario: Student has no mainline assignments
- **WHEN** the authorized assignment query returns no current or historical mainline work
- **THEN** the page SHALL show a true empty state with a clear explanation and retain access to `任务进阶`.

#### Scenario: Assignment filters have no matches
- **WHEN** mainline assignments exist but the current status or course filters return no rows
- **THEN** the page SHALL show a filtered-empty state with a clear-filter action rather than the no-assignment message.

#### Scenario: Assignment state changes downstream
- **WHEN** conversion, AI grading, manual grading, teacher review, approval, assignment confirmation, result release, return, or deadline processing changes a student's assignment state
- **THEN** the student view SHALL display the current permitted state and next action
- **AND** it SHALL not expose unconfirmed scores, comments, Provider failures, or teacher-only grading history.

#### Scenario: Student result is released
- **WHEN** the owning student's confirmed assignment result is released
- **THEN** assignment detail SHALL display the released final score, question results, teacher-confirmed comments, reference answers, and scoring standards as one result package.

#### Scenario: Teacher authorizes a post-deadline resubmission
- **WHEN** the original deadline has passed and the teacher has returned work with a valid resubmission deadline
- **THEN** the student view SHALL show the authorized resubmission action and deadline
- **AND** it SHALL not allow a resubmission before that grant exists.

#### Scenario: Assignment context is missing or stale
- **WHEN** a saved route references a removed audience, unavailable revision, or stale attempt
- **THEN** the page SHALL show a recoverable missing-context state and a return action to `/missions` rather than a generic failure page.
