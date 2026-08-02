## ADDED Requirements

### Requirement: Teachers can revisit governed diagnosis report history

The system SHALL show persisted diagnosis reports inside the existing teacher class and class-bound student workspaces. The history SHALL be newest first, SHALL preserve class or student scope, and SHALL remain read-only.

#### Scenario: Teacher views class report history

- **WHEN** an authenticated teacher opens an active class they own
- **THEN** the class workspace SHALL load only class-scoped reports authorized by the diagnosis report API
- **AND** selecting a report SHALL display its persisted snapshot without generating or writing another report.

#### Scenario: Teacher views student report history

- **WHEN** an authenticated teacher opens a current class member's detail workspace
- **THEN** the workspace SHALL load only reports scoped to that student in that class
- **AND** the report SHALL remain unavailable for students outside the authorized class.

### Requirement: Report projections preserve evidence governance

The report surface SHALL display summary, structured findings, generated time, evidence cutoff, source coverage, confidence, limitations, current-risk counts, and server-generated preparation links. It SHALL NOT render raw answers, private dialogue, raw evidence JSON, parser output, or opaque evidence-reference identifiers.

#### Scenario: A report has low confidence or limitations

- **WHEN** the selected report has low or unavailable confidence or declares limitations
- **THEN** the surface SHALL identify the snapshot as degraded
- **AND** it SHALL retain the limitations and evidence cutoff instead of presenting missing evidence as a zero score.

#### Scenario: A finding contains a preparation link

- **WHEN** a governed finding contains a server-generated preparation link
- **THEN** the teacher MAY navigate to that preparation location
- **AND** viewing the finding SHALL NOT create a preparation pack or teaching intervention.

#### Scenario: No persisted report exists

- **WHEN** the authorized report history is empty
- **THEN** the surface SHALL show an explicit empty-history state
- **AND** it SHALL NOT imply that the class or student has no learning risk.

