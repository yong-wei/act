# manifest-course-shared-classroom-shell Specification

## Purpose

Define the qualified `unit-1-2-modeling-from-object-to-system` vertical slice
from runtime manifest to shared teacher/student classroom shell, preserving
session, evidence, role, and optional-resource behavior while removing its
private authorities.

## ADDED Requirements

### Requirement: The pilot uses one canonical runtime identity

The pilot SHALL use canonical lesson identity `1-2`, its runtime bundle revision,
and the captured manifest hash for entry, session, student, teacher, waiting,
media, and knowledge-card reads. It MUST NOT read authoring content or infer
identity from a mutable plan title.

#### Scenario: The pilot session is launched

- **WHEN** a teacher starts the `1-2` classroom
- **THEN** the session MUST capture the qualified CourseBundle revision and
  manifest hash
- **AND** the route and shell MUST use that identity on subsequent reads.

#### Scenario: The plan title changes after launch

- **WHEN** the `LessonPlan.title` or an alias changes while the session is active
- **THEN** teacher and student refreshes MUST continue to resolve the original
  canonical bundle
- **AND** no new lesson identity may be inferred.

### Requirement: Teacher, student, and waiting use the shared shell

The pilot's teacher, student, and waiting routes SHALL invoke the shared
Classroom session use cases and shell. They MUST share access, lifecycle,
stream/reconnect, and bundle binding rather than retaining course-private
session state machines.

#### Scenario: Teacher and student use one session

- **WHEN** an authorized teacher launches and a student joins the pilot
- **THEN** both MUST use the same session id/access policy and captured bundle
- **AND** teacher-only controls MUST be role-projected by the shell/plugin.

#### Scenario: The student reconnects

- **WHEN** the student refreshes or reconnects after a stream interruption
- **THEN** the shared read/stream use cases MUST restore the current step and
  live projection
- **AND** the student MUST not receive teacher state or reference answers.

### Requirement: Pilot submissions use durable evidence and shared live state

All pilot response-producing steps SHALL use the shared submission evidence
contract, while draft/progress data uses the live-state contract. Resubmissions
MUST preserve distinct durable attempts and teacher/report consumers MUST NOT
recover answers from mutable state alone.

#### Scenario: A pilot activity is submitted twice

- **WHEN** a student submits and then resubmits the same step with a new attempt
- **THEN** both durable attempts MUST remain distinguishable
- **AND** overwriting live state MUST not erase either response.

#### Scenario: Teacher preview is opened

- **WHEN** a teacher previews a pilot step
- **THEN** the preview MAY render role-safe content
- **AND** it MUST create no student state, interaction log, response, or learning
  fact.

### Requirement: Manifest content uses registered plugins

The pilot SHALL resolve every manifest module/activity/layout through the typed
plugin registry and SHALL use the migrated real renderer for its declared
capabilities. It MUST NOT add a course-specific branch to the central renderer.

#### Scenario: A pilot compute/visual module renders

- **WHEN** a pilot step includes a registered compute or visual capability
- **THEN** the shared registry MUST render it with the declared role/evidence
  contract
- **AND** unsupported required modules MUST expose the explicit missing-renderer
  result.

#### Scenario: An optional pilot surface is unavailable

- **WHEN** pilot media or a knowledge-card projection is missing
- **THEN** the base manifest step MUST remain available
- **AND** the missing surface MUST be observable without changing identity.

### Requirement: Pilot behavior is characterized before private deletion

The implementation SHALL freeze a behavior matrix for route responses, session
operations, step progression, submissions, teacher projection/reveal, waiting,
media, knowledge cards, accessibility markers, finalization, and bundle/manifest
identity before deleting pilot authorities.

#### Scenario: Pilot qualification is reviewed

- **WHEN** the migration is proposed as qualified
- **THEN** focused tests and browser evidence MUST cover teacher, student,
  unauthorized/wrong-class, and preview contexts
- **AND** each behavior delta MUST be accepted or block qualification.

#### Scenario: A behavior differs without an approved contract change

- **WHEN** shared-shell output differs from the characterization matrix
- **THEN** qualification MUST fail
- **AND** the implementation MUST not hide the difference behind a private
  fallback.

### Requirement: Private pilot authorities are deleted after zero consumers

Once all pilot callers use the shared shell, application service, bundle, plugin,
and evidence contracts, the old pilot route/component authorities and direct
session/evidence calls SHALL be removed. A permanent redirect, facade, or second
state machine MUST NOT count as migration.

#### Scenario: Pilot caller inventory reaches zero

- **WHEN** static, dynamic, test, and browser entry inventories contain no
  authoritative private caller
- **THEN** the old route/component authority MUST be deleted in the qualified
  migration revision
- **AND** the ledger MUST record the replacement and deletion proof.

#### Scenario: A private caller remains

- **WHEN** a route, test, or browser entry still invokes a private authority
- **THEN** pilot qualification MUST remain blocked
- **AND** the old authority MUST not be described as retired.

### Requirement: Pilot verification includes browser and ledger evidence

The pilot SHALL pass focused manifest/identity/session/live/evidence/plugin tests,
affected Interactive/Classroom domain tests, typecheck/lint/build checks required
by the implementation, and Playwright/browser acceptance. A qualification ledger
MUST bind all evidence to one source revision.

#### Scenario: The full pilot browser journey is run

- **WHEN** teacher launch/waiting, student join, progression, submit/resubmit,
  teacher reveal/review, refresh/reconnect, and session finish are exercised
- **THEN** behavior MUST match the matrix and role/evidence/bundle invariants
- **AND** browser artifacts MUST be linked from the ledger.

#### Scenario: Pilot OpenSpec validation is run

- **WHEN** `openspec validate migrate-one-manifest-course-to-shared-classroom-
  shell --type change --strict` and `git diff --check` are run
- **THEN** the denominator, characterization, deletion, browser, and
  qualification artifacts MUST be complete.
