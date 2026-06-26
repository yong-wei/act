# audit-remediation-arena-publication-context Specification

## Purpose
TBD - created by archiving change audit-remediation-arena-publication-context. Update Purpose after archive.
## Requirements
### Requirement: Arena publications shall expose product context and lifecycle state
Arena publication lists, reports, and student entries SHALL distinguish active, expired, report-ready, late-only, and unavailable states and SHALL avoid primary display of internal ids.

#### Scenario: Expired publication
- **WHEN** a publication is expired
- **THEN** teacher and student views SHALL visibly distinguish it from active publications
- **AND** available actions SHALL reflect report/review status rather than active challenge status.

#### Scenario: Student challenge entry
- **WHEN** a student opens a publication challenge
- **THEN** the page SHALL show task title, class or assignment scope, deadline, teacher or source context, and leaderboard source boundaries.

### Requirement: Arena report delivery shall preserve attempt policy and add delivery actions
Teacher publication reports SHALL retain effective/late/zero/invalid attempt policy while adding delivery actions and product naming.

#### Scenario: Teacher report
- **WHEN** a teacher opens an Arena publication report
- **THEN** the report SHALL show product task naming and ownership context
- **AND** export, send/publish, lock/finalize, or copy commentary states SHALL be visible where supported.
- **AND** official report rows, honors, and leaderboard entries SHALL use server-side `ArenaSubmission` records as the authoritative source of score, submission time, hard-constraint pass, late status, and attempt validity.
- **AND** `LearningFact` Arena context SHALL be treated only as auxiliary evidence and SHALL NOT by itself create official ranking, honor, or report rows.

#### Scenario: Mobile publication actions
- **WHEN** the publication report or challenge drawer is viewed on mobile
- **THEN** primary publication actions SHALL remain reachable without being hidden by global floating controls
- **AND** active/expired and leaderboard-source explanations SHALL remain visible or reachable.

