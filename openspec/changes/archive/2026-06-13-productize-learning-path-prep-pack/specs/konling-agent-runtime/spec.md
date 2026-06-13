## MODIFIED Requirements

### Requirement: Konling coaching is path-aware and citation-enforced
Konling path advice SHALL consume path comparison, selection history, and terminal validation context.

#### Scenario: Personalized recommendation is generated
- **WHEN** a student asks why a path is recommended or selected
- **THEN** Konling SHALL ground the answer in diagnosis, path option context, selection history, and evidence citations
- **AND** it SHALL distinguish preference evidence from mastery evidence.

### Requirement: Konling supports teaching-assistant modes
Prep coauthor mode SHALL remain advisory during prep-pack review.

#### Scenario: Prep coauthor mode starts
- **WHEN** a teacher opens prep coauthor mode from a prep-pack review surface
- **THEN** Konling SHALL receive prep-pack, diagnosis, citation, and teacher-review context
- **AND** it SHALL be forbidden from publishing prep items or inserting lesson items directly.
