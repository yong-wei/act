## ADDED Requirements

### Requirement: The control arena uses one Chinese display name
User-facing Chinese copy SHALL refer to the control arena as 竞技场 and SHALL NOT display the English word Arena, while machine identifiers remain unchanged.

#### Scenario: Learner reads arena-related copy
- **WHEN** a student, teacher or administrator page, server-provided message, Konling citation label or registered resource title shows Chinese copy about the control arena
- **THEN** the copy SHALL use 竞技场
- **AND** SHALL NOT contain the standalone word Arena.

#### Scenario: Identifiers stay stable
- **WHEN** code refers to routes, model names, event types, data attributes or identifiers such as `ArenaSubmission`
- **THEN** those identifiers SHALL remain unchanged.

#### Scenario: Reviewed assessment items
- **WHEN** Arena appears in assessment item stems or options whose content hashes are frozen by semantic review
- **THEN** the text SHALL remain unchanged until the items go through re-review, so terminal validation does not fall back to unavailable.

#### Scenario: English-only label groups
- **WHEN** a label belongs to a group that is entirely in English, such as the architecture charter domain list or an English administrator console column
- **THEN** the label MAY keep Arena so the group stays consistent.
