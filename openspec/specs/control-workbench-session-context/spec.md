# control-workbench-session-context Specification

## Purpose
TBD - created by archiving change control-workbench-shell. Update Purpose after archive.
## Requirements
### Requirement: Unified control workbench route resolves session context
The system SHALL provide a `/interactive-learning/control-workbench` route that resolves a workbench session from URL parameters and existing Arena context.

#### Scenario: Challenge task opens unified workbench
- **WHEN** a student opens `/interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid`
- **THEN** the page SHALL resolve the Arena task, object, metric profile, leaderboard policy, allowed methods, and recommended workspace mode
- **AND** the session SHALL be marked as challenge mode.

#### Scenario: Free explore opens without task
- **WHEN** a student opens `/interactive-learning/control-workbench` without `arenaTask`
- **THEN** the page SHALL render free-explore mode
- **AND** the session SHALL state that results are not eligible for official Arena leaderboards.

### Requirement: Workbench session separates official target and working model
The workbench session SHALL distinguish the official target from the student's working model.

#### Scenario: White-box challenge uses shared target and working model
- **WHEN** the challenge object exposes a white-box transfer-function model
- **THEN** `officialTarget` and `workingModel` SHALL both refer to the public transfer-function model.

#### Scenario: Black-box challenge hides official model
- **WHEN** the challenge object is black-box
- **THEN** `officialTarget` SHALL identify the hidden target policy without exposing a transfer function
- **AND** `workingModel` SHALL be empty until the student creates or imports a nominal model.

### Requirement: Invalid challenge context fails closed
The unified workbench SHALL NOT fall back to any default model when an `arenaTask` is invalid or incomplete.

#### Scenario: Unknown task id
- **WHEN** a student opens `/interactive-learning/control-workbench?arenaTask=missing-task`
- **THEN** the page SHALL show a Chinese challenge-context error
- **AND** no analysis chart, model editor, or official submission action SHALL render.

### Requirement: Publication parameters remain part of workbench session
The workbench session SHALL preserve publication-related route parameters for official submission surfaces.

#### Scenario: Publication id is present
- **WHEN** the route includes `publicationId`
- **THEN** the session SHALL keep the publication id available for submission panels
- **AND** the shell SHALL indicate that the session is bound to an assignment context.

