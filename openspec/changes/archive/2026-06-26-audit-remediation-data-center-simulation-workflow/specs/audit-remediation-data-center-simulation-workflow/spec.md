## ADDED Requirements

### Requirement: Data Center shall expose role and source boundaries
Data Center surfaces SHALL distinguish student redirection, teacher/admin access, demo/source quality, and governance handoff states.

#### Scenario: Student access
- **WHEN** a student opens Data Center
- **THEN** the user SHALL receive an explicit reason and a student-appropriate evidence or review destination
- **AND** the redirect SHALL NOT be silent.

#### Scenario: Export snapshot
- **WHEN** a teacher or admin exports a Data Center snapshot
- **THEN** the export control SHALL be reachable despite global floating controls
- **AND** the UI SHALL show preparing, ready, downloaded, failed, and retry states.
- **AND** the exported snapshot SHALL declare source table families, source window, demo/synthetic/imported/production source quality, requester role, and redaction policy.
- **AND** raw `LearningFact`, `StudentCompetencySnapshot`, risk flags, class snapshots, direct student ids, and private evidence bodies SHALL NOT be exported unless the route is explicitly authorized for that role and the artifact records the permitted scope.

### Requirement: Simulation workflows shall preserve task context and visible tools
Simulation pages SHALL display declared tool regions and preserve mission/task/save-back context.

#### Scenario: Mission-linked simulation
- **WHEN** a simulation opens from a mission or portfolio task
- **THEN** it SHALL show mission title, objective, completion criteria, and return/save-back target
- **AND** completion SHALL state whether work was saved, queued, or unsupported.

#### Scenario: Simulation directory and compatibility routes
- **WHEN** a user filters the simulation directory, reaches an empty simulation result, or opens `/virtual-lab`
- **THEN** result changes SHALL emit `status/live` feedback
- **AND** empty states SHALL include recovery actions
- **AND** compatibility redirects SHALL explain the destination rather than silently changing task context.

#### Scenario: Portfolio save-back
- **WHEN** a simulation design task is launched from portfolio or mission context
- **THEN** the simulation SHALL preserve the originating task id and title
- **AND** the return flow SHALL state whether a design artifact was saved, queued for review, or explicitly unsupported.
