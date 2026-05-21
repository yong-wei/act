## Purpose
Teacher Arena needs to support challenge selection, assignment progress diagnosis, and classroom review rather than acting only as a publication configuration form.

## Requirements

### Requirement: Teachers can select challenges by teaching intent
The system SHALL help teachers choose Arena challenges using capability, stage, method, and class context.

#### Scenario: Teacher configures an Arena challenge
- **WHEN** the teacher opens the Arena configuration page
- **THEN** challenge choices include training intent and suitability evidence, not only raw task identifiers

### Requirement: Publication reports support classroom review
The system SHALL provide report evidence suitable for post-challenge lecture or review.

#### Scenario: Teacher opens a publication report
- **WHEN** submissions exist for the publication
- **THEN** the report shows participation, non-submitters, typical failures, weak metrics, method distribution, and excellent-solution candidates

### Requirement: Teacher review protects student privacy
The system SHALL support anonymized or summary-first classroom review of student solutions.

#### Scenario: Teacher presents excellent or failing solutions
- **WHEN** lecture-mode evidence is shown
- **THEN** the default presentation avoids exposing private raw controller payloads
