## ADDED Requirements

### Requirement: Candidate path cards expose aggregate recommendation basis
The adaptive learning center SHALL let students inspect how generation-time aggregate learning state influenced each formally generated candidate path before selecting it.

#### Scenario: Candidate path has aggregate recommendation basis
- **WHEN** a formally generated candidate path includes an aggregate recommendation basis
- **THEN** its card SHALL always show a concise recommendation-basis summary
- **AND** an on-demand disclosure SHALL show aggregate state summary, capability or knowledge judgment, affected recommended resources, confidence, limitations, and a governed link to review learning records.
- **AND** the disclosure SHALL NOT claim to identify a specific evidence event, source occurrence, or event timestamp.

#### Scenario: Candidate path has low-confidence provenance
- **WHEN** the candidate path provenance is marked low confidence
- **THEN** the card SHALL explain that the path primarily follows course structure, prerequisite rules, and available resources
- **AND** it SHALL offer a student action such as completing diagnosis or practice to improve later recommendations.

#### Scenario: Candidate path predates provenance support
- **WHEN** a restored candidate path does not contain recommendation provenance
- **THEN** the card SHALL retain the existing student-facing recommendation summary
- **AND** it SHALL NOT synthesize a historical evidence chain from the student's current learner state.

#### Scenario: Recommendation provenance is viewed on narrow screens
- **WHEN** the candidate path card is rendered at a 320px viewport
- **THEN** the summary, disclosure control, explanation chain, evidence link, and existing path actions SHALL remain readable and operable without horizontal clipping or action overlap.
