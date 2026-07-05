## ADDED Requirements
### Requirement: Reference sections are reviewed separately from core textbook sections
Reference books, encyclopedic entries, and external long-form resources SHALL be classified independently from core textbook path units.

#### Scenario: Reference section is reviewed
- **WHEN** a reference section is reviewed for resource governance
- **THEN** it SHALL be classified as path-plannable, remediation, extension, enrichment, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** path promotion SHALL require graph mapping, LearningGoal fit, source authority, estimated time, citation address, privacy policy, source hash, and review metadata.

#### Scenario: Reference is unsuitable
- **WHEN** a reference section is too advanced, duplicate, off-topic, copyright-restricted, stale, or unsuitable for a student path
- **THEN** it SHALL be excluded with reviewer-visible rationale rather than remaining an unexplained resource gap.
