## ADDED Requirements

### Requirement: Teacher analytics retain the latest valid class-scoped learning state
Teacher class and student insight services SHALL retain and display the latest valid class-scoped learning state until new governed class-scoped evidence or formal revocation changes it.

#### Scenario: A class has valid historical evidence but no recent activity
- **WHEN** an authorized teacher opens analytics for a class with a valid class-scoped snapshot
- **AND** no new governed class-scoped evidence exists in the current rolling activity window
- **THEN** the response SHALL return the latest valid class-scoped state and its effective snapshot date
- **AND** it SHALL NOT replace scores, distributions, or student coverage with a no-evidence state solely because the evidence is old.

#### Scenario: Class metrics are returned
- **WHEN** a teacher analytics response contains coverage, activity, an average, or a distribution
- **THEN** it SHALL distinguish enrolled students, effective-state coverage, recently active students with an explicit window, stale states, never-evidenced students, revoked states, and unresolved states
- **AND** every average and distribution SHALL disclose its included count and denominator
- **AND** historical effective-state coverage SHALL NOT be labeled as recent activity.

#### Scenario: Freshness is stale
- **WHEN** the selected class or student state has stale evidence freshness
- **THEN** the response SHALL expose freshness separately from the effective snapshot date and capability values
- **AND** stale freshness SHALL NOT be presented as capability loss or absence of historical evidence.

#### Scenario: A class-scoped revocation occurs
- **WHEN** governed evidence used by a class projection is formally revoked
- **THEN** the class projection SHALL be recomputed within that class scope
- **AND** the response SHALL expose the resulting evidence state and revocation-aware lineage without using inactivity as the reason.

#### Scenario: Evidence exists only in another class
- **WHEN** a learner has governed evidence outside the requested class but no valid evidence or projection inside the requested class
- **THEN** the teacher analytics response SHALL NOT import the outside evidence
- **AND** it SHALL report the requested class scope as never-evidenced or unavailable according to the effective-state contract.

#### Scenario: A student transferred between classes
- **WHEN** current-roster analytics include a student whose historical evidence belongs to another class
- **THEN** the requested class SHALL include the student in enrolled population metrics but SHALL exclude the other class's evidence from effective-state coverage
- **AND** historical class reconstruction SHALL use event-time session or participant provenance rather than current `classId`
- **AND** unverifiable historical membership SHALL be unresolved rather than filled from a global portrait.

### Requirement: Class projections update only from class-scoped state changes
Class competency materialization SHALL create a new class projection only when authorized state-changing evidence or formal revocation changes that class's effective aggregate.

#### Scenario: Scheduled class materialization finds no state change
- **WHEN** a class materialization job finds no new authorized state-changing evidence and no revocation
- **THEN** it SHALL retain the existing effective class snapshot
- **AND** it SHALL NOT append a time-only no-evidence snapshot or stage unchanged dependent work.

#### Scenario: Historical class projection is repaired
- **WHEN** repair apply reconstructs a class projection from authorized historical facts and valid student baselines
- **THEN** the corrected projection SHALL use the current materialization version and record migration lineage
- **AND** verification SHALL prove that students and evidence from other classes were excluded.
- **AND** historical population-at-snapshot metadata SHALL remain distinct from current-roster metrics.

### Requirement: Teacher analytics observe one active projection generation
Teacher class and student insight services SHALL read all learner, class, summary, recommendation, and cache data from the same active projection generation.

#### Scenario: A shadow generation is incomplete
- **WHEN** repair is building or verifying a shadow generation
- **THEN** teacher analytics SHALL continue serving the prior active generation
- **AND** it SHALL NOT combine counts, scores, distributions, or freshness from different generations.

#### Scenario: Active generation changes
- **WHEN** operators atomically activate or roll back a verified projection generation
- **THEN** the next teacher analytics request SHALL use that generation consistently
- **AND** the response SHALL retain class authorization and denominator semantics.
