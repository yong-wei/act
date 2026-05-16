# arena-assignment-submission-context Specification

## Purpose
TBD - created by archiving change arena-teaching-platform-integration. Update Purpose after archive.
## Requirements
### Requirement: Students can submit Arena work against a publication
The system SHALL allow a student to submit an Arena artifact with publication context only when the student is allowed to access that publication.

#### Scenario: Valid class publication submission
- **WHEN** a student in the publication's class submits an artifact with `publicationId`
- **THEN** the persisted Arena submission MUST store `publicationId`, `classId`, and the official evaluation result

#### Scenario: Unauthorized publication submission
- **WHEN** a student outside the publication's permitted audience submits with that `publicationId`
- **THEN** the system MUST reject the submission before evaluation is inserted into the leaderboard

### Requirement: Publication leaderboards respect visibility and deadline policy
The system SHALL filter Arena leaderboard output by publication, class, visibility, and deadline policy.

#### Scenario: Hidden before deadline
- **WHEN** a publication hides full class leaderboard before its deadline
- **THEN** students MUST see their own status without seeing the full ranked class list

#### Scenario: Visible after deadline
- **WHEN** the same publication reaches its deadline and policy allows post-deadline ranking
- **THEN** students MAY see the class leaderboard filtered to submissions for that publication

### Requirement: Publication context does not replace official scoring
Publication grading policy SHALL consume official Arena evaluation output rather than bypassing `/api/arena/evaluate`.

#### Scenario: Homework-bound publication
- **WHEN** a homework-bound publication computes grade components
- **THEN** it MUST use the official Arena submission validity, score, metrics, and diagnostics as inputs

