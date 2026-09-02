# course-routes-shared-classroom-shell-batch-b Specification

## Purpose

Define the advanced route batch migration to the existing shared Classroom
shell, including compute and simulation-backed manifest surfaces, while
preserving all established runtime and evidence boundaries.

## Requirements

### Requirement: Batch B has a closed canonical route denominator

The migration SHALL cover exactly lesson ids `4-1`, `4-2`, `4-3`, `4-4`,
`4-5`, `4-6`, `4-7`, `5-1`, `5-2`, `5-3`, `5-4`, `5-5`, `5-6`, and
`cruise-comfort-boppps`, including applicable entry, student, teacher, waiting,
and demo routes.  It SHALL not modify the Batch-A denominator.

#### Scenario: A Batch-B alias is requested

- **WHEN** a supported route, lesson, preset, or evidence alias selects a
  Batch-B lesson
- **THEN** the route SHALL resolve its canonical identity and qualified runtime
  bundle
- **AND** it SHALL use the shared shell rather than a private session path.

#### Scenario: A non-Batch-B route is requested

- **WHEN** a unit-1, unit-2, unit-3, or unrelated legacy route is requested
- **THEN** this change SHALL not migrate or reinterpret that route
- **AND** the separate batch qualification SHALL remain authoritative.

### Requirement: Advanced routes use the shared Classroom session path

Batch-B entry, student, teacher, waiting, and demo routes SHALL use the
existing Classroom shell and application use cases for authentication, class
access, session creation/join, waiting, reconnect, progression, and
finalization.  A course-specific session state machine SHALL not remain.

#### Scenario: A teacher launches an advanced lesson

- **WHEN** an authorized teacher starts a Batch-B lesson or Cruise classroom
- **THEN** the route SHALL delegate session and class authorization to the
  existing Classroom owner
- **AND** course configuration SHALL be limited to canonical lesson and
  registered capability identity.

#### Scenario: A student reconnects

- **WHEN** a student refreshes or reconnects after a stream interruption
- **THEN** the shared session use cases SHALL restore the current live
  projection and step
- **AND** the student SHALL receive no teacher-only state or reference answer.

### Requirement: Compute and simulation surfaces retain runtime boundaries

Batch-B compute, control-workbench, interactive-figure, generated-slide, and
simulation-backed modules SHALL be selected through the existing manifest
plugin/registry contracts and runtime adapters.  Browser route code SHALL not
implement numerical physics or introduce course-name renderer branches.

#### Scenario: A simulation module is rendered

- **WHEN** a Batch-B manifest declares a simulation or compute capability
- **THEN** the shared shell SHALL invoke its registered adapter with the
  captured bundle/session context
- **AND** numeric execution SHALL remain in the existing Rust/WASM or server
  runtime boundary.

#### Scenario: A required capability is unsupported

- **WHEN** no registered plugin can render a required declared capability
- **THEN** the route SHALL expose the existing explicit missing-renderer result
- **AND** it SHALL not silently substitute a private or guessed renderer.

### Requirement: Runtime identity and durable evidence remain unchanged

Every Batch-B read SHALL use the C10 CourseBundle runtime surface and preserve
captured release/tree, source revision, complete digest, resource hashes, and
manifest hash.  Response-producing steps SHALL use durable submission evidence;
live progress SHALL remain separate from attempts and teacher/report evidence.

#### Scenario: A compute response is submitted twice

- **WHEN** a student submits and resubmits a compute or simulation response
- **THEN** each permitted attempt SHALL retain its durable identity and
  evidence
- **AND** mutable live state SHALL not replace or erase either attempt.

#### Scenario: Teacher preview runs a simulation

- **WHEN** a teacher or guest opens a Batch-B demo/preview
- **THEN** it MAY execute the bounded preview adapter
- **AND** it SHALL create no student state, submission, interaction log, or
  Learning Record evidence.

### Requirement: Private Batch-B authorities are deleted after qualification

Once all Batch-B callers use the shared shell, CourseBundle runtime reads, and
registered plugins, superseded route/session/component authorities SHALL be
deleted.  A redirect, forwarding facade, or hidden fallback SHALL not satisfy
the retirement gate.

#### Scenario: Batch-B caller inventory is empty

- **WHEN** static, dynamic, plugin, test, and browser inventories find no
  required private caller
- **THEN** the private authority SHALL be removed in the qualified revision
- **AND** the ledger SHALL bind its replacement and deletion evidence.

#### Scenario: A hidden private path remains

- **WHEN** a required route, test, plugin, or browser entry still reaches a
  private authority
- **THEN** Batch-B qualification SHALL remain blocked
- **AND** deletion SHALL not be reported as complete.

### Requirement: Batch-B qualification covers advanced role journeys

The qualification SHALL compare characterization and migrated behavior for
ordinary, compute, visual, simulation, response-producing, Cruise, preview,
unauthorized, drift, reconnect, and finish cases.  Evidence SHALL bind to one
source revision and the fixed batch membership.

#### Scenario: Advanced browser acceptance runs

- **WHEN** teacher and student journeys exercise a representative advanced
  module and a Cruise lesson
- **THEN** shell/session behavior, plugin identity, runtime hashes, role
  projection, and durable evidence SHALL match characterization
- **AND** an unapproved difference SHALL block private deletion.

