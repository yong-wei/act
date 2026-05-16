# arena-publication-workflow Specification

## Purpose
TBD - created by archiving change arena-teaching-platform-integration. Update Purpose after archive.
## Requirements
### Requirement: Teachers can persist Arena challenge publications
The system SHALL allow authorized teachers and admins to create persisted Arena challenge publications bound to a task, class, deadline, visibility, leaderboard policy, and homework setting.

#### Scenario: Teacher publishes to own class
- **WHEN** a teacher creates an Arena publication for a class they own
- **THEN** the system MUST persist the publication and return its identifier, task, class, deadline, visibility, leaderboard policy, and status

#### Scenario: Teacher publishes to another teacher's class
- **WHEN** a non-admin teacher attempts to create or modify an Arena publication for a class they do not own
- **THEN** the system MUST reject the request

### Requirement: Publications have lifecycle status
Arena publications SHALL support lifecycle state sufficient to distinguish draft, active, paused, and archived or closed publications.

#### Scenario: Paused publication
- **WHEN** a publication is paused
- **THEN** students MUST NOT be able to start new official submissions through that publication context

### Requirement: Preview is not publication
Generating an Arena teacher preview SHALL NOT create a persisted publication.

#### Scenario: Preview request
- **WHEN** a teacher sends a preview request
- **THEN** the system MUST validate and return the preview object without inserting a publication row

